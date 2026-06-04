import type { KdbxGroup } from "kdbxweb";
import {
  type KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

import { useCreateGroup } from "@/hooks/useCreateGroup";
import { useDeleteGroup } from "@/hooks/useDeleteGroup";
import { useDirtyEntryGuard } from "@/hooks/useDirtyEntryGuard";
import { useMoveEntryToGroup } from "@/hooks/useMoveEntryToGroup";
import { useRenameGroup } from "@/hooks/useRenameGroup";
import { useRestoreGroup } from "@/hooks/useRestoreGroup";
import { useSetGroupIcon } from "@/hooks/useSetGroupIcon";
import type { GroupIconColorId, GroupLucideIconId } from "@/lib/group-icons";
import {
  flattenVisibleGroupTree,
  isGroupInRecycleBinSubtree,
} from "@/lib/vault-tree";
import {
  findEntryByUuidIdInDb,
  findGroupByUuidIdInDb,
} from "@/lib/vault-find";
import { useSettingsStore } from "@/stores/settings";
import {
  useGroupTree,
  useRecycleBinUuidId,
  useVaultStore,
} from "@/stores/vault";

export function useGroupSidebarController() {
  const tree = useGroupTree();
  const selectedGroupUuid = useVaultStore((s) => s.selectedGroupUuid);
  const selectGroup = useVaultStore((s) => s.selectGroup);
  const lastFilePath = useVaultStore((s) => s.lastFilePath);
  const kdbx = useVaultStore((s) => s.kdbx);
  const recycleBinUuidId = useRecycleBinUuidId();
  const toggleGroupExpanded = useSettingsStore((s) => s.toggleGroupExpanded);
  const expandedForVault = useSettingsStore((s) =>
    lastFilePath ? (s.expandedGroupsByVault[lastFilePath] ?? null) : null,
  );

  const expandedSet = useMemo(
    () => new Set(expandedForVault ?? []),
    [expandedForVault],
  );
  const visibleNodes = useMemo(
    () => flattenVisibleGroupTree(tree, (uuid) => expandedSet.has(uuid)),
    [tree, expandedSet],
  );
  const containerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!selectedGroupUuid) return;
    const focused = document.activeElement;
    if (!(focused instanceof HTMLButtonElement)) return;
    if (!containerRef.current?.contains(focused)) return;
    const btn = containerRef.current.querySelector<HTMLButtonElement>(
      `[data-group-name-uuid="${selectedGroupUuid}"]`,
    );
    btn?.focus();
  }, [selectedGroupUuid]);

  const createGroup = useCreateGroup();
  const renameGroup = useRenameGroup();
  const deleteGroup = useDeleteGroup();
  const restoreGroup = useRestoreGroup();
  const setGroupIcon = useSetGroupIcon();
  const moveEntryToGroup = useMoveEntryToGroup();
  const confirmDiscardIfDirty = useDirtyEntryGuard({
    description:
      "Você tem mudanças não salvas. Mudar de grupo vai descartar essas mudanças. Continuar?",
  });

  const [isNewGroupOpen, setIsNewGroupOpen] = useState(false);
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [isIconDialogOpen, setIsIconDialogOpen] = useState(false);
  const [renameTargetGroup, setRenameTargetGroup] = useState<KdbxGroup | null>(
    null,
  );
  const [iconTargetGroup, setIconTargetGroup] = useState<KdbxGroup | null>(null);
  const [ctxCreateTarget, setCtxCreateTarget] = useState<KdbxGroup | null>(
    null,
  );

  const rootGroup = kdbx?.getDefaultGroup() ?? null;
  const selectedGroup =
    kdbx && selectedGroupUuid
      ? findGroupByUuidIdInDb(kdbx, selectedGroupUuid)
      : null;

  const getGroupByUuid = useCallback(
    (uuid: string): KdbxGroup | null =>
      kdbx ? findGroupByUuidIdInDb(kdbx, uuid) : null,
    [kdbx],
  );

  const handleMoveEntryToGroup = useCallback(
    (entryUuid: string, targetGroup: KdbxGroup) => {
      if (!kdbx) {
        toast.error("Cofre não está pronto.");
        return;
      }
      const entry = findEntryByUuidIdInDb(kdbx, entryUuid);
      if (!entry) {
        toast.error("Entrada não encontrada.");
        return;
      }
      void moveEntryToGroup(entry, targetGroup);
    },
    [kdbx, moveEntryToGroup],
  );

  const selectedIsRecycleBin = isGroupInRecycleBinSubtree(
    selectedGroup,
    recycleBinUuidId,
  );
  const targetParent = ctxCreateTarget ?? selectedGroup ?? rootGroup;
  const targetParentIsRoot =
    !!targetParent && targetParent.uuid.id === rootGroup?.uuid.id;
  const canCreateGroup = !!targetParent && !selectedIsRecycleBin && !!kdbx;

  async function handleCreateGroup(name: string): Promise<boolean> {
    if (!targetParent) return false;
    const ok = await createGroup(targetParent, name);
    if (ok) {
      const filePath = useVaultStore.getState().lastFilePath;
      if (
        filePath &&
        !useSettingsStore
          .getState()
          .isGroupExpanded(filePath, targetParent.uuid.id)
      ) {
        useSettingsStore
          .getState()
          .toggleGroupExpanded(filePath, targetParent.uuid.id);
      }
    }
    return ok;
  }

  function handleCreateSubgroup(group: KdbxGroup) {
    setCtxCreateTarget(group);
    setIsNewGroupOpen(true);
  }

  function handleRename(group: KdbxGroup) {
    setRenameTargetGroup(group);
    setIsRenameOpen(true);
  }

  function handleChangeIcon(group: KdbxGroup) {
    setIconTargetGroup(group);
    setIsIconDialogOpen(true);
  }

  async function handleDelete(group: KdbxGroup) {
    await deleteGroup(group);
  }

  async function handleRestore(group: KdbxGroup) {
    await restoreGroup(group);
  }

  async function handleConfirmRename(newName: string): Promise<boolean> {
    if (!renameTargetGroup) return false;
    return renameGroup(renameTargetGroup, newName);
  }

  async function handleConfirmIcon(
    group: KdbxGroup,
    iconId: GroupLucideIconId | null,
    colorId: GroupIconColorId | null,
  ): Promise<boolean> {
    return setGroupIcon(group, iconId, colorId);
  }

  async function handleSelect(uuid: string) {
    if (uuid === selectedGroupUuid) return;
    if (!(await confirmDiscardIfDirty())) return;
    selectGroup(uuid);
  }

  function handleToggleExpanded(uuid: string) {
    if (!lastFilePath) return;
    toggleGroupExpanded(lastFilePath, uuid);
  }

  function isExpanded(uuid: string): boolean {
    return expandedSet.has(uuid);
  }

  async function handleKeyDown(e: KeyboardEvent) {
    if (
      e.key !== "ArrowDown" &&
      e.key !== "ArrowUp" &&
      e.key !== "ArrowLeft" &&
      e.key !== "ArrowRight"
    ) {
      return;
    }

    const idx = visibleNodes.findIndex(
      (entry) => entry.node.uuid === selectedGroupUuid,
    );
    if (idx < 0) return;

    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      const nextIdx = e.key === "ArrowDown" ? idx + 1 : idx - 1;
      if (nextIdx < 0 || nextIdx >= visibleNodes.length) return;
      e.preventDefault();
      if (!(await confirmDiscardIfDirty())) return;
      selectGroup(visibleNodes[nextIdx].node.uuid);
      return;
    }

    const current = visibleNodes[idx].node;
    const isRoot = current.parentUuid === null;
    const hasChildren = current.children.length > 0;
    const currentlyExpanded = isExpanded(current.uuid);

    if (e.key === "ArrowRight" && hasChildren && !currentlyExpanded && !isRoot) {
      e.preventDefault();
      handleToggleExpanded(current.uuid);
      return;
    }

    if (e.key === "ArrowLeft") {
      if (hasChildren && currentlyExpanded && !isRoot) {
        e.preventDefault();
        handleToggleExpanded(current.uuid);
        return;
      }
      if (current.parentUuid && current.parentUuid !== tree[0]?.uuid) {
        e.preventDefault();
        if (!(await confirmDiscardIfDirty())) return;
        selectGroup(current.parentUuid);
      }
    }
  }

  return {
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
  };
}
