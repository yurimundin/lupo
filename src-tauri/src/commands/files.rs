#[tauri::command]
pub fn log_smoke_result(message: String) {
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

#[tauri::command]
pub fn read_file_bytes(path: String) -> Result<Vec<u8>, String> {
    std::fs::read(&path).map_err(|e| format!("erro ao ler {path}: {e}"))
}

#[tauri::command]
pub fn file_exists(path: String) -> bool {
    std::path::Path::new(&path).exists()
}

#[tauri::command]
pub fn write_file_with_backup(path: String, bytes: Vec<u8>) -> Result<(), String> {
    let target = std::path::PathBuf::from(&path);
    if target.exists() {
        let backup_path = format!("{path}.bak");
        let _ = std::fs::remove_file(&backup_path);
        std::fs::rename(&path, &backup_path)
            .map_err(|e| format!("erro ao criar backup ({backup_path}): {e}"))?;
    }
    std::fs::write(&path, &bytes).map_err(|e| format!("erro ao escrever {path}: {e}"))
}
