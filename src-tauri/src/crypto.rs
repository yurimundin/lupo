// Camada de cripto do backend Rust.
//
// Hoje contém apenas a derivação de chave Argon2, exposta ao front via
// comando Tauri (ver `lib.rs`). NUNCA implementamos algoritmos cripto
// próprios — usamos exclusivamente a crate `argon2` do RustCrypto, que é
// auditada e canônica.

use argon2::{Algorithm, Argon2, Params, Version};
use serde::Deserialize;
use zeroize::Zeroizing;

/// Variante do Argon2 suportada pelo formato KDBX4.
///
/// O KDBX4 usa um UUID na header pra identificar a variante; o front-end
/// (kdbxweb) repassa pra cá um inteiro: `0` = Argon2d, `2` = Argon2id
/// (sim, kdbxweb pula o `1` que seria Argon2i — não suportado pelo KDBX).
/// Aqui no Rust usamos um enum nominal pra evitar erros de magic number.
#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Argon2Variant {
    Argon2d,
    Argon2id,
}

/// Deriva uma chave usando Argon2 (variante e versão dadas).
///
/// Parâmetros:
/// - `password`: bytes da senha-mestra (consumidos por valor para que o
///   buffer seja zerado quando esta função retornar).
/// - `salt`: sal (sem requisitos especiais além de ≥ 8 bytes).
/// - `iterations`: parâmetro `t` (custo de tempo). KDBX4 padrão: 2.
/// - `memory_kib`: memória em KiB (parâmetro `m`). KDBX4 padrão: 65536 (64 MiB).
/// - `parallelism`: paralelismo (parâmetro `p`). KDBX4 padrão: 2.
/// - `output_len`: tamanho da chave de saída em bytes (KDBX4: 32).
/// - `version_byte`: `0x10` (Argon2 v1.0) ou `0x13` (v1.3). KDBX4 padrão: `0x13`.
/// - `variant`: `Argon2d` ou `Argon2id`.
///
/// Retorna a chave derivada como `Vec<u8>` ou uma mensagem de erro.
pub fn derive_argon2_key(
    password: Vec<u8>,
    salt: &[u8],
    iterations: u32,
    memory_kib: u32,
    parallelism: u32,
    output_len: usize,
    version_byte: u8,
    variant: Argon2Variant,
) -> Result<Vec<u8>, String> {
    // Envolvemos a senha em Zeroizing para garantir que o buffer da senha
    // seja zerado quando sair de escopo (mesmo em caso de erro/panic).
    let password = Zeroizing::new(password);

    let algorithm = match variant {
        Argon2Variant::Argon2d => Algorithm::Argon2d,
        Argon2Variant::Argon2id => Algorithm::Argon2id,
    };

    let version = match version_byte {
        0x10 => Version::V0x10,
        0x13 => Version::V0x13,
        other => {
            return Err(format!(
                "argon2: versão não suportada: 0x{other:02x} (esperado 0x10 ou 0x13)"
            ))
        }
    };

    let params = Params::new(memory_kib, iterations, parallelism, Some(output_len))
        .map_err(|e| format!("argon2: parâmetros inválidos ({e})"))?;

    let argon2 = Argon2::new(algorithm, version, params);

    // Buffer de saída pré-alocado. Não envolvemos em Zeroizing porque a chave
    // derivada é o produto final que será serializado para o front-end —
    // quem consome lá decide o ciclo de vida.
    let mut output = vec![0u8; output_len];

    argon2
        .hash_password_into(&password, salt, &mut output)
        .map_err(|e| format!("argon2: falha na derivação ({e})"))?;

    Ok(output)
}
