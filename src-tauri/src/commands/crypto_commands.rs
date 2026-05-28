use crate::crypto::Argon2Variant;

#[tauri::command]
pub async fn argon2_derive_key(
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
        crate::crypto::derive_argon2_key(
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
    .map_err(|e| format!("erro ao agendar tarefa de derivacao: {e}"))?
}
