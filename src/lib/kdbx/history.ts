import * as kdbxweb from "kdbxweb";
import type { Kdbx, KdbxEntry } from "kdbxweb";

import {
  getNotes,
  getPassword,
  getTitle,
  getUrl,
  getUsername,
} from "../entry-helpers";
import { saveVault } from "./persistence";
import { describeError } from "./shared";

type EntryField = KdbxEntry["fields"] extends Map<string, infer Field>
  ? Field
  : never;
type EntryTimes = KdbxEntry["times"];
type EntryEditState = KdbxEntry["_editState"];

export interface EntryEditableFields {
  title: string;
  username: string;
  password: string;
  url: string;
  notes: string;
}

export interface EntryHistoryItem {
  index: number;
  title: string;
  username: string;
  password: string;
  url: string;
  notes: string;
  lastModTime: Date | null;
}

export type UpdateEntryFieldsResult =
  | { ok: true; durationMs: number }
  | { ok: false; error: string };

export type RestoreEntryHistoryResult =
  | { ok: true; durationMs: number }
  | { ok: false; error: string };

interface EntryMutableSnapshot {
  fields: Map<string, EntryField>;
  history: KdbxEntry[];
  times: EntryTimes;
  editState: EntryEditState;
}

export function getEntryHistoryItems(entry: KdbxEntry): EntryHistoryItem[] {
  return entry.history
    .map((historyEntry, index) => ({
      index,
      title: getTitle(historyEntry),
      username: getUsername(historyEntry),
      password: getPassword(historyEntry),
      url: getUrl(historyEntry),
      notes: getNotes(historyEntry),
      lastModTime: historyEntry.times.lastModTime ?? null,
    }))
    .sort((a, b) => {
      const aTime = a.lastModTime?.getTime() ?? 0;
      const bTime = b.lastModTime?.getTime() ?? 0;
      if (aTime !== bTime) return bTime - aTime;
      return b.index - a.index;
    });
}

export async function updateEntryFieldsInVault(
  filePath: string,
  kdbx: Kdbx,
  entry: KdbxEntry,
  fields: EntryEditableFields,
): Promise<UpdateEntryFieldsResult> {
  if (!filePath || !kdbx || !entry) {
    return { ok: false, error: "Estado inválido para salvar entrada." };
  }

  const snapshot = snapshotEntryMutableState(entry);

  try {
    entry.pushHistory();
    applyEditableFields(entry, fields);
    entry.times.update();

    const result = await saveVault(filePath, kdbx);
    if (!result.ok) {
      restoreEntryMutableState(entry, snapshot);
      return { ok: false, error: result.error };
    }

    return { ok: true, durationMs: result.durationMs };
  } catch (e) {
    restoreEntryMutableState(entry, snapshot);
    return {
      ok: false,
      error: `Erro ao salvar entrada: ${describeError(e)}`,
    };
  }
}

export async function restoreEntryHistoryVersionInVault(
  filePath: string,
  kdbx: Kdbx,
  entry: KdbxEntry,
  historyIndex: number,
): Promise<RestoreEntryHistoryResult> {
  if (!filePath || !kdbx || !entry) {
    return { ok: false, error: "Estado inválido para restaurar histórico." };
  }

  const historyEntry = entry.history[historyIndex];
  if (!historyEntry) {
    return { ok: false, error: "Versão de histórico não encontrada." };
  }

  const snapshot = snapshotEntryMutableState(entry);

  try {
    entry.pushHistory();
    copyEditableFields(entry, historyEntry);
    entry.times.update();

    const result = await saveVault(filePath, kdbx);
    if (!result.ok) {
      restoreEntryMutableState(entry, snapshot);
      return { ok: false, error: result.error };
    }

    return { ok: true, durationMs: result.durationMs };
  } catch (e) {
    restoreEntryMutableState(entry, snapshot);
    return {
      ok: false,
      error: `Erro ao restaurar histórico: ${describeError(e)}`,
    };
  }
}

function snapshotEntryMutableState(entry: KdbxEntry): EntryMutableSnapshot {
  return {
    fields: new Map(entry.fields),
    history: [...entry.history],
    times: entry.times.clone(),
    editState: cloneEditState(entry._editState),
  };
}

function restoreEntryMutableState(
  entry: KdbxEntry,
  snapshot: EntryMutableSnapshot,
): void {
  entry.fields.clear();
  for (const [name, value] of snapshot.fields) {
    entry.fields.set(name, value);
  }
  entry.history.splice(0, entry.history.length, ...snapshot.history);
  entry.times = snapshot.times;
  entry._editState = cloneEditState(snapshot.editState);
}

function applyEditableFields(
  entry: KdbxEntry,
  fields: EntryEditableFields,
): void {
  entry.fields.set("Title", fields.title);
  entry.fields.set("UserName", fields.username);
  entry.fields.set(
    "Password",
    kdbxweb.ProtectedValue.fromString(fields.password),
  );
  entry.fields.set("URL", fields.url);
  entry.fields.set("Notes", fields.notes);
}

function copyEditableFields(target: KdbxEntry, source: KdbxEntry): void {
  for (const fieldName of ["Title", "UserName", "Password", "URL", "Notes"]) {
    target.fields.set(fieldName, cloneEntryField(source.fields.get(fieldName)));
  }
}

function cloneEntryField(value: EntryField | undefined): EntryField {
  if (!value) return "";
  if (
    typeof value === "object" &&
    value !== null &&
    "clone" in value &&
    typeof value.clone === "function"
  ) {
    return value.clone() as EntryField;
  }
  return value;
}

function cloneEditState(editState: EntryEditState): EntryEditState {
  if (!editState) return undefined;
  return {
    added: [...(editState.added ?? [])],
    deleted: [...(editState.deleted ?? [])],
  };
}
