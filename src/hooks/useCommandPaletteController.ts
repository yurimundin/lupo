import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";

import { useDirtyEntryGuard } from "@/hooks/useDirtyEntryGuard";
import {
  buildCommandPaletteItems,
  type CommandPaletteActionItem,
  type CommandPaletteEntryItem,
  type CommandPaletteItem,
} from "@/lib/command-palette";
import { requestLockWithGuard } from "@/services/lock-flow";
import {
  useAllEntries,
  useRecycleBinUuidId,
  useVaultStore,
} from "@/stores/vault";

export function useCommandPaletteController(
  open: boolean,
  onOpenChange: (open: boolean) => void,
) {
  const entries = useAllEntries();
  const recycleBinUuidId = useRecycleBinUuidId();
  const selectedGroupUuid = useVaultStore((s) => s.selectedGroupUuid);
  const selectGroup = useVaultStore((s) => s.selectGroup);
  const selectEntry = useVaultStore((s) => s.selectEntry);
  const enterEditMode = useVaultStore((s) => s.enterEditMode);
  const enterCreateMode = useVaultStore((s) => s.enterCreateMode);
  const setSearchQuery = useVaultStore((s) => s.setSearchQuery);
  const confirmDiscardIfDirty = useDirtyEntryGuard({
    description:
      "Você tem mudanças não salvas. Executar esta ação vai descartar essas mudanças. Continuar?",
  });

  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const [prevOpen, setPrevOpen] = useState(open);
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (open) {
      setQuery("");
      setActiveIndex(0);
    }
  }

  const items = useMemo(
    () => buildCommandPaletteItems({ entries, query, recycleBinUuidId }),
    [entries, query, recycleBinUuidId],
  );
  const activeItem = items[activeIndex] ?? null;

  useEffect(() => {
    if (!open) return;
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  function handleQueryChange(value: string) {
    setQuery(value);
    setActiveIndex(0);
  }

  async function openEntry(item: CommandPaletteEntryItem, edit = false) {
    const parentGroup = item.entry.parentGroup;
    if (!parentGroup) return;
    if (!(await confirmDiscardIfDirty())) return;

    setSearchQuery("");
    selectGroup(parentGroup.uuid.id);
    if (edit) {
      enterEditMode(item.entry.uuid.id);
    } else {
      selectEntry(item.entry.uuid.id);
    }
    onOpenChange(false);
  }

  async function runAction(item: CommandPaletteActionItem) {
    if (item.id === "new-entry") {
      if (!selectedGroupUuid) return;
      if (!(await confirmDiscardIfDirty())) return;
      enterCreateMode(selectedGroupUuid);
      onOpenChange(false);
      return;
    }

    if (item.id === "lock-vault") {
      onOpenChange(false);
      await requestLockWithGuard();
      return;
    }

    if (item.id === "focus-search") {
      onOpenChange(false);
      window.setTimeout(() => {
        const input = document.getElementById("vault-search-input");
        if (input instanceof HTMLInputElement) {
          input.focus();
          input.select();
        }
      }, 0);
    }
  }

  async function runPrimary(item: CommandPaletteItem | null) {
    if (!item) return;
    if (item.type === "action") {
      await runAction(item);
    } else {
      await openEntry(item);
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((idx) => Math.min(idx + 1, items.length - 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((idx) => Math.max(idx - 1, 0));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      void runPrimary(activeItem);
    }
  }

  return {
    activeIndex,
    handleKeyDown,
    handleQueryChange,
    inputRef,
    items,
    openEntry,
    query,
    runAction,
    setActiveIndex,
  };
}
