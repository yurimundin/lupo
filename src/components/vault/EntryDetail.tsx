// Painel direito — detalhe da entrada selecionada (READ-ONLY na Sessão 3).
// Edição vem na Sessão 4.

import { open as openExternal } from "@tauri-apps/plugin-shell";
import {
  Copy,
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
import { copyToClipboardWithAutoClear } from "@/lib/clipboard";
import {
  formatRelative,
  getLastModTime,
  getNotes,
  getPassword,
  getTitle,
  getUrl,
  getUsername,
} from "@/lib/entry-helpers";
import { useCurrentEntry } from "@/stores/vault";

const SHOW_PASSWORD_AUTO_HIDE_MS = 10_000;

export function EntryDetail() {
  const entry = useCurrentEntry();
  const [showPassword, setShowPassword] = useState(false);

  // Auto-oculta a senha após 10s sempre que ela é mostrada.
  useEffect(() => {
    if (!showPassword) return;
    const id = window.setTimeout(
      () => setShowPassword(false),
      SHOW_PASSWORD_AUTO_HIDE_MS,
    );
    return () => clearTimeout(id);
  }, [showPassword]);

  // Reseta show-password quando a entry muda.
  useEffect(() => {
    setShowPassword(false);
  }, [entry?.uuid.id]);

  const password = useMemo(() => (entry ? getPassword(entry) : ""), [entry]);

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
  const groupName = entry.parentGroup?.name ?? "";
  const updatedLabel = formatRelative(getLastModTime(entry));

  async function handleOpenUrl() {
    if (!url) return;
    try {
      await openExternal(url);
    } catch (err) {
      console.error("[shell.open] falhou:", err);
    }
  }

  return (
    <section className="overflow-y-auto p-6 space-y-5">
      <header>
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Atualizado {updatedLabel}
          {groupName && (
            <>
              <span className="mx-1">·</span>
              <span>{groupName}</span>
            </>
          )}
        </p>
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
