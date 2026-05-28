import {
  Copy,
  History,
  KeyRound,
  Link as LinkIcon,
  RotateCcw,
  StickyNote,
  User,
} from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { copyToClipboardWithAutoClear } from "@/lib/clipboard";
import type { EntryHistoryItem } from "@/lib/kdbx";

interface EntryHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: EntryHistoryItem[];
  canRestore: boolean;
  onRestore: (historyIndex: number) => Promise<boolean>;
}

export function EntryHistoryDialog({
  open,
  onOpenChange,
  items,
  canRestore,
  onRestore,
}: EntryHistoryDialogProps) {
  const [restoringIndex, setRestoringIndex] = useState<number | null>(null);

  const [prevOpen, setPrevOpen] = useState(open);
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (!open) setRestoringIndex(null);
  }

  async function handleRestore(historyIndex: number) {
    if (!canRestore || restoringIndex !== null) return;
    setRestoringIndex(historyIndex);
    try {
      const restored = await onRestore(historyIndex);
      if (restored) onOpenChange(false);
    } finally {
      setRestoringIndex(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[82vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="size-4" />
            Histórico da entrada
          </DialogTitle>
          <DialogDescription>
            Versões anteriores gravadas no próprio cofre KDBX.
          </DialogDescription>
        </DialogHeader>

        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma versão anterior.
          </p>
        ) : (
          <div className="overflow-y-auto pr-1 space-y-2">
            {items.map((item) => (
              <section
                key={`${item.index}-${item.lastModTime?.getTime() ?? "none"}`}
                className="rounded-md border border-border bg-bg-secondary p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold">
                      {item.title || "(sem título)"}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {formatHistoryDate(item.lastModTime)}
                    </p>
                  </div>
                  {canRestore && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void handleRestore(item.index)}
                      disabled={restoringIndex !== null}
                      title="Restaurar esta versão"
                    >
                      <RotateCcw />
                      {restoringIndex === item.index
                        ? "Restaurando..."
                        : "Restaurar"}
                    </Button>
                  )}
                </div>

                <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                  <HistoryField
                    icon={<User className="size-3.5" />}
                    label="Usuário"
                    value={item.username || "(vazio)"}
                    copyValue={item.username}
                  />
                  <HistoryField
                    icon={<KeyRound className="size-3.5" />}
                    label="Senha"
                    value={maskPassword(item.password)}
                    copyValue={item.password}
                  />
                  <HistoryField
                    icon={<LinkIcon className="size-3.5" />}
                    label="URL"
                    value={item.url || "(vazio)"}
                    copyValue={item.url}
                  />
                  <HistoryField
                    icon={<StickyNote className="size-3.5" />}
                    label="Notas"
                    value={item.notes || "(vazio)"}
                    copyValue={item.notes}
                    multiline
                  />
                </dl>
              </section>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface HistoryFieldProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  copyValue: string;
  multiline?: boolean;
}

function HistoryField({
  icon,
  label,
  value,
  copyValue,
  multiline = false,
}: HistoryFieldProps) {
  return (
    <div className="min-w-0 rounded-md border border-border/70 bg-background px-2 py-1.5">
      <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </dt>
      <dd className="mt-1 flex items-start gap-1">
        <span
          className={
            multiline
              ? "min-w-0 flex-1 whitespace-pre-wrap break-words"
              : "min-w-0 flex-1 truncate"
          }
        >
          {value}
        </span>
        {copyValue && (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={() =>
              copyToClipboardWithAutoClear(copyValue, `${label} copiado`)
            }
            title={`Copiar ${label.toLowerCase()}`}
            aria-label={`Copiar ${label.toLowerCase()}`}
          >
            <Copy />
          </Button>
        )}
      </dd>
    </div>
  );
}

function maskPassword(password: string): string {
  if (!password) return "(vazio)";
  return "•".repeat(Math.min(password.length, 16));
}

function formatHistoryDate(date: Date | null): string {
  if (!date) return "Data desconhecida";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}
