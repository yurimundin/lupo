// Painel direito.
//
// Atua como switch entre os modos do `vault.editMode`:
// - `view`  → renderiza o detalhe READ-ONLY (este componente).
// - `edit`/`create` → delega ao `EntryEditor`.

import {
  ExternalLink,
  Eye,
  EyeOff,
  Inbox,
  KeyRound,
  Link as LinkIcon,
  StickyNote,
  User,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { useDeleteEntry } from "@/hooks/useDeleteEntry";
import { useDuplicateEntry } from "@/hooks/useDuplicateEntry";
import { useEntryAttachments } from "@/hooks/useEntryAttachments";
import { useMoveEntryToGroup } from "@/hooks/useMoveEntryToGroup";
import { useRemoveEntryHistory } from "@/hooks/useRemoveEntryHistory";
import { useRestoreEntry } from "@/hooks/useRestoreEntry";
import { useRestoreEntryHistory } from "@/hooks/useRestoreEntryHistory";
import { useSetEntryFavorite } from "@/hooks/useSetEntryFavorite";
import { copyToClipboardWithAutoClear } from "@/lib/clipboard";
import { openUrlAndCopyPassword } from "@/lib/entry-actions";
import {
  formatRelative,
  getLastModTime,
  getNotes,
  getPassword,
  getTitle,
  getUrl,
  getUsername,
  isEntryFavorite,
} from "@/lib/entry-helpers";
import { openExternalSafe } from "@/lib/external";
import {
  getEntryAttachments,
  getEntryHistoryComparison,
  getEntryHistoryItems,
} from "@/lib/kdbx";
import {
  getGroupDisplayName,
  useCurrentEntry,
  useIsEntryInRecycleBin,
  useRecycleBinUuidId,
  useVaultStore,
} from "@/stores/vault";

import { EntryAttachmentsSection } from "./EntryAttachmentsSection";
import { EntryDetailHeader } from "./EntryDetailHeader";
import { EntryEditor } from "./EntryEditor";
import { EntryField } from "./EntryField";
import { EntryHistoryDialog } from "./EntryHistoryDialog";
import { MoveEntryDialog } from "./MoveEntryDialog";

const SHOW_PASSWORD_AUTO_HIDE_MS = 10_000;

export function EntryDetail() {
  const editMode = useVaultStore((s) => s.editMode);
  const entry = useCurrentEntry();
  const enterEditMode = useVaultStore((s) => s.enterEditMode);
  const inRecycleBin = useIsEntryInRecycleBin(entry);
  const recycleBinUuidId = useRecycleBinUuidId();
  const kdbx = useVaultStore((s) => s.kdbx);
  const deleteEntry = useDeleteEntry();
  const duplicateEntry = useDuplicateEntry();
  const moveEntryToGroup = useMoveEntryToGroup();
  const restoreEntry = useRestoreEntry();
  const restoreEntryHistory = useRestoreEntryHistory();
  const removeEntryHistory = useRemoveEntryHistory();
  const setEntryFavorite = useSetEntryFavorite();
  const { addAttachment, exportAttachment, removeAttachment } =
    useEntryAttachments();
  const vaultVersion = useVaultStore((s) => s.vaultVersion);

  const [showPassword, setShowPassword] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [favoriting, setFavoriting] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [attachmentAction, setAttachmentAction] = useState<string | null>(null);

  // Auto-oculta a senha após 10s sempre que ela é mostrada.
  useEffect(() => {
    if (!showPassword) return;
    const id = window.setTimeout(
      () => setShowPassword(false),
      SHOW_PASSWORD_AUTO_HIDE_MS,
    );
    return () => clearTimeout(id);
  }, [showPassword]);

  // Reseta show-password quando a entry muda. Padrão "setState durante
  // render" (React docs — react.dev/learn/you-might-not-need-an-effect)
  // em vez de useEffect: evita render extra + casca da regra
  // react-hooks/set-state-in-effect introduzida em v7.
  const entryId = entry?.uuid.id;
  const [prevEntryId, setPrevEntryId] = useState(entryId);
  if (prevEntryId !== entryId) {
    setPrevEntryId(entryId);
    setShowPassword(false);
  }

  const password = useMemo(() => (entry ? getPassword(entry) : ""), [entry]);
  // Assina vaultVersion para re-renderizar quando anexos mudam in-place.
  void vaultVersion;
  const attachments = entry ? getEntryAttachments(entry) : [];
  const historyItems = entry ? getEntryHistoryItems(entry) : [];
  const historyItemsWithComparison = entry
    ? historyItems.map((item) => ({
        ...item,
        comparison: getEntryHistoryComparison(entry, item.index),
      }))
    : [];

  // Atalhos globais do detail (em modo view):
  // - Ctrl+E: entra em edit (entry não-lixeira selecionada).
  // - Delete: dispara o flow de mover-pra-lixeira (entry não-lixeira
  //   selecionada). NÃO dispara se foco está em campo editável (input,
  //   textarea, contenteditable) — usuário pode estar digitando no
  //   campo de busca do header.
  // Hooks ficam antes do early return pra cumprir Rules of Hooks;
  // condições internas garantem no-op fora do contexto certo.
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
  }, [editMode, entry, inRecycleBin, enterEditMode, deleteEntry]);

  // Switch para o editor — toda a lógica de edit/create vive lá.
  if (editMode !== "view") {
    return <EntryEditor />;
  }

  if (!entry) {
    return (
      <section className="flex items-center justify-center p-6">
        <div className="text-center text-muted-foreground space-y-2">
          <Inbox className="size-10 mx-auto opacity-40" />
          <p className="text-sm">Selecione uma entrada à esquerda</p>
        </div>
      </section>
    );
  }

  const title = getTitle(entry) || "(sem título)";
  const username = getUsername(entry);
  const url = getUrl(entry);
  const notes = getNotes(entry);
  // Tradução "Recycle Bin" → "Lixeira" via helper compartilhado.
  // Quando entry não tem parentGroup (não deveria acontecer, mas defesa),
  // mostra string vazia para o breadcrumb sumir naturalmente.
  const groupName = entry.parentGroup
    ? getGroupDisplayName(entry.parentGroup, recycleBinUuidId)
    : "";
  const updatedLabel = formatRelative(getLastModTime(entry));
  const rootGroup = kdbx?.getDefaultGroup() ?? null;
  const favorite = isEntryFavorite(entry);

  async function handleOpenUrl() {
    if (!url) return;
    await openExternalSafe(url);
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

  async function handleConfirmMove(targetGroup: Parameters<
    typeof moveEntryToGroup
  >[1]): Promise<boolean> {
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

  // Restaurar entry da Lixeira para o grupo raiz. Sem confirmDialog
  // (decisão de UX: restaurar é benigno). `restoring` evita double-click
  // disparar dois saves em paralelo.
  async function handleRestore() {
    if (!entry || !inRecycleBin || restoring) return;
    setRestoring(true);
    try {
      await restoreEntry(entry);
    } finally {
      setRestoring(false);
    }
  }

  return (
    <section className="overflow-y-auto p-6 space-y-5">
      <EntryDetailHeader
        title={title}
        updatedLabel={updatedLabel}
        groupName={groupName}
        favorite={favorite}
        favoriting={favoriting}
        inRecycleBin={inRecycleBin}
        restoring={restoring}
        duplicating={duplicating}
        historyCount={historyItems.length}
        canMove={!!rootGroup}
        onOpenHistory={() => setHistoryDialogOpen(true)}
        onRestore={() => void handleRestore()}
        onToggleFavorite={() => void handleToggleFavorite()}
        onDuplicate={() => void handleDuplicate()}
        onEdit={handleEdit}
        onMove={() => setMoveDialogOpen(true)}
        onDelete={handleDelete}
      />

      {username && (
        <EntryField
          icon={<User className="size-4 text-muted-foreground" />}
          label="Usuário"
          value={username}
          onCopy={() => copyToClipboardWithAutoClear(username, "Usuário copiado")}
        />
      )}

      <EntryField
        icon={<KeyRound className="size-4 text-muted-foreground" />}
        label="Senha"
        value={
          password.length === 0
            ? "(sem senha)"
            : showPassword
              ? password
              : "•".repeat(Math.min(password.length, 16))
        }
        valueClassName="font-mono"
        onCopy={
          password.length > 0
            ? () => copyToClipboardWithAutoClear(password, "Senha copiada")
            : undefined
        }
        extraAction={
          password.length > 0 ? (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setShowPassword((v) => !v)}
              title={showPassword ? "Ocultar senha" : "Mostrar senha (10s)"}
            >
              {showPassword ? <EyeOff /> : <Eye />}
            </Button>
          ) : null
        }
      />

      {url && (
        <EntryField
          icon={<LinkIcon className="size-4 text-muted-foreground" />}
          label="URL"
          value={
            <button
              type="button"
              onClick={handleOpenUrl}
              className="text-primary hover:underline text-left break-all inline-flex items-center gap-1"
            >
              {url}
              <ExternalLink className="size-3 inline-block" />
            </button>
          }
          extraAction={
            password.length > 0 ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => void handleOpenUrlAndCopyPassword()}
                title="Abrir URL e copiar senha"
              >
                <ExternalLink />
                Abrir + senha
              </Button>
            ) : null
          }
          onCopy={() => copyToClipboardWithAutoClear(url, "URL copiada")}
        />
      )}

      {notes && (
        <EntryField
          icon={<StickyNote className="size-4 text-muted-foreground" />}
          label="Notas"
          value={
            <pre className="whitespace-pre-wrap break-words font-sans text-sm">
              {notes}
            </pre>
          }
          onCopy={() => copyToClipboardWithAutoClear(notes, "Notas copiadas")}
        />
      )}

      <EntryAttachmentsSection
        attachments={attachments}
        inRecycleBin={inRecycleBin}
        attachmentAction={attachmentAction}
        onAdd={handleAddAttachment}
        onExport={handleExportAttachment}
        onRemove={handleRemoveAttachment}
      />

      {rootGroup && (
        <MoveEntryDialog
          open={moveDialogOpen}
          onOpenChange={setMoveDialogOpen}
          entry={entry}
          rootGroup={rootGroup}
          recycleBinUuidId={recycleBinUuidId}
          onConfirm={handleConfirmMove}
        />
      )}

      {historyItems.length > 0 && (
        <EntryHistoryDialog
          open={historyDialogOpen}
          onOpenChange={setHistoryDialogOpen}
          items={historyItemsWithComparison}
          canRestore={!inRecycleBin}
          onRestore={handleRestoreHistoryVersion}
          onRemove={handleRemoveHistoryVersion}
        />
      )}
    </section>
  );
}
