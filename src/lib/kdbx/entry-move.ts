import type { Kdbx, KdbxEntry, KdbxGroup } from "kdbxweb";

import { isGroupInRecycleBinSubtree } from "./entry-shared";
import { saveVault } from "./persistence";
import { describeError } from "./shared";

export type MoveEntryResult =
  | { ok: true; durationMs: number }
  | { ok: false; error: string };

export async function moveEntryToGroup(
  filePath: string,
  kdbx: Kdbx,
  entry: KdbxEntry,
  targetGroup: KdbxGroup,
): Promise<MoveEntryResult> {
  if (!filePath || !kdbx || !entry || !targetGroup) {
    return { ok: false, error: "Estado inválido para mover entrada." };
  }

  try {
    const originalParent = entry.parentGroup;
    if (!originalParent) {
      return {
        ok: false,
        error: "Grupo original da entrada não encontrado.",
      };
    }

    if (originalParent === targetGroup) {
      return { ok: false, error: "Entrada já está nesta pasta." };
    }

    let recycleBin: KdbxGroup | undefined;
    const recycleBinUuid = kdbx.meta.recycleBinUuid;
    if (recycleBinUuid && !recycleBinUuid.empty) {
      recycleBin = kdbx.getGroup(recycleBinUuid);
    }

    if (
      isGroupInRecycleBinSubtree(originalParent, recycleBin) ||
      isGroupInRecycleBinSubtree(targetGroup, recycleBin)
    ) {
      return {
        ok: false,
        error: "Mover entradas envolvendo a Lixeira não é permitido.",
      };
    }

    kdbx.move(entry, targetGroup);

    const result = await saveVault(filePath, kdbx);
    if (!result.ok) {
      kdbx.move(entry, originalParent);
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
