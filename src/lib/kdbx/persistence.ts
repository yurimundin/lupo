import { invoke } from "@tauri-apps/api/core";
import * as kdbxweb from "kdbxweb";

import { describeError } from "./shared";

/** Resultado de `saveVault` — backend pode retornar duração ou erro. */
export type SaveResult =
  | { ok: true; durationMs: number }
  | { ok: false; error: string };

/**
 * Persiste mudanças em um cofre EXISTENTE no disco com backup atômico.
 *
 * Sequência (no backend Rust, ver `save_vault_with_backup` em
 * `src-tauri/src/lib.rs`):
 *   1. Valida que o `.kdbx` atual existe e tem magic bytes corretos.
 *   2. Escreve `.kdbx.bak` (sobrescreve antigo) com `fsync`.
 *   3. Escreve `.kdbx.tmp` (novo conteúdo) com `fsync`.
 *   4. Re-valida magic bytes do `.tmp`.
 *   5. `rename(.tmp → .kdbx)` — atômico em mesmo volume.
 *
 * Garantia: em qualquer falha, o `.kdbx` original permanece íntegro
 * (rename só acontece após validação completa do tmp).
 *
 * Retorna `{ ok: true, durationMs }` ou `{ ok: false, error }`. NÃO
 * lança — chamadores devem tratar via discriminated union.
 *
 * Nota técnica: bytes são serializados como `number[]` (não `Uint8Array`)
 * porque o IPC do Tauri serializa via JSON e `Uint8Array` vira objeto
 * com chaves numéricas em vez de array. `Array.from(uint8)` é o
 * caminho que funciona em ambos os lados.
 *
 * Nota técnica 2: `durationMs` vem do BACKEND (medido em volta do I/O
 * real), não de `performance.now()` do front. Mais preciso porque
 * exclui overhead de serialização IPC.
 */
export async function saveVault(
  filePath: string,
  kdbx: kdbxweb.Kdbx,
): Promise<SaveResult> {
  // Validação local (pré-IPC) — feedback rápido, sem touch no backend.
  if (!filePath || filePath.trim().length === 0) {
    return { ok: false, error: "Caminho do cofre vazio." };
  }
  if (!kdbx) {
    return { ok: false, error: "Cofre inválido (referência nula)." };
  }

  let vaultBytes: number[];
  try {
    const buffer = await kdbx.save();
    const uint8 = new Uint8Array(buffer);
    vaultBytes = Array.from(uint8);
  } catch (e) {
    return {
      ok: false,
      error: `Erro ao serializar cofre: ${describeError(e)}`,
    };
  }

  try {
    // Backend já entrega mensagens PT-BR no caminho de erro — apenas
    // repassamos. Em sucesso, retorna número (ms).
    const durationMs = await invoke<number>("save_vault_with_backup", {
      filePath,
      vaultBytes,
    });
    return { ok: true, durationMs };
  } catch (e) {
    return { ok: false, error: describeError(e) };
  }
}

