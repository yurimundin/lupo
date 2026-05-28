// Sidebar (esquerda) — árvore recursiva de grupos do cofre.

import { Plus } from "lucide-react";

import { PoweredByBasis } from "@/components/layout/PoweredByBasis";
import { Button } from "@/components/ui/button";
import { useGroupSidebarController } from "@/hooks/useGroupSidebarController";

import { GroupIconDialog } from "./GroupIconDialog";
import { GroupTreeItem } from "./GroupTreeItem";
import { NewGroupDialog } from "./NewGroupDialog";
import { RenameGroupDialog } from "./RenameGroupDialog";

export function GroupSidebar() {
  const {
    canCreateGroup,
    containerRef,
    getGroupByUuid,
    handleChangeIcon,
    handleConfirmIcon,
    handleConfirmRename,
    handleCreateGroup,
    handleCreateSubgroup,
    handleDelete,
    handleKeyDown,
    handleMoveEntryToGroup,
    handleRename,
    handleRestore,
    handleSelect,
    handleToggleExpanded,
    iconTargetGroup,
    isExpanded,
    isIconDialogOpen,
    isNewGroupOpen,
    isRenameOpen,
    recycleBinUuidId,
    renameTargetGroup,
    selectedGroupUuid,
    selectedIsRecycleBin,
    setCtxCreateTarget,
    setIconTargetGroup,
    setIsIconDialogOpen,
    setIsNewGroupOpen,
    setIsRenameOpen,
    setRenameTargetGroup,
    targetParent,
    targetParentIsRoot,
    tree,
  } = useGroupSidebarController();

  if (tree.length === 0) {
    return (
      <aside className="border-r border-border p-3 text-xs text-muted-foreground">
        (sem grupos)
      </aside>
    );
  }

  return (
    <aside
      ref={containerRef}
      className="border-r border-border flex flex-col h-full"
      onKeyDown={(e) => void handleKeyDown(e)}
    >
      <header className="shrink-0 px-3 py-2 border-b border-border flex items-center justify-between">
        <span className="text-xs text-muted-foreground font-medium">
          Grupos
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          disabled={!canCreateGroup}
          onClick={() => setIsNewGroupOpen(true)}
          title={
            selectedIsRecycleBin
              ? "Não é possível criar grupo na Lixeira"
              : "Criar novo grupo"
          }
          aria-label="Criar novo grupo"
        >
          <Plus className="size-4" />
        </Button>
      </header>

      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {tree.map((rootNode) => (
          <GroupTreeItem
            key={rootNode.uuid}
            node={rootNode}
            selectedGroupUuid={selectedGroupUuid}
            expanded={true}
            forceExpanded={true}
            onSelect={(uuid) => void handleSelect(uuid)}
            onToggleExpanded={handleToggleExpanded}
            isExpanded={isExpanded}
            recycleBinUuidId={recycleBinUuidId}
            getGroupByUuid={getGroupByUuid}
            onCreateSubgroup={handleCreateSubgroup}
            onChangeIcon={handleChangeIcon}
            onRename={handleRename}
            onDelete={(group) => void handleDelete(group)}
            onRestore={(group) => void handleRestore(group)}
            onMoveEntryToGroup={handleMoveEntryToGroup}
          />
        ))}
      </div>

      <PoweredByBasis />

      {targetParent && (
        <NewGroupDialog
          open={isNewGroupOpen}
          onOpenChange={(open) => {
            setIsNewGroupOpen(open);
            if (!open) setCtxCreateTarget(null);
          }}
          parent={targetParent}
          parentIsRoot={targetParentIsRoot}
          onConfirm={handleCreateGroup}
        />
      )}

      {renameTargetGroup && (
        <RenameGroupDialog
          open={isRenameOpen}
          onOpenChange={(open) => {
            setIsRenameOpen(open);
            if (!open) setRenameTargetGroup(null);
          }}
          group={renameTargetGroup}
          onConfirm={handleConfirmRename}
        />
      )}

      {iconTargetGroup && (
        <GroupIconDialog
          open={isIconDialogOpen}
          onOpenChange={(open) => {
            setIsIconDialogOpen(open);
            if (!open) setIconTargetGroup(null);
          }}
          group={iconTargetGroup}
          onConfirm={handleConfirmIcon}
        />
      )}
    </aside>
  );
}
