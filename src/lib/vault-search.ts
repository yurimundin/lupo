import type { KdbxEntry, KdbxGroup } from "kdbxweb";

/**
 * Walk recursivo sobre `group.groups`, coletando entries para busca.
 * Pula a Lixeira inteira (e qualquer subgrupo dela) — quando o grupo
 * atual é a Lixeira, retorna sem descer.
 */
export function collectEntriesForSearch(
  root: KdbxGroup,
  recycleBinUuidId: string | null,
): KdbxEntry[] {
  const acc: KdbxEntry[] = [];
  collectEntriesRecursive(root, acc, recycleBinUuidId);
  return acc;
}

function collectEntriesRecursive(
  group: KdbxGroup,
  acc: KdbxEntry[],
  recycleBinUuidId: string | null,
): void {
  if (recycleBinUuidId !== null && group.uuid.id === recycleBinUuidId) {
    return;
  }
  for (const entry of group.entries) {
    acc.push(entry);
  }
  for (const child of group.groups) {
    collectEntriesRecursive(child, acc, recycleBinUuidId);
  }
}

