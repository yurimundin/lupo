import type { Kdbx, KdbxGroup } from "kdbxweb";

import {
  SEC_BASIS_GROUP_ICON_COLOR_KEY,
  SEC_BASIS_GROUP_ICON_KEY,
  setGroupIconColorId,
  setGroupLucideIconId,
  type GroupIconColorId,
  type GroupLucideIconId,
} from "../group-icons";

import { saveVault } from "./persistence";
import { describeError } from "./shared";

type KdbxGroupCustomDataItem = NonNullable<KdbxGroup["customData"]> extends Map<
  string,
  infer Item
>
  ? Item
  : never;

/** Resultado de `setGroupVisualIconInVault` - sucesso ou erro. */
export type SetGroupVisualIconResult =
  | { ok: true; durationMs: number }
  | { ok: false; error: string };

/**
 * Salva o icone visual Sec.Basis em `customData` do grupo.
 *
 * Isso nao altera o `IconID` nativo do KeePass: clientes KeePass continuam
 * abrindo o cofre normalmente e ignoram esse metadado especifico do app.
 */
export async function setGroupVisualIconInVault(
  filePath: string,
  kdbx: Kdbx,
  group: KdbxGroup,
  iconId: GroupLucideIconId | null,
  colorId: GroupIconColorId | null = null,
): Promise<SetGroupVisualIconResult> {
  if (!filePath || !kdbx || !group) {
    return { ok: false, error: "Estado invalido para alterar icone do grupo." };
  }

  const hadCustomData = !!group.customData;
  const oldIconItem = group.customData?.get(SEC_BASIS_GROUP_ICON_KEY);
  const oldColorItem = group.customData?.get(SEC_BASIS_GROUP_ICON_COLOR_KEY);

  try {
    setGroupLucideIconId(group, iconId);
    setGroupIconColorId(group, colorId);
    group.times.update();

    const result = await saveVault(filePath, kdbx);
    if (!result.ok) {
      restoreGroupVisualCustomData(group, {
        hadCustomData,
        oldIconItem,
        oldColorItem,
      });
      return { ok: false, error: result.error };
    }

    return { ok: true, durationMs: result.durationMs };
  } catch (e) {
    restoreGroupVisualCustomData(group, {
      hadCustomData,
      oldIconItem,
      oldColorItem,
    });
    return {
      ok: false,
      error: `Erro ao alterar icone do grupo: ${describeError(e)}`,
    };
  }
}

function restoreGroupVisualCustomData(
  group: KdbxGroup,
  snapshot: {
    hadCustomData: boolean;
    oldIconItem: KdbxGroupCustomDataItem | undefined;
    oldColorItem: KdbxGroupCustomDataItem | undefined;
  },
): void {
  if (!snapshot.hadCustomData) {
    group.customData = undefined;
    return;
  }

  if (snapshot.oldIconItem) {
    group.customData?.set(SEC_BASIS_GROUP_ICON_KEY, snapshot.oldIconItem);
  } else {
    group.customData?.delete(SEC_BASIS_GROUP_ICON_KEY);
  }

  if (snapshot.oldColorItem) {
    group.customData?.set(
      SEC_BASIS_GROUP_ICON_COLOR_KEY,
      snapshot.oldColorItem,
    );
  } else {
    group.customData?.delete(SEC_BASIS_GROUP_ICON_COLOR_KEY);
  }
}

