import type { Kdbx, KdbxEntry, KdbxGroup } from "kdbxweb";

import { applyEditableFields, type EntryEditableFields } from "./entry-fields";
import { rollbackCreatedEntry } from "./entry-shared";
import { saveVault } from "./persistence";
import { describeError } from "./shared";

export type CreateEntryResult =
  | { ok: true; entry: KdbxEntry; durationMs: number }
  | { ok: false; error: string };

export async function createEntryInVault(
  filePath: string,
  kdbx: Kdbx,
  parent: KdbxGroup,
  fields: EntryEditableFields,
): Promise<CreateEntryResult> {
  if (!filePath || !kdbx || !parent) {
    return { ok: false, error: "Estado inválido para criar entrada." };
  }

  let entry: KdbxEntry | null = null;
  try {
    entry = kdbx.createEntry(parent);
    applyEditableFields(entry, fields);
    entry.times.update();

    const result = await saveVault(filePath, kdbx);
    if (!result.ok) {
      rollbackCreatedEntry(parent, entry);
      return { ok: false, error: result.error };
    }

    return { ok: true, entry, durationMs: result.durationMs };
  } catch (e) {
    if (entry) rollbackCreatedEntry(parent, entry);
    return {
      ok: false,
      error: `Erro ao criar entrada: ${describeError(e)}`,
    };
  }
}
