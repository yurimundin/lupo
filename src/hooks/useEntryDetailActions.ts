import type { KdbxEntry, KdbxGroup } from "kdbxweb";
import { useEffect, useState } from "react";

import { useDeleteEntry } from "@/hooks/useDeleteEntry";
import { useDuplicateEntry } from "@/hooks/useDuplicateEntry";
import { useEntryAttachments } from "@/hooks/useEntryAttachments";
import { useMoveEntryToGroup } from "@/hooks/useMoveEntryToGroup";
import { useRemoveEntryHistory } from "@/hooks/useRemoveEntryHistory";
import { useRestoreEntry } from "@/hooks/useRestoreEntry";
import { useRestoreEntryHistory } from "@/hooks/useRestoreEntryHistory";
import { useSetEntryFavorite } from "@/hooks/useSetEntryFavorite";
import {
  openEntryUrl,
  openUrlAndCopyPassword,
} from "@/services/secret-actions";
import { useVaultStore } from "@/stores/vault";

const SHOW_PASSWORD_AUTO_HIDE_MS = 10_000;

interface EntryDetailActionOptions {
  entry: KdbxEntry | null;
  favorite: boolean;
  inRecycleBin: boolean;
  password: string;
  url: string;
}

export function useEntryDetailActions({
  entry,
  favorite,
  inRecycleBin,
  password,
  url,
}: EntryDetailActionOptions) {
  const editMode = useVaultStore((s) => s.editMode);
  const enterEditMode = useVaultStore((s) => s.enterEditMode);
  const kdbx = useVaultStore((s) => s.kdbx);
  const vaultVersion = useVaultStore((s) => s.vaultVersion);
  const deleteEntry = useDeleteEntry();
  const duplicateEntry = useDuplicateEntry();
  const moveEntryToGroup = useMoveEntryToGroup();
  const restoreEntry = useRestoreEntry();
  const restoreEntryHistory = useRestoreEntryHistory();
  const removeEntryHistory = useRemoveEntryHistory();
  const setEntryFavorite = useSetEntryFavorite();
  const { addAttachment, exportAttachment, removeAttachment } =
    useEntryAttachments();

  const [showPassword, setShowPassword] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [favoriting, setFavoriting] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [attachmentAction, setAttachmentAction] = useState<string | null>(null);

  useEffect(() => {
    if (!showPassword) return;
    const id = window.setTimeout(
      () => setShowPassword(false),
      SHOW_PASSWORD_AUTO_HIDE_MS,
    );
    return () => clearTimeout(id);
  }, [showPassword]);

  const entryId = entry?.uuid.id;
  const [prevEntryId, setPrevEntryId] = useState(entryId);
  if (prevEntryId !== entryId) {
    setPrevEntryId(entryId);
    setShowPassword(false);
  }

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (editMode !== "view") return;

      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      const inEditableField =
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        target?.isContentEditable === true;

      const ctrl = e.ctrlKey || e.metaKey;

      if (ctrl && e.key.toLowerCase() === "e") {
        if (entry && !inRecycleBin) {
          e.preventDefault();
          enterEditMode(entry.uuid.id);
        }
        return;
      }

      if (e.key === "Delete" && !inEditableField) {
        if (entry && !inRecycleBin) {
          e.preventDefault();
          void deleteEntry(entry);
        }
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [deleteEntry, editMode, enterEditMode, entry, inRecycleBin]);

  const rootGroup = kdbx?.getDefaultGroup() ?? null;

  async function handleOpenUrl() {
    if (!url) return;
    await openEntryUrl(url);
  }

  async function handleOpenUrlAndCopyPassword() {
    await openUrlAndCopyPassword(url, password);
  }

  async function handleDuplicate() {
    if (!entry || inRecycleBin || duplicating) return;
    setDuplicating(true);
    try {
      await duplicateEntry(entry);
    } finally {
      setDuplicating(false);
    }
  }

  function handleEdit() {
    if (!entry || inRecycleBin) return;
    enterEditMode(entry.uuid.id);
  }

  function handleDelete() {
    if (!entry || inRecycleBin) return;
    void deleteEntry(entry);
  }

  async function handleToggleFavorite() {
    if (!entry || inRecycleBin || favoriting) return;
    setFavoriting(true);
    try {
      await setEntryFavorite(entry, !favorite);
    } finally {
      setFavoriting(false);
    }
  }

  async function handleConfirmMove(targetGroup: KdbxGroup): Promise<boolean> {
    if (!entry) return false;
    return moveEntryToGroup(entry, targetGroup);
  }

  async function handleRestoreHistoryVersion(
    historyIndex: number,
  ): Promise<boolean> {
    if (!entry || inRecycleBin) return false;
    return restoreEntryHistory(entry, historyIndex);
  }

  async function handleRemoveHistoryVersion(
    historyIndex: number,
  ): Promise<boolean> {
    if (!entry || inRecycleBin) return false;
    return removeEntryHistory(entry, historyIndex);
  }

  async function runAttachmentAction(
    actionKey: string,
    action: () => Promise<boolean>,
  ): Promise<void> {
    if (attachmentAction) return;
    setAttachmentAction(actionKey);
    try {
      await action();
    } finally {
      setAttachmentAction(null);
    }
  }

  function handleAddAttachment() {
    if (!entry || inRecycleBin) return;
    void runAttachmentAction("add", () => addAttachment(entry));
  }

  function handleExportAttachment(attachmentName: string) {
    if (!entry) return;
    void runAttachmentAction(`export:${attachmentName}`, () =>
      exportAttachment(entry, attachmentName),
    );
  }

  function handleRemoveAttachment(attachmentName: string) {
    if (!entry || inRecycleBin) return;
    void runAttachmentAction(`remove:${attachmentName}`, () =>
      removeAttachment(entry, attachmentName),
    );
  }

  async function handleRestore() {
    if (!entry || !inRecycleBin || restoring) return;
    setRestoring(true);
    try {
      await restoreEntry(entry);
    } finally {
      setRestoring(false);
    }
  }

  return {
    attachmentAction,
    duplicating,
    favoriting,
    handleAddAttachment,
    handleConfirmMove,
    handleDelete,
    handleDuplicate,
    handleEdit,
    handleExportAttachment,
    handleOpenUrl,
    handleOpenUrlAndCopyPassword,
    handleRemoveAttachment,
    handleRemoveHistoryVersion,
    handleRestore,
    handleRestoreHistoryVersion,
    handleToggleFavorite,
    historyDialogOpen,
    moveDialogOpen,
    restoring,
    rootGroup,
    setHistoryDialogOpen,
    setMoveDialogOpen,
    setShowPassword,
    showPassword,
    vaultVersion,
  };
}
