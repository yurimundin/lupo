import type { Kdbx, KdbxGroup } from "kdbxweb";

import {
  LUPO_GROUP_ICON_COLOR_KEYS,
  LUPO_GROUP_ICON_KEYS,
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
 * Salva o icone visual Lupo em `customData` do grupo.
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
  const oldIconItems = snapshotGroupCustomDataItems(
    group,
    LUPO_GROUP_ICON_KEYS,
  );
  const oldColorItems = snapshotGroupCustomDataItems(
    group,
    LUPO_GROUP_ICON_COLOR_KEYS,
  );

  try {
    setGroupLucideIconId(group, iconId);
    setGroupIconColorId(group, colorId);
    group.times.update();

    const result = await saveVault(filePath, kdbx);
    if (!result.ok) {
      restoreGroupVisualCustomData(group, {
        hadCustomData,
        oldIconItems,
        oldColorItems,
      });
      return { ok: false, error: result.error };
    }

    return { ok: true, durationMs: result.durationMs };
  } catch (e) {
    restoreGroupVisualCustomData(group, {
      hadCustomData,
      oldIconItems,
      oldColorItems,
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
    oldIconItems: Map<string, KdbxGroupCustomDataItem>;
    oldColorItems: Map<string, KdbxGroupCustomDataItem>;
  },
): void {
  if (!snapshot.hadCustomData) {
    group.customData = undefined;
    return;
  }

  group.customData ??= new Map();
  for (const key of LUPO_GROUP_ICON_KEYS) {
    const item = snapshot.oldIconItems.get(key);
    if (item) {
      group.customData.set(key, item);
    } else {
      group.customData.delete(key);
    }
  }

  for (const key of LUPO_GROUP_ICON_COLOR_KEYS) {
    const item = snapshot.oldColorItems.get(key);
    if (item) {
      group.customData.set(key, item);
    } else {
      group.customData.delete(key);
    }
  }
}

function snapshotGroupCustomDataItems(
  group: KdbxGroup,
  keys: readonly string[],
): Map<string, KdbxGroupCustomDataItem> {
  const snapshot = new Map<string, KdbxGroupCustomDataItem>();
  for (const key of keys) {
    const item = group.customData?.get(key);
    if (item) snapshot.set(key, item);
  }
  return snapshot;
}
