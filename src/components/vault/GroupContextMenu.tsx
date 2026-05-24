import type { KdbxGroup } from "kdbxweb";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

type Props = {
  group: KdbxGroup;
  recycleBinUuidId: string | null;
  onCreateSubgroup: (group: KdbxGroup) => void;
  onChangeIcon: (group: KdbxGroup) => void;
  onRename: (group: KdbxGroup) => void;
  onDelete: (group: KdbxGroup) => void;
  onRestore: (group: KdbxGroup) => void;
  children: React.ReactNode;
};

/**
 * Checa se um grupo é o root (default group) do cofre.
 * Root é o único grupo sem parentGroup.
 */
function isRoot(group: KdbxGroup): boolean {
  return !group.parentGroup;
}

/**
 * Walk-up para detectar se o grupo é a Lixeira ou descendente dela.
 * Padrão consistente com isInRecycleBinSubtree do GroupSidebar (S24).
 */
function isInRecycleBinSubtree(
  group: KdbxGroup,
  recycleBinUuidId: string | null,
): boolean {
  if (!recycleBinUuidId) return false;
  let current: KdbxGroup | undefined = group;
  while (current) {
    if (current.uuid.id === recycleBinUuidId) return true;
    current = current.parentGroup;
  }
  return false;
}

/**
 * Checa se o grupo é filho DIRETO da Lixeira.
 * Esses grupos são elegíveis para "Restaurar"; subgrupos mais
 * profundos (filhos de grupos na Lixeira) não são.
 */
function isDirectChildOfRecycleBin(
  group: KdbxGroup,
  recycleBinUuidId: string | null,
): boolean {
  if (!recycleBinUuidId) return false;
  return group.parentGroup?.uuid.id === recycleBinUuidId;
}

/**
 * Wrapper que adiciona context menu (right-click) aos itens da
 * árvore de grupos.
 *
 * Comportamento condicional (4 estados):
 * - Filho direto da Lixeira: "Restaurar para o grupo raiz" (único item).
 *   Subgrupos de grupos na Lixeira ou a Lixeira em si: SEM menu.
 * - Root: apenas "Novo subgrupo" (rename/delete não fazem sentido).
 * - Normal: 3 itens — Novo subgrupo, Renomear, separator, Mover para
 *   Lixeira.
 *
 * Callbacks recebem o KdbxGroup target (não uuid) para evitar
 * re-lookup no caller. Caller (GroupSidebar) já resolve o group
 * antes de passar como prop.
 */
export function GroupContextMenu({
  group,
  recycleBinUuidId,
  onCreateSubgroup,
  onChangeIcon,
  onRename,
  onDelete,
  onRestore,
  children,
}: Props) {
  // Filho direto da Lixeira: menu de restauração (verificar antes do
  // subtree check genérico, pois isInRecycleBinSubtree também retorna
  // true para filhos diretos).
  if (isDirectChildOfRecycleBin(group, recycleBinUuidId)) {
    return (
      <ContextMenu>
        <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
        <ContextMenuContent className="w-56">
          <ContextMenuItem onClick={() => onRestore(group)}>
            Restaurar para o grupo raiz
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
  }

  // Lixeira em si ou subgrupos mais profundos: sem menu.
  if (isInRecycleBinSubtree(group, recycleBinUuidId)) {
    return <>{children}</>;
  }

  const isRootGroup = isRoot(group);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        <ContextMenuItem onClick={() => onCreateSubgroup(group)}>
          Novo subgrupo
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onChangeIcon(group)}>
          Alterar icone
        </ContextMenuItem>
        {!isRootGroup && (
          <>
            <ContextMenuItem onClick={() => onRename(group)}>
              Renomear
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem
              onClick={() => onDelete(group)}
              className="text-destructive focus:text-destructive"
            >
              Mover para Lixeira
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}
