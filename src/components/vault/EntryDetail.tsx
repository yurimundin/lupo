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
import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import { useEntryDetailActions } from "@/hooks/useEntryDetailActions";
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
import {
  getEntryAttachments,
  getEntryHistoryComparison,
  getEntryHistoryItems,
} from "@/lib/kdbx";
import { getGroupDisplayName } from "@/lib/vault-tree";
import { copySecretWithAutoClear } from "@/services/secret-actions";
import {
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

export function EntryDetail() {
  const editMode = useVaultStore((s) => s.editMode);
  const entry = useCurrentEntry();
  const inRecycleBin = useIsEntryInRecycleBin(entry);
  const recycleBinUuidId = useRecycleBinUuidId();
  const password = useMemo(() => (entry ? getPassword(entry) : ""), [entry]);
  const url = entry ? getUrl(entry) : "";
  const favorite = entry ? isEntryFavorite(entry) : false;

  const {
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
  } = useEntryDetailActions({
    entry,
    favorite,
    inRecycleBin,
    password,
    url,
  });

  void vaultVersion;

  const attachments = entry ? getEntryAttachments(entry) : [];
  const historyItems = entry ? getEntryHistoryItems(entry) : [];
  const historyItemsWithComparison = entry
    ? historyItems.map((item) => ({
        ...item,
        comparison: getEntryHistoryComparison(entry, item.index),
      }))
    : [];

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
  const notes = getNotes(entry);
  const groupName = entry.parentGroup
    ? getGroupDisplayName(entry.parentGroup, recycleBinUuidId)
    : "";
  const updatedLabel = formatRelative(getLastModTime(entry));

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
          onCopy={() => copySecretWithAutoClear(username, "Usuário copiado")}
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
            ? () => copySecretWithAutoClear(password, "Senha copiada")
            : undefined
        }
        copyTitle="Copiar senha sem mostrar"
        copyButtonLabel={password.length > 0 ? "Copiar senha" : undefined}
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
          onCopy={() => copySecretWithAutoClear(url, "URL copiada")}
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
          onCopy={() => copySecretWithAutoClear(notes, "Notas copiadas")}
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
