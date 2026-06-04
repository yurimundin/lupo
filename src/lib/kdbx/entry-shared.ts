import type { KdbxEntry, KdbxGroup } from "kdbxweb";

export type KdbxEntryCustomDataItem =
  NonNullable<KdbxEntry["customData"]> extends Map<string, infer Item>
    ? Item
    : never;

export function isGroupInRecycleBinSubtree(
  group: KdbxGroup | undefined,
  recycleBin: KdbxGroup | undefined,
): boolean {
  if (!group || !recycleBin) return false;
  let current: KdbxGroup | undefined = group;
  while (current) {
    if (current === recycleBin) return true;
    current = current.parentGroup;
  }
  return false;
}

export function rollbackCreatedEntry(
  parent: KdbxGroup,
  entry: KdbxEntry,
): void {
  const idx = parent.entries.indexOf(entry);
  if (idx >= 0) parent.entries.splice(idx, 1);
  entry.parentGroup = undefined;
}
