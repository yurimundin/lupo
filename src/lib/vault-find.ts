import type { Kdbx, KdbxEntry, KdbxGroup } from "kdbxweb";

/**
 * Busca a entrada por UUID em qualquer nível da árvore. Útil em handlers
 * de eventos globais (ex.: Ctrl+C copia senha da entry selecionada).
 * Retorna `null` se não encontrar.
 */
export function findEntryByUuidIdInDb(
  db: Kdbx,
  entryUuidId: string,
): KdbxEntry | null {
  return findEntryRecursive(db.getDefaultGroup(), entryUuidId);
}

function findEntryRecursive(
  group: KdbxGroup,
  entryUuidId: string,
): KdbxEntry | null {
  const direct = group.entries.find((e) => e.uuid.id === entryUuidId);
  if (direct) return direct;
  for (const sub of group.groups) {
    const hit = findEntryRecursive(sub, entryUuidId);
    if (hit) return hit;
  }
  return null;
}

/** Busca um grupo por UUID em qualquer nível da árvore. */
export function findGroupByUuidIdInDb(
  db: Kdbx,
  groupUuidId: string,
): KdbxGroup | null {
  return findGroupByUuidId(db.getDefaultGroup(), groupUuidId);
}

export function findGroupByUuidId(
  root: KdbxGroup,
  uuidId: string,
): KdbxGroup | null {
  if (root.uuid.id === uuidId) return root;
  for (const sub of root.groups) {
    const hit = findGroupByUuidId(sub, uuidId);
    if (hit) return hit;
  }
  return null;
}

export function findGroupContainingEntry(
  root: KdbxGroup,
  entryUuidId: string | null,
): KdbxGroup | null {
  if (!entryUuidId) return null;
  if (root.entries.some((e) => e.uuid.id === entryUuidId)) return root;
  for (const sub of root.groups) {
    const hit = findGroupContainingEntry(sub, entryUuidId);
    if (hit) return hit;
  }
  return null;
}
