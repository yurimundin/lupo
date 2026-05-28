import * as kdbxweb from "kdbxweb";
import type { KdbxEntry } from "kdbxweb";

type EntryField = KdbxEntry["fields"] extends Map<string, infer Field>
  ? Field
  : never;

export interface EntryEditableFields {
  title: string;
  username: string;
  password: string;
  url: string;
  notes: string;
}

export function applyEditableFields(
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

export function copyEditableFields(target: KdbxEntry, source: KdbxEntry): void {
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
