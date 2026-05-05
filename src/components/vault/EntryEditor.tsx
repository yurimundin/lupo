// Painel direito em modo `edit` (entrada existente) ou `create` (nova).
// Renderizado pelo `EntryDetail` quando `vault.editMode !== 'view'`.
//
// Wire-up dos handlers de salvamento e do gerador de senha vão entrar nas
// Tarefas 4 (gerador) e 6 (commit). Por enquanto os handlers de Salvar e
// ✨ são placeholders que apenas logam.

import {
  ArrowLeft,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Link as LinkIcon,
  Loader2,
  Save,
  Sparkles,
  StickyNote,
  User,
} from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { copyToClipboardWithAutoClear } from "@/lib/clipboard";
import {
  useHasUnsavedChanges,
  useVaultStore,
  type EntryDraft,
} from "@/stores/vault";

interface FieldConfig {
  key: keyof EntryDraft;
  label: string;
  inputId: string;
  icon: React.ReactNode;
  placeholder?: string;
  multiline?: boolean;
}

const TEXT_FIELDS: FieldConfig[] = [
  {
    key: "title",
    label: "Título",
    inputId: "entry-edit-title",
    icon: null,
    placeholder: "Ex.: GitHub",
  },
  {
    key: "username",
    label: "Usuário",
    inputId: "entry-edit-username",
    icon: <User className="size-4 text-muted-foreground" />,
    placeholder: "Ex.: yuri@email.com",
  },
];

const URL_FIELD: FieldConfig = {
  key: "url",
  label: "URL",
  inputId: "entry-edit-url",
  icon: <LinkIcon className="size-4 text-muted-foreground" />,
  placeholder: "https://...",
};

const NOTES_FIELD: FieldConfig = {
  key: "notes",
  label: "Notas",
  inputId: "entry-edit-notes",
  icon: <StickyNote className="size-4 text-muted-foreground" />,
  multiline: true,
};

export function EntryEditor() {
  const editMode = useVaultStore((s) => s.editMode);
  const draft = useVaultStore((s) => s.draftEntry);
  const updateDraft = useVaultStore((s) => s.updateDraft);
  const cancelEdit = useVaultStore((s) => s.cancelEdit);
  const hasUnsavedChanges = useHasUnsavedChanges();

  const [showPassword, setShowPassword] = useState(false);
  const [showTitleError, setShowTitleError] = useState(false);
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);
  // Estado de "salvando" — wire real entra na Tarefa 6 (commitEdit).
  const [busy] = useState(false);

  // Reseta show-password quando o modo ou a entry sendo editada mudam.
  useEffect(() => {
    setShowPassword(false);
    setShowTitleError(false);
  }, [editMode, draft?.groupUuid]);

  if (!draft || editMode === "view") return null;

  const isCreate = editMode === "create";
  const titleEmpty = draft.title.trim().length === 0;
  const canSave = isCreate ? !titleEmpty : hasUnsavedChanges && !titleEmpty;

  function requestCancel() {
    if (hasUnsavedChanges) {
      setConfirmCancelOpen(true);
    } else {
      cancelEdit();
    }
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!draft) return;
    if (titleEmpty) {
      setShowTitleError(true);
      return;
    }
    // TODO Tarefa 6: chamar `useCommitEdit()` aqui. Por enquanto só log.
    console.warn("[EntryEditor] TODO Tarefa 6 — commitEdit não conectado");
  }

  function handleGeneratePasswordPlaceholder() {
    // TODO Tarefa 4: abrir popover do gerador de senhas.
    console.warn("[EntryEditor] TODO Tarefa 4 — gerador de senhas");
  }

  return (
    <section className="flex flex-col h-full overflow-hidden">
      {/* Header com botão voltar e título dinâmico. */}
      <header className="shrink-0 flex items-center gap-2 px-4 py-3 border-b border-border">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={requestCancel}
          aria-label="Voltar"
        >
          <ArrowLeft />
        </Button>
        <h2 className="text-sm font-semibold">
          {isCreate ? "Nova entrada" : "Editar entrada"}
        </h2>
        {hasUnsavedChanges && (
          <span className="ml-auto text-xs text-warning">● não salvo</span>
        )}
      </header>

      {/* Form scrollável. */}
      <form
        onSubmit={handleSubmit}
        className="flex-1 overflow-y-auto p-6 space-y-5"
      >
        {/* Título — sempre primeiro, sem ícone (é o destaque). */}
        <div className="space-y-1.5">
          <Label htmlFor={TEXT_FIELDS[0].inputId}>
            {TEXT_FIELDS[0].label}
            <span className="text-destructive ml-1">*</span>
          </Label>
          <Input
            id={TEXT_FIELDS[0].inputId}
            type="text"
            value={draft.title}
            placeholder={TEXT_FIELDS[0].placeholder}
            onChange={(e) => {
              updateDraft("title", e.target.value);
              if (showTitleError && e.target.value.trim().length > 0) {
                setShowTitleError(false);
              }
            }}
            disabled={busy}
            autoFocus={isCreate}
            aria-invalid={showTitleError}
          />
          {showTitleError && (
            <p className="text-xs text-destructive">O título é obrigatório.</p>
          )}
        </div>

        {/* Usuário. */}
        <div className="space-y-1.5">
          <Label
            htmlFor={TEXT_FIELDS[1].inputId}
            className="flex items-center gap-1.5"
          >
            {TEXT_FIELDS[1].icon}
            {TEXT_FIELDS[1].label}
          </Label>
          <Input
            id={TEXT_FIELDS[1].inputId}
            type="text"
            value={draft.username}
            placeholder={TEXT_FIELDS[1].placeholder}
            onChange={(e) => updateDraft("username", e.target.value)}
            disabled={busy}
            autoComplete="off"
          />
        </div>

        {/* Senha — com olho, varinha (Tarefa 4) e copiar. */}
        <div className="space-y-1.5">
          <Label
            htmlFor="entry-edit-password"
            className="flex items-center gap-1.5"
          >
            <KeyRound className="size-4 text-muted-foreground" />
            Senha
          </Label>
          <div className="relative">
            <Input
              id="entry-edit-password"
              type={showPassword ? "text" : "password"}
              value={draft.password}
              onChange={(e) => updateDraft("password", e.target.value)}
              disabled={busy}
              autoComplete="new-password"
              className="pr-24 font-mono"
            />
            <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setShowPassword((v) => !v)}
                title={showPassword ? "Ocultar senha" : "Mostrar senha"}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff /> : <Eye />}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={handleGeneratePasswordPlaceholder}
                title="Gerar senha (em breve)"
                tabIndex={-1}
              >
                <Sparkles />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() =>
                  draft.password &&
                  copyToClipboardWithAutoClear(draft.password, "Senha copiada")
                }
                disabled={!draft.password}
                title="Copiar senha"
                tabIndex={-1}
              >
                <Copy />
              </Button>
            </div>
          </div>
        </div>

        {/* URL. */}
        <div className="space-y-1.5">
          <Label
            htmlFor={URL_FIELD.inputId}
            className="flex items-center gap-1.5"
          >
            {URL_FIELD.icon}
            {URL_FIELD.label}
          </Label>
          <Input
            id={URL_FIELD.inputId}
            type="text"
            value={draft.url}
            placeholder={URL_FIELD.placeholder}
            onChange={(e) => updateDraft("url", e.target.value)}
            disabled={busy}
            autoComplete="off"
          />
        </div>

        {/* Notas (textarea). */}
        <div className="space-y-1.5">
          <Label
            htmlFor={NOTES_FIELD.inputId}
            className="flex items-center gap-1.5"
          >
            {NOTES_FIELD.icon}
            {NOTES_FIELD.label}
          </Label>
          <textarea
            id={NOTES_FIELD.inputId}
            value={draft.notes}
            onChange={(e) => updateDraft("notes", e.target.value)}
            disabled={busy}
            rows={5}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 font-sans"
          />
        </div>
      </form>

      {/* Footer fixo com Cancelar + Salvar. */}
      <footer className="shrink-0 border-t border-border bg-bg-secondary px-4 py-3 flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={requestCancel}
          disabled={busy}
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          onClick={handleSubmit}
          disabled={!canSave || busy}
        >
          {busy ? (
            <>
              <Loader2 className="animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <Save />
              Salvar
            </>
          )}
        </Button>
      </footer>

      <ConfirmDialog
        open={confirmCancelOpen}
        onOpenChange={setConfirmCancelOpen}
        title="Descartar mudanças?"
        description="Você tem alterações não-salvas. Se cancelar agora, elas serão perdidas."
        confirmLabel="Descartar"
        cancelLabel="Voltar a editar"
        variant="danger"
        onConfirm={cancelEdit}
      />
    </section>
  );
}
