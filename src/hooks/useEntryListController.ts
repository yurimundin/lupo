import type { KdbxEntry } from "kdbxweb";
import {
  type DragEvent,
  type KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useEmptyRecycleBin } from "@/hooks/useEmptyRecycleBin";
import { confirmDialog } from "@/lib/confirm";
import { ENTRY_DRAG_MIME } from "@/lib/drag-drop";
import { getTitle, isEntryFavorite, matchesSearch } from "@/lib/entry-helpers";
import {
  getHasUnsavedChanges,
  useAllEntries,
  useCurrentGroup,
  useEntriesOfCurrentGroup,
  useIsCurrentGroupRecycleBin,
  useRecycleBinUuidId,
  useSearchQuery,
  useVaultStore,
} from "@/stores/vault";

export function useEntryListController() {
  const searchQuery = useSearchQuery();
  const isSearching = searchQuery.trim().length > 0;
  const groupEntries = useEntriesOfCurrentGroup();
  const allEntries = useAllEntries();
  const selectedEntryUuid = useVaultStore((s) => s.selectedEntryUuid);
  const selectedGroupUuid = useVaultStore((s) => s.selectedGroupUuid);
  const selectEntry = useVaultStore((s) => s.selectEntry);
  const enterCreateMode = useVaultStore((s) => s.enterCreateMode);
  const exitToViewMode = useVaultStore((s) => s.exitToViewMode);
  const isRecycleBin = useIsCurrentGroupRecycleBin();
  const currentGroup = useCurrentGroup();
  const recycleBinUuidId = useRecycleBinUuidId();
  const emptyRecycleBin = useEmptyRecycleBin();
  const [emptying, setEmptying] = useState(false);

  const sourceEntries = isSearching ? allEntries : groupEntries;
  const filteredEntries = useMemo(() => {
    if (!isSearching) return sourceEntries;
    return sourceEntries.filter((e) => matchesSearch(e, searchQuery));
  }, [sourceEntries, searchQuery, isSearching]);

  const sorted = useMemo(() => {
    return [...filteredEntries].sort((a, b) =>
      getTitle(a).localeCompare(getTitle(b), "pt-BR", { sensitivity: "base" }),
    );
  }, [filteredEntries]);

  const favoriteEntries = useMemo(
    () => sorted.filter((entry) => isEntryFavorite(entry)),
    [sorted],
  );
  const otherEntries = useMemo(
    () => sorted.filter((entry) => !isEntryFavorite(entry)),
    [sorted],
  );
  const orderedEntries = useMemo(
    () =>
      favoriteEntries.length > 0
        ? [...favoriteEntries, ...otherEntries]
        : sorted,
    [favoriteEntries, otherEntries, sorted],
  );
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!selectedEntryUuid) return;
    const focused = document.activeElement;
    if (!(focused instanceof HTMLButtonElement)) return;
    if (!containerRef.current?.contains(focused)) return;
    const btn = containerRef.current.querySelector<HTMLButtonElement>(
      `[data-entry-uuid="${selectedEntryUuid}"]`,
    );
    btn?.focus();
  }, [selectedEntryUuid]);

  async function confirmDiscardIfDirty(message: string): Promise<boolean> {
    if (!getHasUnsavedChanges()) return true;
    return confirmDialog({
      title: "Mudanças não salvas",
      description: message,
      confirmLabel: "Descartar e continuar",
      cancelLabel: "Voltar e salvar",
      variant: "danger",
    });
  }

  async function handleEntryClick(uuid: string) {
    if (uuid === selectedEntryUuid) return;
    const ok = await confirmDiscardIfDirty(
      "Você tem mudanças não salvas. Mudar de entrada vai descartar essas mudanças. Continuar?",
    );
    if (!ok) return;
    exitToViewMode();
    selectEntry(uuid);
  }

  async function handleKeyDown(e: KeyboardEvent, idx: number) {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const nextIdx =
      e.key === "ArrowDown" ? idx + 1 : e.key === "ArrowUp" ? idx - 1 : -1;
    if (nextIdx < 0 || nextIdx >= orderedEntries.length) return;
    e.preventDefault();
    const targetUuid = orderedEntries[nextIdx].uuid.id;
    const ok = await confirmDiscardIfDirty(
      "Você tem mudanças não salvas. Mudar de entrada vai descartar essas mudanças. Continuar?",
    );
    if (!ok) return;
    exitToViewMode();
    selectEntry(targetUuid);
  }

  async function handleCreate() {
    if (!selectedGroupUuid || isRecycleBin) return;
    const ok = await confirmDiscardIfDirty(
      "Você tem mudanças não salvas. Criar uma nova entrada vai descartar essas mudanças. Continuar?",
    );
    if (!ok) return;
    enterCreateMode(selectedGroupUuid);
  }

  function canDragEntry(entry: KdbxEntry): boolean {
    if (!recycleBinUuidId) return true;
    let group = entry.parentGroup;
    while (group) {
      if (group.uuid.id === recycleBinUuidId) return false;
      group = group.parentGroup;
    }
    return true;
  }

  function handleDragStart(
    e: DragEvent<HTMLButtonElement>,
    entry: KdbxEntry,
  ) {
    if (!canDragEntry(entry)) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData(ENTRY_DRAG_MIME, entry.uuid.id);
    e.dataTransfer.setData("text/plain", entry.uuid.id);
  }

  async function handleEmptyRecycleBin() {
    if (emptying) return;
    setEmptying(true);
    try {
      await emptyRecycleBin(sorted.length);
    } finally {
      setEmptying(false);
    }
  }

  return {
    canDragEntry,
    containerRef,
    currentGroup,
    emptying,
    favoriteEntries,
    handleCreate,
    handleDragStart,
    handleEmptyRecycleBin,
    handleEntryClick,
    handleKeyDown,
    isRecycleBin,
    isSearching,
    orderedEntries,
    otherEntries,
    recycleBinUuidId,
    searchQuery,
    selectedEntryUuid,
    selectedGroupUuid,
    sorted,
  };
}
