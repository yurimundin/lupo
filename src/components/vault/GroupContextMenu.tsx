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
  onRename: (group: KdbxGroup) => void;
  onDelete: (group: KdbxGroup) => void;
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
 * Wrapper que adiciona context menu (right-click) aos itens da
 * árvore de grupos.
 *
 * Comportamento condicional:
 * - Lixeira ou descendente: SEM wrapper (right-click default do
 *   browser; não há ações úteis no menu). Retorna apenas children.
 * - Root: apenas "Novo subgrupo" (rename/delete não fazem sentido
 *   para o root group).
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
  onRename,
  onDelete,
  children,
}: Props) {
  // Lixeira ou descendente: sem menu, retorna children direto
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
