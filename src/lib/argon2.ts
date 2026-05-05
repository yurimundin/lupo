// Wrapper TypeScript sobre o comando Tauri `argon2_derive_key`.
//
// Toda a derivação de chave Argon2 do Sec.Basis passa por aqui — o backend
// Rust faz o trabalho pesado (ver `src-tauri/src/crypto.rs`) e devolve a
// chave derivada. NÃO implementamos Argon2 em JS/WASM por decisão
// arquitetural (ver CLAUDE.md §6).

import { invoke } from "@tauri-apps/api/core";

/** Variantes de Argon2 suportadas pelo formato KDBX4. */
export type Argon2Variant = "argon2d" | "argon2id";

/** Versões do algoritmo Argon2 (KDBX4 padrão é 0x13). */
export type Argon2VersionByte = 0x10 | 0x13;

export interface Argon2Params {
  password: Uint8Array;
  salt: Uint8Array;
  iterations: number;
  memoryKib: number;
  parallelism: number;
  outputLen: number;
  version: Argon2VersionByte;
  variant: Argon2Variant;
}

/**
 * Deriva uma chave Argon2 chamando o backend Rust.
 *
 * O Rust executa em thread bloqueante (~0,5–1 s para parâmetros KDBX4
 * padrão de 64 MiB / 2 iterações / 2 threads). Não bloqueia o webview.
 */
export async function deriveArgon2Key(
  params: Argon2Params,
): Promise<Uint8Array> {
  // Tauri converte camelCase ↔ snake_case automaticamente nos argumentos.
  const raw = await invoke<number[] | Uint8Array>("argon2_derive_key", {
    password: Array.from(params.password),
    salt: Array.from(params.salt),
    iterations: params.iterations,
    memoryKib: params.memoryKib,
    parallelism: params.parallelism,
    outputLen: params.outputLen,
    version: params.version,
    variant: params.variant,
  });
  return raw instanceof Uint8Array ? raw : new Uint8Array(raw);
}
