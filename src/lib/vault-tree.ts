import type { KdbxGroup } from "kdbxweb";

import {
  getGroupIconColorId,
  getGroupLucideIconId,
  type GroupIconColorId,
  type GroupLucideIconId,
} from "./group-icons";

/**
 * Nó da árvore de grupos do cofre, pré-computado para a sidebar
 * recursiva (Sessão 11).
 *
 * - `name` já passa por `getGroupDisplayName` (Lixeira i18n).
 * - `entryCount` é a contagem direta de entries do próprio grupo,
 *   sem somar entries de subgrupos (consistência com a contagem
 *   exibida hoje no badge à direita).
 * - `parentUuid === null` apenas no nó raiz.
 */
export interface GroupTreeNode {
  uuid: string;
  name: string;
  iconId: GroupLucideIconId | null;
  iconColorId: GroupIconColorId | null;
  depth: number;
  children: GroupTreeNode[];
  parentUuid: string | null;
  isRecycleBin: boolean;
  entryCount: number;
}

export type MoveEntryTargetDisabledReason = "current-group" | null;

export interface MoveEntryTargetOption {
  uuid: string;
  name: string;
  depth: number;
  group: KdbxGroup;
  disabled: boolean;
  disabledReason: MoveEntryTargetDisabledReason;
  entryCount: number;
  iconId: GroupLucideIconId | null;
  iconColorId: GroupIconColorId | null;
}

export function buildGroupTreeNode(
  group: KdbxGroup,
  depth: number,
  parentUuid: string | null,
  recycleBinUuidId: string | null,
): GroupTreeNode {
  const uuidId = group.uuid.id;
  return {
    uuid: uuidId,
    name: getGroupDisplayName(group, recycleBinUuidId),
    iconId: getGroupLucideIconId(group),
    iconColorId: getGroupIconColorId(group),
    depth,
    children: sortGroupsForDisplay(group.groups, recycleBinUuidId).map((child) =>
      buildGroupTreeNode(child, depth + 1, uuidId, recycleBinUuidId),
    ),
    parentUuid,
    isRecycleBin: recycleBinUuidId !== null && uuidId === recycleBinUuidId,
    entryCount: group.entries.length,
  };
}

function sortGroupsForDisplay(
  groups: KdbxGroup[],
  recycleBinUuidId: string | null,
): KdbxGroup[] {
  return [...groups].sort((a, b) => {
    const aIsRecycleBin = recycleBinUuidId !== null && a.uuid.id === recycleBinUuidId;
    const bIsRecycleBin = recycleBinUuidId !== null && b.uuid.id === recycleBinUuidId;

    if (aIsRecycleBin && !bIsRecycleBin) return 1;
    if (!aIsRecycleBin && bIsRecycleBin) return -1;

    return getGroupDisplayName(a, recycleBinUuidId).localeCompare(
      getGroupDisplayName(b, recycleBinUuidId),
      "pt-BR",
      { sensitivity: "base" },
    );
  });
}

export function buildGroupTree(
  root: KdbxGroup,
  recycleBinUuidId: string | null,
): GroupTreeNode[] {
  return [buildGroupTreeNode(root, 0, null, recycleBinUuidId)];
}

export function buildMoveEntryTargetOptions(
  root: KdbxGroup,
  currentGroupUuid: string | null,
  recycleBinUuidId: string | null,
): MoveEntryTargetOption[] {
  const out: MoveEntryTargetOption[] = [];

  function walk(group: KdbxGroup, depth: number) {
    const uuid = group.uuid.id;
    if (recycleBinUuidId && uuid === recycleBinUuidId) return;

    const isCurrentGroup = currentGroupUuid !== null && uuid === currentGroupUuid;
    out.push({
      uuid,
      name: getGroupDisplayName(group, recycleBinUuidId),
      depth,
      group,
      disabled: isCurrentGroup,
      disabledReason: isCurrentGroup ? "current-group" : null,
      entryCount: group.entries.length,
      iconId: getGroupLucideIconId(group),
      iconColorId: getGroupIconColorId(group),
    });

    for (const child of sortGroupsForDisplay(group.groups, recycleBinUuidId)) {
      walk(child, depth + 1);
    }
  }

  walk(root, 0);
  return out;
}

/**
 * Retorna o nome de exibição de um grupo, traduzindo "Recycle Bin" para
 * "Lixeira" quando o grupo é a Lixeira do cofre.
 *
 * IMPORTANTE: NÃO altera o `group.name` interno do XML. O grupo continua
 * com nome canônico ("Recycle Bin") no arquivo `.kdbx` para
 * compatibilidade com KeePassXC e demais clientes KeePass do ecossistema
 * (que tratam "Recycle Bin" como o nome convencional internacionalizado
 * pelo próprio cliente). A tradução é estritamente de renderização.
 *
 * Função pura — combinar com `useRecycleBinUuidId()` no componente
 * chamador. Não tem hook próprio porque a derivação é trivial.
 */
export function getGroupDisplayName(
  group: KdbxGroup,
  recycleBinUuidId: string | null,
): string {
  if (recycleBinUuidId && group.uuid.id === recycleBinUuidId) {
    return "Lixeira";
  }
  return group.name || "(sem nome)";
}
