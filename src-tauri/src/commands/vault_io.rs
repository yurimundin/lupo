pub const KDBX_MAGIC: [u8; 8] = [0x03, 0xD9, 0xA2, 0x9A, 0x67, 0xFB, 0x4B, 0xB5];

pub const MIN_VAULT_BYTES: usize = 200;

pub fn write_with_fsync(path: &str, bytes: &[u8]) -> std::io::Result<()> {
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

pub fn has_kdbx_magic(bytes: &[u8]) -> bool {
    bytes.len() >= KDBX_MAGIC.len() && bytes[..8] == KDBX_MAGIC
}

pub fn unix_timestamp_ms() -> u128 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or(0)
}

pub fn io_error_to_pt(e: &std::io::Error, path: &str, action: &str) -> String {
    let basename: String = std::path::Path::new(path)
        .file_name()
        .map(|s| s.to_string_lossy().into_owned())
        .unwrap_or_else(|| "arquivo".to_string());

    if e.raw_os_error() == Some(112) {
        return "Disco cheio - libere espaco e tente novamente.".to_string();
    }

    match e.kind() {
        std::io::ErrorKind::NotFound => format!("Arquivo nao encontrado: {basename}"),
        std::io::ErrorKind::PermissionDenied => format!(
            "Permissao negada ao {action} ({basename}) - verifique se outro programa esta com o arquivo aberto ou se o antivirus esta bloqueando."
        ),
        std::io::ErrorKind::AlreadyExists => format!(
            "Conflito ao {action} ({basename}) - tente novamente."
        ),
        _ => format!("Erro de E/S ao {action} ({basename}): {e}"),
    }
}
