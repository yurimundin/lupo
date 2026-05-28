import {
  ArrowRight,
  Copy,
  ExternalLink,
  Lock,
  Pencil,
  Plus,
  Search,
  Star,
  User,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { useDirtyEntryGuard } from "@/hooks/useDirtyEntryGuard";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  buildCommandPaletteItems,
  type CommandPaletteActionItem,
  type CommandPaletteEntryItem,
  type CommandPaletteItem,
} from "@/lib/command-palette";
import { copyToClipboardWithAutoClear } from "@/lib/clipboard";
import { getPassword, getUsername } from "@/lib/entry-helpers";
import { openExternalSafe } from "@/lib/external";
import { requestLockWithGuard } from "@/lib/lock-flow";
import { cn } from "@/lib/utils";
import {
  useAllEntries,
  useRecycleBinUuidId,
  useVaultStore,
} from "@/stores/vault";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
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

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-3 p-3 sm:max-w-[720px]">
        <DialogHeader className="px-1 pt-1">
          <DialogTitle>Command palette</DialogTitle>
          <DialogDescription>
            Busque entradas e execute ações rápidas do cofre.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Buscar entrada ou ação..."
            className="h-10 pl-9"
          />
        </div>

        <div className="max-h-[460px] overflow-y-auto rounded-md border border-border">
          {items.length === 0 ? (
            <div className="px-3 py-10 text-center text-sm text-muted-foreground">
              Nenhuma entrada ou ação encontrada.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {items.map((item, index) =>
                item.type === "action" ? (
                  <ActionRow
                    key={item.id}
                    item={item}
                    active={index === activeIndex}
                    onHover={() => setActiveIndex(index)}
                    onRun={() => void runAction(item)}
                  />
                ) : (
                  <EntryRow
                    key={item.id}
                    item={item}
                    active={index === activeIndex}
                    onHover={() => setActiveIndex(index)}
                    onOpen={() => void openEntry(item)}
                    onEdit={() => void openEntry(item, true)}
                    onClose={() => onOpenChange(false)}
                  />
                ),
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ActionRow({
  item,
  active,
  onHover,
  onRun,
}: {
  item: CommandPaletteActionItem;
  active: boolean;
  onHover: () => void;
  onRun: () => void;
}) {
  const Icon =
    item.id === "new-entry" ? Plus : item.id === "lock-vault" ? Lock : Search;
  return (
    <button
      type="button"
      onMouseEnter={onHover}
      onClick={onRun}
      className={cn(
        "flex w-full items-center gap-3 px-3 py-2.5 text-left outline-none transition-colors",
        active ? "bg-selected text-selected-foreground" : "hover:bg-muted",
      )}
    >
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{item.label}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {item.description}
        </span>
      </span>
      <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
    </button>
  );
}

function EntryRow({
  item,
  active,
  onHover,
  onOpen,
  onEdit,
  onClose,
}: {
  item: CommandPaletteEntryItem;
  active: boolean;
  onHover: () => void;
  onOpen: () => void;
  onEdit: () => void;
  onClose: () => void;
}) {
  const username = getUsername(item.entry);
  const password = getPassword(item.entry);

  async function copyUsername() {
    if (!username) return;
    await copyToClipboardWithAutoClear(username, "Usuário copiado");
    onClose();
  }

  async function copyPassword() {
    if (!password) return;
    await copyToClipboardWithAutoClear(password, "Senha copiada");
    onClose();
  }

  async function openUrl() {
    if (!item.url) return;
    await openExternalSafe(item.url);
    onClose();
  }

  return (
    <div
      onMouseEnter={onHover}
      className={cn(
        "flex items-center gap-2 px-3 py-2.5 transition-colors",
        active ? "bg-selected text-selected-foreground" : "hover:bg-muted",
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        className="min-w-0 flex-1 text-left outline-none"
      >
        <span className="flex min-w-0 items-center gap-1 text-sm font-medium">
          {item.favorite && (
            <Star className="size-3.5 shrink-0 fill-amber-400 text-amber-500" />
          )}
          <span className="truncate">{item.title}</span>
        </span>
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
          {[item.subtitle, item.groupPath].filter(Boolean).join(" · ")}
        </span>
      </button>

      <div className="flex shrink-0 items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => void copyPassword()}
          disabled={!item.hasPassword}
          title="Copiar senha"
          aria-label={`Copiar senha de ${item.title}`}
        >
          <Copy />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => void copyUsername()}
          disabled={!item.hasUsername}
          title="Copiar usuário"
          aria-label={`Copiar usuário de ${item.title}`}
        >
          <User />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => void openUrl()}
          disabled={!item.hasUrl}
          title="Abrir URL"
          aria-label={`Abrir URL de ${item.title}`}
        >
          <ExternalLink />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onEdit}
          title="Editar entrada"
          aria-label={`Editar ${item.title}`}
        >
          <Pencil />
        </Button>
      </div>
    </div>
  );
}
