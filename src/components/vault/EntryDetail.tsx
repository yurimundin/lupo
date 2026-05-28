// Painel direito.
//
// Atua como switch entre os modos do `vault.editMode`:
// - `view`  → renderiza o detalhe READ-ONLY (este componente).
// - `edit`/`create` → delega ao `EntryEditor`.

import {
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  FolderInput,
  Inbox,
  KeyRound,
  Link as LinkIcon,
  Pencil,
  Star,
  StickyNote,
  Trash2,
  Undo2,
  User,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { useDeleteEntry } from "@/hooks/useDeleteEntry";
import { useMoveEntryToGroup } from "@/hooks/useMoveEntryToGroup";
import { useRestoreEntry } from "@/hooks/useRestoreEntry";
import { useSetEntryFavorite } from "@/hooks/useSetEntryFavorite";
import { copyToClipboardWithAutoClear } from "@/lib/clipboard";
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
import { cn } from "@/lib/utils";
import {
  getGroupDisplayName,
  useCurrentEntry,
  useIsEntryInRecycleBin,
  useRecycleBinUuidId,
  useVaultStore,
} from "@/stores/vault";

import { EntryEditor } from "./EntryEditor";
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
  const moveEntryToGroup = useMoveEntryToGroup();
  const restoreEntry = useRestoreEntry();
  const setEntryFavorite = useSetEntryFavorite();

  const [showPassword, setShowPassword] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [favoriting, setFavoriting] = useState(false);
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);

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
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-semibold tracking-tight truncate">
            {title}
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Atualizado {updatedLabel}
            {groupName && (
              <>
                <span className="mx-1">·</span>
                <span>{groupName}</span>
              </>
            )}
          </p>
        </div>
        <div className="shrink-0 flex items-center gap-1">
          {inRecycleBin ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void handleRestore()}
              disabled={restoring}
              title="Restaurar entrada para o grupo raiz"
              aria-label="Restaurar entrada da Lixeira"
            >
              <Undo2 />
              {restoring ? "Restaurando..." : "Restaurar"}
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => void handleToggleFavorite()}
                disabled={favoriting}
                title={
                  favorite
                    ? "Remover dos favoritos"
                    : "Adicionar aos favoritos"
                }
                aria-label={
                  favorite
                    ? "Remover entrada dos favoritos"
                    : "Adicionar entrada aos favoritos"
                }
                className={cn(
                  favorite && "text-amber-500 hover:text-amber-500",
                )}
              >
                <Star className={cn(favorite && "fill-current")} />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleEdit}
                title="Editar entrada (Ctrl+E)"
              >
                <Pencil />
                Editar
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setMoveDialogOpen(true)}
                disabled={!rootGroup}
                title="Mover para pasta"
              >
                <FolderInput />
                Mover
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={handleDelete}
                title="Mover para a lixeira (Delete)"
                className="text-destructive hover:text-destructive"
              >
                <Trash2 />
              </Button>
            </>
          )}
        </div>
      </header>

      {username && (
        <Field
          icon={<User className="size-4 text-muted-foreground" />}
          label="Usuário"
          value={username}
          onCopy={() => copyToClipboardWithAutoClear(username, "Usuário copiado")}
        />
      )}

      <Field
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
        <Field
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
          onCopy={() => copyToClipboardWithAutoClear(url, "URL copiada")}
        />
      )}

      {notes && (
        <Field
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
    </section>
  );
}

interface FieldProps {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  valueClassName?: string;
  onCopy?: (() => void) | undefined;
  extraAction?: React.ReactNode;
}

function Field({
  icon,
  label,
  value,
  valueClassName,
  onCopy,
  extraAction,
}: FieldProps) {
  return (
    <div className="rounded-md border border-border bg-bg-secondary px-3 py-2.5">
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
        {icon}
        <span className="font-medium">{label}</span>
      </div>
      <div className="flex items-start gap-2">
        <div className={`flex-1 text-sm ${valueClassName ?? ""}`}>{value}</div>
        <div className="flex items-center gap-0.5 shrink-0">
          {extraAction}
          {onCopy && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onCopy}
              title="Copiar"
            >
              <Copy />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
