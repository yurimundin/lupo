use serde::Serialize;

use super::vault_io::{has_kdbx_magic, io_error_to_pt, unix_timestamp_ms, write_with_fsync};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecoveryFileInfo {
    path: String,
    exists: bool,
    size: Option<u64>,
    modified_ms: Option<u128>,
    has_kdbx_magic: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultRecoveryState {
    vault: RecoveryFileInfo,
    tmp: RecoveryFileInfo,
    bak: RecoveryFileInfo,
    needs_attention: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RestoreBackupResult {
    restored_path: String,
    previous_vault_backup_path: String,
    removed_tmp: bool,
}

#[tauri::command]
pub fn inspect_vault_recovery(file_path: String) -> Result<VaultRecoveryState, String> {
    if file_path.trim().is_empty() {
        return Err("Caminho do cofre vazio.".to_string());
    }
    if !file_path.to_lowercase().ends_with(".kdbx") {
        return Err("Extensao invalida - esperado .kdbx".to_string());
    }

    let tmp_path = format!("{file_path}.tmp");
    let bak_path = format!("{file_path}.bak");
    let vault = recovery_file_info(&file_path);
    let tmp = recovery_file_info(&tmp_path);
    let bak = recovery_file_info(&bak_path);
    let needs_attention = tmp.exists || (!vault.has_kdbx_magic && bak.has_kdbx_magic);

    Ok(VaultRecoveryState {
        vault,
        tmp,
        bak,
        needs_attention,
    })
}

#[tauri::command]
pub fn restore_vault_backup(file_path: String) -> Result<RestoreBackupResult, String> {
    if file_path.trim().is_empty() {
        return Err("Caminho do cofre vazio.".to_string());
    }
    if !file_path.to_lowercase().ends_with(".kdbx") {
        return Err("Extensao invalida - esperado .kdbx".to_string());
    }

    let target = std::path::Path::new(&file_path);
    let bak_path = format!("{file_path}.bak");
    let tmp_path = format!("{file_path}.tmp");

    let bak_bytes =
        std::fs::read(&bak_path).map_err(|e| io_error_to_pt(&e, &bak_path, "ler backup"))?;
    if !has_kdbx_magic(&bak_bytes) {
        return Err("Backup encontrado, mas ele nao parece ser um cofre KDBX valido.".to_string());
    }

    let restore_tmp_path = format!("{file_path}.restore-tmp");
    write_with_fsync(&restore_tmp_path, &bak_bytes)
        .map_err(|e| io_error_to_pt(&e, &restore_tmp_path, "preparar restauracao"))?;

    let timestamp = unix_timestamp_ms();
    let previous_vault_backup_path = format!("{file_path}.before-restore-{timestamp}.bak");

    if target.exists() {
        let current_bytes =
            std::fs::read(target).map_err(|e| io_error_to_pt(&e, &file_path, "ler cofre atual"))?;
        write_with_fsync(&previous_vault_backup_path, &current_bytes).map_err(|e| {
            let _ = std::fs::remove_file(&restore_tmp_path);
            io_error_to_pt(&e, &previous_vault_backup_path, "preservar cofre atual")
        })?;
        std::fs::remove_file(target).map_err(|e| {
            let _ = std::fs::remove_file(&restore_tmp_path);
            io_error_to_pt(&e, &file_path, "substituir cofre atual")
        })?;
    }

    std::fs::rename(&restore_tmp_path, target).map_err(|e| {
        let _ = std::fs::remove_file(&restore_tmp_path);
        io_error_to_pt(&e, &file_path, "finalizar restauracao")
    })?;

    let removed_tmp = match std::fs::remove_file(&tmp_path) {
        Ok(()) => true,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => false,
        Err(_) => false,
    };

    Ok(RestoreBackupResult {
        restored_path: file_path,
        previous_vault_backup_path,
        removed_tmp,
    })
}

fn recovery_file_info(path: &str) -> RecoveryFileInfo {
    let metadata = std::fs::metadata(path).ok();
    let bytes = if metadata.as_ref().is_some_and(|meta| meta.is_file()) {
        std::fs::read(path).ok()
    } else {
        None
    };

    RecoveryFileInfo {
        path: path.to_string(),
        exists: metadata.as_ref().is_some_and(|meta| meta.is_file()),
        size: metadata.as_ref().map(|meta| meta.len()),
        modified_ms: metadata
            .as_ref()
            .and_then(|meta| meta.modified().ok())
            .and_then(|time| {
                time.duration_since(std::time::UNIX_EPOCH)
                    .ok()
                    .map(|duration| duration.as_millis())
            }),
        has_kdbx_magic: bytes
            .as_ref()
            .is_some_and(|file_bytes| has_kdbx_magic(file_bytes)),
    }
}
