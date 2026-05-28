use super::vault_io::{
    has_kdbx_magic, io_error_to_pt, write_with_fsync, KDBX_MAGIC, MIN_VAULT_BYTES,
};

#[tauri::command]
pub async fn save_vault_with_backup(
    file_path: String,
    vault_bytes: Vec<u8>,
) -> Result<u128, String> {
    tauri::async_runtime::spawn_blocking(move || save_vault_inner(file_path, vault_bytes))
        .await
        .map_err(|e| format!("Erro interno ao agendar gravacao: {e}"))?
}

fn save_vault_inner(file_path: String, vault_bytes: Vec<u8>) -> Result<u128, String> {
    let start = std::time::Instant::now();

    if file_path.trim().is_empty() {
        return Err("Caminho do cofre vazio.".to_string());
    }
    if !file_path.to_lowercase().ends_with(".kdbx") {
        return Err("Extensao invalida - esperado .kdbx".to_string());
    }
    if vault_bytes.len() < MIN_VAULT_BYTES {
        return Err(format!(
            "Cofre suspeitamente pequeno ({} bytes) - abortando para preservar arquivo atual.",
            vault_bytes.len()
        ));
    }

    let target = std::path::Path::new(&file_path);
    let meta = std::fs::metadata(target).map_err(|e| match e.kind() {
        std::io::ErrorKind::NotFound => {
            format!("Arquivo do cofre nao encontrado: {file_path}")
        }
        std::io::ErrorKind::PermissionDenied => {
            "Permissao negada ao acessar o cofre - verifique se outro programa esta com o arquivo aberto."
                .to_string()
        }
        _ => format!("Erro ao acessar o cofre ({file_path}): {e}"),
    })?;

    if meta.is_dir() {
        return Err(format!(
            "Caminho aponta para um diretorio, nao um arquivo: {file_path}"
        ));
    }

    let parent = target
        .parent()
        .ok_or_else(|| format!("Caminho do cofre sem pasta pai valida: {file_path}"))?;
    if !parent.exists() {
        return Err("Pasta do cofre nao existe ou foi removida.".to_string());
    }

    let current_bytes =
        std::fs::read(target).map_err(|e| io_error_to_pt(&e, &file_path, "ler cofre atual"))?;
    if current_bytes.len() < KDBX_MAGIC.len() || current_bytes[..8] != KDBX_MAGIC {
        return Err(
            "Arquivo .kdbx atual parece corrompido - abortando para preservar.".to_string(),
        );
    }

    let bak_path = format!("{file_path}.bak");
    write_with_fsync(&bak_path, &current_bytes)
        .map_err(|e| io_error_to_pt(&e, &bak_path, "gravar backup"))?;

    let tmp_path = format!("{file_path}.tmp");
    write_with_fsync(&tmp_path, &vault_bytes).map_err(|e| {
        let _ = std::fs::remove_file(&tmp_path);
        io_error_to_pt(&e, &tmp_path, "gravar arquivo temporario")
    })?;

    let tmp_valid = match std::fs::read(&tmp_path) {
        Ok(bytes) => has_kdbx_magic(&bytes),
        Err(_) => false,
    };
    if !tmp_valid {
        let _ = std::fs::remove_file(&tmp_path);
        return Err(
            "Falha na validacao do arquivo gerado - cofre original preservado.".to_string(),
        );
    }

    std::fs::rename(&tmp_path, target).map_err(|e| {
        let _ = std::fs::remove_file(&tmp_path);
        io_error_to_pt(&e, &file_path, "finalizar gravacao")
    })?;

    Ok(start.elapsed().as_millis())
}
