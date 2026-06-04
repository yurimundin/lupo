// Item recursivo da sidebar — renderiza um grupo do cofre com suporte
// a expandir/colapsar e indentação proporcional à profundidade.
//
// UX:
//   - DOIS botões separados (chevron + nome). Clique no nome seleciona o
//     grupo; clique no chevron alterna expand/collapse. Sem
//     `stopPropagation` necessário porque os elementos clicáveis são
//     diferentes (semântica HTML correta).
//   - Indentação 12px por nível, saturando em 96px após nível 8 (estilo
//     VS Code Explorer): texto sempre legível, hierarquia visível.
//   - Nó raiz (`forceExpanded`) NÃO renderiza chevron — sempre mostra
//     filhos (faz sentido pro "container do cofre", evita confusão de
//     "por que não posso colapsar o cofre?").
//   - Folhas (sem children) reservam espaço de chevron pra alinhar com
//     o ícone Folder dos pares que têm chevron.

import { ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import type { KdbxGroup } from "kdbxweb";
import { useState } from "react";

import { ENTRY_DRAG_MIME } from "@/lib/drag-drop";
import { GROUP_ICON_BY_ID, GROUP_ICON_COLOR_BY_ID } from "@/lib/group-icons";
import { cn } from "@/lib/utils";
import type { GroupTreeNode } from "@/lib/vault-tree";

import { GroupContextMenu } from "./GroupContextMenu";

const INDENT_PX_PER_LEVEL = 12;
const INDENT_PX_MAX = 96;
const BASE_LEFT_PADDING_PX = 8;

export interface GroupTreeItemProps {
  node: GroupTreeNode;
  selectedGroupUuid: string | null;
  expanded: boolean;
  forceExpanded?: boolean;
  onSelect: (uuid: string) => void;
  onToggleExpanded: (uuid: string) => void;
  isExpanded: (uuid: string) => boolean;
  recycleBinUuidId: string | null;
  getGroupByUuid: (uuid: string) => KdbxGroup | null;
  onCreateSubgroup: (group: KdbxGroup) => void;
  onChangeIcon: (group: KdbxGroup) => void;
  onRename: (group: KdbxGroup) => void;
  onDelete: (group: KdbxGroup) => void;
  onRestore: (group: KdbxGroup) => void;
  onMoveEntryToGroup: (entryUuid: string, targetGroup: KdbxGroup) => void;
}

export function GroupTreeItem({
  node,
  selectedGroupUuid,
  expanded,
  forceExpanded = false,
  onSelect,
  onToggleExpanded,
  isExpanded,
  recycleBinUuidId,
  getGroupByUuid,
  onCreateSubgroup,
  onChangeIcon,
  onRename,
  onDelete,
  onRestore,
  onMoveEntryToGroup,
}: GroupTreeItemProps) {
  const [dragOver, setDragOver] = useState(false);
  const selected = node.uuid === selectedGroupUuid;
  const hasChildren = node.children.length > 0;
  const showChildren = forceExpanded || (hasChildren && expanded);

  const indentPx =
    Math.min(node.depth * INDENT_PX_PER_LEVEL, INDENT_PX_MAX) +
    BASE_LEFT_PADDING_PX;

  const Icon = node.isRecycleBin
    ? Trash2
    : GROUP_ICON_BY_ID[node.iconId ?? "folder"];
  const iconColorClass =
    GROUP_ICON_COLOR_BY_ID[node.iconColorId ?? "default"].className;

  // Resolver KdbxGroup do nó para o context menu. Defense in depth:
  // se a árvore estiver dessincronizada com kdbx, retorna null e o
  // wrapper é omitido (row segue funcional sem menu).
  //
  // Performance: chamado a cada render. Para árvores típicas KDBX
  // (<500 grupos), o walk recursivo de findGroupByUuidIdInDb é
  // aceitável. Otimização (memoização ou index map) só se a árvore
  // crescer ordens de magnitude.
  const group = getGroupByUuid(node.uuid);
  const canDropEntries =
    !!group && !isGroupInRecycleBinSubtree(group, recycleBinUuidId);

  function hasEntryDrag(e: React.DragEvent): boolean {
    return Array.from(e.dataTransfer.types).includes(ENTRY_DRAG_MIME);
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    if (!canDropEntries || !hasEntryDrag(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }

  function handleDragEnter(e: React.DragEvent<HTMLDivElement>) {
    if (!canDropEntries || !hasEntryDrag(e)) return;
    e.preventDefault();
    setDragOver(true);
  }

  function handleDragLeave(e: React.DragEvent<HTMLDivElement>) {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    setDragOver(false);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    if (!canDropEntries || !group || !hasEntryDrag(e)) return;
    e.preventDefault();
    setDragOver(false);
    const entryUuid = e.dataTransfer.getData(ENTRY_DRAG_MIME);
    if (!entryUuid) return;
    onMoveEntryToGroup(entryUuid, group);
  }

  const rowContent = (
    <div
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        "group flex items-center gap-1 pr-2 py-1.5 rounded-md text-sm transition-colors",
        selected
          ? "bg-selected font-semibold text-selected-foreground"
          : "hover:bg-muted text-foreground",
        dragOver && canDropEntries && "bg-muted ring-2 ring-ring/40",
      )}
      style={{ paddingLeft: `${indentPx}px` }}
      data-group-uuid={node.uuid}
    >
      {forceExpanded ? (
        // Nó raiz: sem chevron, apenas espaço reservado pra alinhar
        // ícones de Folder dos filhos. Largura igual ao chevron-button.
        <span className="size-4 shrink-0" aria-hidden="true" />
      ) : hasChildren ? (
        <button
          type="button"
          onClick={() => onToggleExpanded(node.uuid)}
          className="size-4 shrink-0 flex items-center justify-center text-muted-foreground hover:text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50 rounded-sm"
          aria-label={expanded ? "Colapsar grupo" : "Expandir grupo"}
          tabIndex={-1}
        >
          {expanded ? (
            <ChevronDown className="size-3" />
          ) : (
            <ChevronRight className="size-3" />
          )}
        </button>
      ) : (
        // Folha (sem children): espaço reservado pra manter alinhamento
        // do ícone Folder com pares que têm chevron.
        <span className="size-4 shrink-0" aria-hidden="true" />
      )}

      <button
        type="button"
        onClick={() => onSelect(node.uuid)}
        className="flex-1 min-w-0 flex items-center gap-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50 rounded-sm"
        data-group-name-uuid={node.uuid}
      >
        <Icon
          className={cn(
            "size-4 shrink-0",
            node.isRecycleBin ? "text-muted-foreground" : iconColorClass,
          )}
        />
        <span className="flex-1 truncate">{node.name}</span>
        <span className="text-xs text-muted-foreground tabular-nums shrink-0">
          {node.entryCount}
        </span>
      </button>
    </div>
  );

  return (
    <div>
      {group ? (
        <GroupContextMenu
          group={group}
          recycleBinUuidId={recycleBinUuidId}
          onCreateSubgroup={onCreateSubgroup}
          onChangeIcon={onChangeIcon}
          onRename={onRename}
          onDelete={onDelete}
          onRestore={onRestore}
        >
          {rowContent}
        </GroupContextMenu>
      ) : (
        rowContent
      )}

      {showChildren && (
        <div>
          {node.children.map((child) => (
            <GroupTreeItem
              key={child.uuid}
              node={child}
              selectedGroupUuid={selectedGroupUuid}
              expanded={isExpanded(child.uuid)}
              onSelect={onSelect}
              onToggleExpanded={onToggleExpanded}
              isExpanded={isExpanded}
              recycleBinUuidId={recycleBinUuidId}
              getGroupByUuid={getGroupByUuid}
              onCreateSubgroup={onCreateSubgroup}
              onChangeIcon={onChangeIcon}
              onRename={onRename}
              onDelete={onDelete}
              onRestore={onRestore}
              onMoveEntryToGroup={onMoveEntryToGroup}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function isGroupInRecycleBinSubtree(
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
