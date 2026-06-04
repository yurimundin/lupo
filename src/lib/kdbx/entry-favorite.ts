import type { Kdbx, KdbxEntry } from "kdbxweb";

import {
  LUPO_ENTRY_FAVORITE_KEYS,
  setEntryFavorite,
} from "../entry-helpers";
import { type KdbxEntryCustomDataItem } from "./entry-shared";
import { saveVault } from "./persistence";
import { describeError } from "./shared";

export type SetEntryFavoriteResult =
  | { ok: true; durationMs: number }
  | { ok: false; error: string };

export async function setEntryFavoriteInVault(
  filePath: string,
  kdbx: Kdbx,
  entry: KdbxEntry,
  favorite: boolean,
): Promise<SetEntryFavoriteResult> {
  if (!filePath || !kdbx || !entry) {
    return { ok: false, error: "Estado inválido para favoritar entrada." };
  }

  const snapshot = {
    hadCustomData: !!entry.customData,
    oldFavoriteItems: snapshotEntryCustomDataItems(
      entry,
      LUPO_ENTRY_FAVORITE_KEYS,
    ),
  };

  try {
    setEntryFavorite(entry, favorite);
    entry.times.update();

    const result = await saveVault(filePath, kdbx);
    if (!result.ok) {
      restoreEntryFavoriteSnapshot(entry, snapshot);
      return { ok: false, error: result.error };
    }

    return { ok: true, durationMs: result.durationMs };
  } catch (e) {
    restoreEntryFavoriteSnapshot(entry, snapshot);
    return {
      ok: false,
      error: `Erro ao favoritar entrada: ${describeError(e)}`,
    };
  }
}

function restoreEntryFavoriteSnapshot(
  entry: KdbxEntry,
  snapshot: {
    hadCustomData: boolean;
    oldFavoriteItems: Map<string, KdbxEntryCustomDataItem>;
  },
): void {
  if (!snapshot.hadCustomData) {
    entry.customData = undefined;
    return;
  }

  entry.customData ??= new Map();
  for (const key of LUPO_ENTRY_FAVORITE_KEYS) {
    const item = snapshot.oldFavoriteItems.get(key);
    if (item) {
      entry.customData.set(key, item);
    } else {
      entry.customData.delete(key);
    }
  }
}

function snapshotEntryCustomDataItems(
  entry: KdbxEntry,
  keys: readonly string[],
): Map<string, KdbxEntryCustomDataItem> {
  const snapshot = new Map<string, KdbxEntryCustomDataItem>();
  for (const key of keys) {
    const item = entry.customData?.get(key) as
      | KdbxEntryCustomDataItem
      | undefined;
    if (item) snapshot.set(key, item);
  }
  return snapshot;
}
