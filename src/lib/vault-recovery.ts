import type { VaultRecoveryState } from "@/services/tauri/fs";

export function shouldShowRecoveryPrompt(
  state: VaultRecoveryState | null,
): boolean {
  return !!state?.needsAttention;
}

export function canRestoreBackup(state: VaultRecoveryState | null): boolean {
  return !!state?.bak.exists && state.bak.hasKdbxMagic;
}

export function getRecoverySummary(state: VaultRecoveryState): string {
  if (state.tmp.exists && canRestoreBackup(state)) {
    return "Encontramos uma gravacao interrompida e um backup valido ao lado deste cofre.";
  }
  if (state.tmp.exists) {
    return "Encontramos uma gravacao interrompida ao lado deste cofre.";
  }
  if (!state.vault.hasKdbxMagic && canRestoreBackup(state)) {
    return "O cofre atual parece inconsistente, mas existe um backup valido para restaurar.";
  }
  return "Existe informacao de recuperacao ao lado deste cofre.";
}
