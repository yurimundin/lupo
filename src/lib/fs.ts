// Wrappers tipados sobre os comandos Tauri de filesystem.

import { invoke } from "@tauri-apps/api/core";

export interface RecoveryFileInfo {
  path: string;
  exists: boolean;
  size: number | null;
  modifiedMs: number | null;
  hasKdbxMagic: boolean;
}

export interface VaultRecoveryState {
  vault: RecoveryFileInfo;
  tmp: RecoveryFileInfo;
  bak: RecoveryFileInfo;
  needsAttention: boolean;
}

export interface RestoreBackupResult {
  restoredPath: string;
  previousVaultBackupPath: string;
  removedTmp: boolean;
}

/** Verifica se um arquivo existe no caminho indicado (absoluto). */
export async function fileExists(path: string): Promise<boolean> {
  return invoke<boolean>("file_exists", { path });
}

export async function inspectVaultRecovery(
  filePath: string,
): Promise<VaultRecoveryState> {
  return invoke<VaultRecoveryState>("inspect_vault_recovery", { filePath });
}

export async function restoreVaultBackup(
  filePath: string,
): Promise<RestoreBackupResult> {
  return invoke<RestoreBackupResult>("restore_vault_backup", { filePath });
}
