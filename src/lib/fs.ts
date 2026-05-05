// Wrappers tipados sobre os comandos Tauri de filesystem.

import { invoke } from "@tauri-apps/api/core";

/** Verifica se um arquivo existe no caminho indicado (absoluto). */
export async function fileExists(path: string): Promise<boolean> {
  return invoke<boolean>("file_exists", { path });
}
