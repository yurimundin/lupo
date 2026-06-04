import type { Kdbx, KdbxEntry, KdbxGroup } from "kdbxweb";

import { saveVault } from "./persistence";
import { describeError } from "./shared";

export type DeleteResult =
  | { ok: true; durationMs: number }
  | { ok: false; error: string };

export type RestoreResult =
  | { ok: true; durationMs: number }
  | { ok: false; error: string };

export type EmptyRecycleBinResult =
  | { ok: true; durationMs: number; entriesDeleted: number }
  | { ok: false; error: string };

export async function moveEntryToRecycleBin(
  filePath: string,
  kdbx: Kdbx,
  entry: KdbxEntry,
): Promise<DeleteResult> {
  if (!filePath || !kdbx || !entry) {
    return { ok: false, error: "Estado inválido para mover entrada." };
  }

  try {
    const originalParent = entry.parentGroup;
    let recycleBin = getRecycleBin(kdbx);

    if (!recycleBin) {
      kdbx.createRecycleBin();
      recycleBin = getRecycleBin(kdbx);
      if (!recycleBin) {
        return { ok: false, error: "Falha ao criar grupo Lixeira no cofre." };
      }
    }

    if (entry.parentGroup === recycleBin) {
      return { ok: false, error: "Entrada já está na Lixeira." };
    }

    kdbx.move(entry, recycleBin);

    const result = await saveVault(filePath, kdbx);
    if (!result.ok) {
      if (originalParent) kdbx.move(entry, originalParent);
      return { ok: false, error: result.error };
    }

    return { ok: true, durationMs: result.durationMs };
  } catch (e) {
    return {
      ok: false,
      error: `Erro ao mover entrada: ${describeError(e)}`,
    };
  }
}

export async function restoreEntryFromRecycleBin(
  filePath: string,
  kdbx: Kdbx,
  entry: KdbxEntry,
): Promise<RestoreResult> {
  if (!filePath || !kdbx || !entry) {
    return { ok: false, error: "Estado inválido para restaurar entrada." };
  }

  try {
    const recycleBin = getRecycleBin(kdbx);
    if (!recycleBin) {
      return { ok: false, error: "Grupo Lixeira não encontrado no cofre." };
    }
    if (entry.parentGroup !== recycleBin) {
      return { ok: false, error: "Esta entrada não está na Lixeira." };
    }

    const root = kdbx.getDefaultGroup();
    if (!root) {
      return { ok: false, error: "Grupo raiz não encontrado no cofre." };
    }

    const originalParent = entry.parentGroup;
    kdbx.move(entry, root);

    const result = await saveVault(filePath, kdbx);
    if (!result.ok) {
      if (originalParent) kdbx.move(entry, originalParent);
      return { ok: false, error: result.error };
    }

    return { ok: true, durationMs: result.durationMs };
  } catch (e) {
    return {
      ok: false,
      error: `Erro ao restaurar entrada: ${describeError(e)}`,
    };
  }
}

export async function emptyRecycleBin(
  filePath: string,
  kdbx: Kdbx,
): Promise<EmptyRecycleBinResult> {
  if (!filePath || !kdbx) {
    return { ok: false, error: "Estado inválido para esvaziar Lixeira." };
  }

  let recycleBin: KdbxGroup | undefined;
  let originalEntries: KdbxEntry[] = [];
  let tombstoneCountBefore = 0;

  try {
    recycleBin = getRecycleBin(kdbx);
    if (!recycleBin) {
      return { ok: false, error: "Grupo Lixeira não encontrado no cofre." };
    }

    originalEntries = [...recycleBin.entries];
    const count = originalEntries.length;
    tombstoneCountBefore = kdbx.deletedObjects.length;

    if (count === 0) {
      return { ok: false, error: "Lixeira já está vazia." };
    }

    for (const entry of originalEntries) {
      kdbx.move(entry, undefined);
    }

    const result = await saveVault(filePath, kdbx);
    if (!result.ok) {
      rollbackEmptyRecycleBin(kdbx, recycleBin, originalEntries, tombstoneCountBefore);
      return { ok: false, error: result.error };
    }

    return {
      ok: true,
      durationMs: result.durationMs,
      entriesDeleted: count,
    };
  } catch (e) {
    if (recycleBin && originalEntries.length > 0) {
      rollbackEmptyRecycleBin(kdbx, recycleBin, originalEntries, tombstoneCountBefore);
    }
    return {
      ok: false,
      error: `Erro ao esvaziar Lixeira: ${describeError(e)}`,
    };
  }
}

function getRecycleBin(kdbx: Kdbx): KdbxGroup | undefined {
  const recycleBinUuid = kdbx.meta.recycleBinUuid;
  if (!recycleBinUuid || recycleBinUuid.empty) return undefined;
  return kdbx.getGroup(recycleBinUuid);
}

function rollbackEmptyRecycleBin(
  kdbx: Kdbx,
  recycleBin: KdbxGroup,
  originalEntries: KdbxEntry[],
  tombstoneCountBefore: number,
): void {
  recycleBin.entries.splice(0, recycleBin.entries.length, ...originalEntries);
  for (const entry of originalEntries) {
    entry.parentGroup = recycleBin;
  }
  kdbx.deletedObjects.length = tombstoneCountBefore;
}
