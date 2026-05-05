// Módulos do backend.
mod crypto;

use crypto::Argon2Variant;

/// Comando exposto ao front: deriva uma chave Argon2.
///
/// Roda em thread bloqueante via `async_runtime::spawn_blocking` — Argon2
/// com 64 MiB / 2 iterações leva ~0,5–1 s e travaria o reactor async se
/// fosse chamado direto.
#[tauri::command]
async fn argon2_derive_key(
    password: Vec<u8>,
    salt: Vec<u8>,
    iterations: u32,
    memory_kib: u32,
    parallelism: u32,
    output_len: u32,
    version: u8,
    variant: Argon2Variant,
) -> Result<Vec<u8>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        crypto::derive_argon2_key(
            password,
            &salt,
            iterations,
            memory_kib,
            parallelism,
            output_len as usize,
            version,
            variant,
        )
    })
    .await
    .map_err(|e| format!("erro ao agendar tarefa de derivação: {e}"))?
}

/// Comando utilitário: o front emite mensagens de log que aparecem no
/// stdout do `npm run tauri dev` e também são gravadas em
/// `%TEMP%/sec-basis-bench.log`.
///
/// O arquivo é importante em release builds: como o bin tem
/// `windows_subsystem = "windows"`, `println!` para um stdout que ninguém
/// captura — sem o arquivo, smoke test/benchmark em release não tem como
/// reportar tempos sem habilitar DevTools.
///
/// Falha silenciosa se não conseguir escrever no arquivo: o smoke test
/// não pode quebrar por causa disso.
#[tauri::command]
fn log_smoke_result(message: String) {
    println!("[SMOKE] {message}");

    let temp_dir = std::env::temp_dir();
    let path = temp_dir.join("sec-basis-bench.log");
    if let Ok(mut file) = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
    {
        use std::io::Write;
        let _ = writeln!(file, "[SMOKE] {message}");
    }
}

/// Lê os bytes de um arquivo `.kdbx` pelo caminho absoluto. Síncrona — o
/// Tauri executa comandos sync em thread separada, então não trava o
/// reactor.
#[tauri::command]
fn read_file_bytes(path: String) -> Result<Vec<u8>, String> {
    std::fs::read(&path).map_err(|e| format!("erro ao ler {path}: {e}"))
}

/// Verifica se um arquivo existe no caminho indicado. Usado para validar
/// se um key file lembrado ainda está no lugar antes de pré-preencher a
/// tela de abrir cofre.
#[tauri::command]
fn file_exists(path: String) -> bool {
    std::path::Path::new(&path).exists()
}

/// Escreve bytes em arquivo, fazendo backup automático do arquivo anterior
/// como `<path>.bak`. Implementa o princípio "Backup automático antes de
/// salvar" do projeto.
///
/// - Se o arquivo já existir: renomeia para `<path>.bak` (sobrescrevendo
///   um `.bak` antigo) antes de gravar a versão nova.
/// - Se não existir (criação): grava direto.
///
/// Usado para arquivos auxiliares (key files na geração inicial). Para o
/// próprio cofre `.kdbx`, usar `save_vault_with_backup` (mais robusto).
#[tauri::command]
fn write_file_with_backup(path: String, bytes: Vec<u8>) -> Result<(), String> {
    let target = std::path::PathBuf::from(&path);
    if target.exists() {
        let backup_path = format!("{path}.bak");
        // Remove .bak antigo (sucesso silencioso se não existia).
        let _ = std::fs::remove_file(&backup_path);
        std::fs::rename(&path, &backup_path)
            .map_err(|e| format!("erro ao criar backup ({backup_path}): {e}"))?;
    }
    std::fs::write(&path, &bytes)
        .map_err(|e| format!("erro ao escrever {path}: {e}"))
}

// =============================================================================
// save_vault_with_backup — gravação atômica do `.kdbx` com backup.
// =============================================================================
//
// Sequência (cada passo aborta a operação preservando o cofre original em
// caso de falha):
//
//   1. Validar inputs (path, extensão, tamanho mínimo dos bytes).
//   2. Validar que o `.kdbx` atual existe, é arquivo, está em pasta
//      acessível.
//   3. Ler bytes atuais e validar magic bytes KDBX (defesa contra
//      sobrescrever arquivo errado por bug em outro lugar).
//   4. Escrever `.kdbx.bak` (sobrescreve antigo) com `fsync` explícito.
//   5. Escrever `.kdbx.tmp` (novo conteúdo) com `fsync` explícito.
//   6. Re-validar magic bytes do `.tmp` antes de promovê-lo.
//   7. `rename(tmp → .kdbx)` — atômico em mesmo volume; no Windows usa
//      `MoveFileExW` com REPLACE_EXISTING.
//
// Se qualquer passo falhar APÓS o backup, o `.bak` permanece intacto e o
// `.kdbx` original também (rename só acontece no último passo).

/// Magic bytes do formato KDBX (`0x9AA2D903` little-endian + signature
/// KDBX4 `0xB54BFB67`). Verificados na entrada (cofre atual) e na saída
/// (arquivo temporário antes do rename).
const KDBX_MAGIC: [u8; 8] = [0x03, 0xD9, 0xA2, 0x9A, 0x67, 0xFB, 0x4B, 0xB5];

/// Tamanho mínimo razoável de um cofre KDBX4 — header + KDF parameters
/// + cipher + payload mínimo. Defesa contra `vault_bytes` truncado por bug.
const MIN_VAULT_BYTES: usize = 200;

/// Comando exposto ao front: grava o `.kdbx` com backup atômico.
/// Retorna duração em ms em caso de sucesso.
#[tauri::command]
async fn save_vault_with_backup(
    file_path: String,
    vault_bytes: Vec<u8>,
) -> Result<u128, String> {
    tauri::async_runtime::spawn_blocking(move || {
        save_vault_inner(file_path, vault_bytes)
    })
    .await
    .map_err(|e| format!("Erro interno ao agendar gravação: {e}"))?
}

/// Implementação síncrona — usar via `spawn_blocking` para não travar o
/// reactor async do Tauri durante o I/O.
fn save_vault_inner(file_path: String, vault_bytes: Vec<u8>) -> Result<u128, String> {
    let start = std::time::Instant::now();

    // ----- 1. Validar inputs -----
    if file_path.trim().is_empty() {
        return Err("Caminho do cofre vazio.".to_string());
    }
    if !file_path.to_lowercase().ends_with(".kdbx") {
        return Err("Extensão inválida — esperado .kdbx".to_string());
    }
    if vault_bytes.len() < MIN_VAULT_BYTES {
        return Err(format!(
            "Cofre suspeitamente pequeno ({} bytes) — abortando para preservar arquivo atual.",
            vault_bytes.len()
        ));
    }

    // ----- 2. Validar arquivo atual -----
    let target = std::path::Path::new(&file_path);
    let meta = std::fs::metadata(target).map_err(|e| match e.kind() {
        std::io::ErrorKind::NotFound => {
            format!("Arquivo do cofre não encontrado: {file_path}")
        }
        std::io::ErrorKind::PermissionDenied => {
            "Permissão negada ao acessar o cofre — verifique se outro programa está com o arquivo aberto."
                .to_string()
        }
        _ => format!("Erro ao acessar o cofre ({file_path}): {e}"),
    })?;

    if meta.is_dir() {
        return Err(format!(
            "Caminho aponta para um diretório, não um arquivo: {file_path}"
        ));
    }

    // Pasta pai precisa existir para criar `.tmp` e `.bak` ao lado.
    let parent = target
        .parent()
        .ok_or_else(|| format!("Caminho do cofre sem pasta pai válida: {file_path}"))?;
    if !parent.exists() {
        return Err("Pasta do cofre não existe ou foi removida.".to_string());
    }

    // ----- 3. Ler bytes atuais e validar magic -----
    let current_bytes = std::fs::read(target)
        .map_err(|e| io_error_to_pt(&e, &file_path, "ler cofre atual"))?;
    if current_bytes.len() < KDBX_MAGIC.len() || current_bytes[..8] != KDBX_MAGIC {
        return Err(
            "Arquivo .kdbx atual parece corrompido — abortando para preservar.".to_string(),
        );
    }

    // ----- 4. Escrever .kdbx.bak (sobrescreve) com fsync -----
    let bak_path = format!("{file_path}.bak");
    write_with_fsync(&bak_path, &current_bytes)
        .map_err(|e| io_error_to_pt(&e, &bak_path, "gravar backup"))?;

    // ----- 5. Escrever .kdbx.tmp (novo conteúdo) com fsync -----
    let tmp_path = format!("{file_path}.tmp");
    write_with_fsync(&tmp_path, &vault_bytes).map_err(|e| {
        // Best-effort: tenta limpar o tmp se algo escreveu parcialmente.
        let _ = std::fs::remove_file(&tmp_path);
        io_error_to_pt(&e, &tmp_path, "gravar arquivo temporário")
    })?;

    // ----- 6. Re-validar magic bytes do tmp -----
    let tmp_valid = match std::fs::read(&tmp_path) {
        Ok(bytes) => bytes.len() >= KDBX_MAGIC.len() && bytes[..8] == KDBX_MAGIC,
        Err(_) => false,
    };
    if !tmp_valid {
        let _ = std::fs::remove_file(&tmp_path);
        return Err(
            "Falha na validação do arquivo gerado — cofre original preservado.".to_string(),
        );
    }

    // ----- 7. Rename atômico tmp → .kdbx -----
    std::fs::rename(&tmp_path, target).map_err(|e| {
        let _ = std::fs::remove_file(&tmp_path);
        io_error_to_pt(&e, &file_path, "finalizar gravação")
    })?;

    // ----- 8. Retornar duração -----
    Ok(start.elapsed().as_millis())
}

/// Escreve bytes em arquivo com `fsync` explícito. `fsync` garante que
/// o conteúdo está fisicamente no disco antes do retorno — essencial
/// pra evitar corrupção em caso de crash/queda de energia entre a
/// escrita e o `rename`.
fn write_with_fsync(path: &str, bytes: &[u8]) -> std::io::Result<()> {
    use std::io::Write;
    let mut file = std::fs::OpenOptions::new()
        .write(true)
        .create(true)
        .truncate(true)
        .open(path)?;
    file.write_all(bytes)?;
    file.sync_all()?;
    Ok(())
}

/// Mapeia `std::io::Error` para mensagem amigável em PT-BR. Usa apenas
/// o basename do path (não o caminho completo) para evitar vazar
/// estrutura de pastas internas.
fn io_error_to_pt(e: &std::io::Error, path: &str, action: &str) -> String {
    // `to_string_lossy` preserva o nome mesmo com chars não-UTF8 (substitui
    // por '?' em vez de descartar tudo) — mais informativo que cair no
    // fallback genérico "arquivo".
    let basename: String = std::path::Path::new(path)
        .file_name()
        .map(|s| s.to_string_lossy().into_owned())
        .unwrap_or_else(|| "arquivo".to_string());

    // Windows ERROR_DISK_FULL = 112.
    if e.raw_os_error() == Some(112) {
        return "Disco cheio — libere espaço e tente novamente.".to_string();
    }

    match e.kind() {
        std::io::ErrorKind::NotFound => format!("Arquivo não encontrado: {basename}"),
        std::io::ErrorKind::PermissionDenied => format!(
            "Permissão negada ao {action} ({basename}) — verifique se outro programa está com o arquivo aberto ou se o antivírus está bloqueando."
        ),
        std::io::ErrorKind::AlreadyExists => format!(
            "Conflito ao {action} ({basename}) — tente novamente."
        ),
        _ => format!("Erro de E/S ao {action} ({basename}): {e}"),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            argon2_derive_key,
            log_smoke_result,
            read_file_bytes,
            write_file_with_backup,
            file_exists,
            save_vault_with_backup
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
