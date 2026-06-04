import type { Kdbx, KdbxEntry, KdbxGroup } from "kdbxweb";

import {
  isGroupInRecycleBinSubtree,
  rollbackCreatedEntry,
  type KdbxEntryCustomDataItem,
} from "./entry-shared";
import { saveVault } from "./persistence";
import { describeError } from "./shared";

type KdbxEntryField = KdbxEntry["fields"] extends Map<string, infer Field>
  ? Field
  : never;
type KdbxEntryBinary = KdbxEntry["binaries"] extends Map<string, infer Binary>
  ? Binary
  : never;

export type DuplicateEntryResult =
  | { ok: true; entry: KdbxEntry; durationMs: number }
  | { ok: false; error: string };

export async function duplicateEntryInVault(
  filePath: string,
  kdbx: Kdbx,
  source: KdbxEntry,
): Promise<DuplicateEntryResult> {
  if (!filePath || !kdbx || !source) {
    return { ok: false, error: "Estado inválido para duplicar entrada." };
  }

  const parent = source.parentGroup;
  if (!parent) {
    return { ok: false, error: "Grupo da entrada não encontrado." };
  }

  let duplicate: KdbxEntry | null = null;
  try {
    let recycleBin: KdbxGroup | undefined;
    const recycleBinUuid = kdbx.meta.recycleBinUuid;
    if (recycleBinUuid && !recycleBinUuid.empty) {
      recycleBin = kdbx.getGroup(recycleBinUuid);
    }

    if (isGroupInRecycleBinSubtree(parent, recycleBin)) {
      return {
        ok: false,
        error: "Duplicar entradas da Lixeira não é permitido.",
      };
    }

    duplicate = kdbx.createEntry(parent);
    copyEntryForDuplicate(duplicate, source);
    duplicate.times.update();

    const result = await saveVault(filePath, kdbx);
    if (!result.ok) {
      rollbackCreatedEntry(parent, duplicate);
      return { ok: false, error: result.error };
    }

    return { ok: true, entry: duplicate, durationMs: result.durationMs };
  } catch (e) {
    if (duplicate) rollbackCreatedEntry(parent, duplicate);
    return {
      ok: false,
      error: `Erro ao duplicar entrada: ${describeError(e)}`,
    };
  }
}

function copyEntryForDuplicate(target: KdbxEntry, source: KdbxEntry): void {
  target.fields.clear();
  for (const [name, value] of source.fields) {
    target.fields.set(name, cloneEntryField(value));
  }
  target.fields.set("Title", duplicateTitle(fieldText(source, "Title")));

  target.binaries = new Map(source.binaries) as Map<string, KdbxEntryBinary>;
  target.customData = cloneEntryCustomData(source.customData);
  target.history = [];
}

function duplicateTitle(title: string): string {
  const trimmed = title.trim();
  return trimmed.length > 0 ? `${trimmed} (cópia)` : "(sem título) (cópia)";
}

function fieldText(entry: KdbxEntry, name: string): string {
  const value = entry.fields.get(name);
  if (typeof value === "string") return value;
  if (
    value &&
    typeof value === "object" &&
    "getText" in value &&
    typeof value.getText === "function"
  ) {
    return value.getText() as string;
  }
  return "";
}

function cloneEntryField(value: KdbxEntryField): KdbxEntryField {
  if (
    value &&
    typeof value === "object" &&
    "clone" in value &&
    typeof value.clone === "function"
  ) {
    return value.clone() as KdbxEntryField;
  }
  return value;
}

function cloneEntryCustomData(
  customData: KdbxEntry["customData"],
): KdbxEntry["customData"] {
  if (!customData) return undefined;
  const clone = new Map<string, KdbxEntryCustomDataItem>();
  for (const [key, item] of customData) {
    clone.set(key, { ...item });
  }
  return clone as KdbxEntry["customData"];
}
