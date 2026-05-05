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
            file_exists
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
