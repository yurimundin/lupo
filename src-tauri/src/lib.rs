mod commands;
mod crypto;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            commands::crypto_commands::argon2_derive_key,
            commands::files::log_smoke_result,
            commands::files::read_file_bytes,
            commands::files::write_file_with_backup,
            commands::files::file_exists,
            commands::recovery::inspect_vault_recovery,
            commands::recovery::restore_vault_backup,
            commands::save::save_vault_with_backup
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
