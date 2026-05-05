// Lista (centro) — entradas do grupo selecionado.
//
// Cabeçalho da lista tem botão "+" para criar nova entrada no grupo
// atual (desabilitado se o grupo é a Lixeira). Cada item: avatar com
// iniciais (cor derivada do hash do título), título em bold, subtítulo
// (username || URL || ""). Setas ↑/↓ navegam quando algum item está
// focado.

import { Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { useEmptyRecycleBin } from "@/hooks/useEmptyRecycleBin";
import { confirmDialog } from "@/lib/confirm";
import {
  getAvatarColorClass,
  getInitials,
  getTitle,
  getUrl,
  getUsername,
} from "@/lib/entry-helpers";
import { cn } from "@/lib/utils";
import {
  getGroupDisplayName,
  getHasUnsavedChanges,
  useCurrentGroup,
  useEntriesOfCurrentGroup,
  useIsCurrentGroupRecycleBin,
  useRecycleBinUuidId,
  useVaultStore,
} from "@/stores/vault";

import { EmptyRecycleBinState } from "./EmptyRecycleBinState";

export function EntryList() {
  const entries = useEntriesOfCurrentGroup();
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

  const sorted = useMemo(() => {
    return [...entries].sort((a, b) =>
      getTitle(a).localeCompare(getTitle(b), "pt-BR", { sensitivity: "base" }),
    );
  }, [entries]);

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

  /**
   * Guard pra trocar de entry seleccionada quando há draft pendente:
   * confirma com o usuário antes de descartar. Retorna `true` se a troca
   * pode prosseguir.
   */
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

  async function handleKeyDown(e: React.KeyboardEvent, idx: number) {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const nextIdx =
      e.key === "ArrowDown" ? idx + 1 : e.key === "ArrowUp" ? idx - 1 : -1;
    if (nextIdx < 0 || nextIdx >= sorted.length) return;
    e.preventDefault();
    const targetUuid = sorted[nextIdx].uuid.id;
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

  // Esvaziar Lixeira: hard-delete em massa. Hook trata confirmDialog
  // (com lembrete de backup), persistência e toasts. `emptying` evita
  // double-click disparar dois saves em paralelo.
  async function handleEmptyRecycleBin() {
    if (emptying) return;
    setEmptying(true);
    try {
      await emptyRecycleBin(sorted.length);
    } finally {
      setEmptying(false);
    }
  }

  return (
    <section
      ref={containerRef}
      className="border-r border-border flex flex-col overflow-hidden"
    >
      {/* Cabeçalho da lista — sempre visível mesmo quando vazio.
          Em grupo normal: botão "+" para criar nova entrada.
          Em Lixeira COM entries: botão "Esvaziar" (destructive).
          Em Lixeira VAZIA: nenhum botão (padrão Gmail).
          Nome do grupo passa por `getGroupDisplayName` para traduzir
          "Recycle Bin" → "Lixeira" sem mexer no XML interno. */}
      <header className="shrink-0 flex items-center justify-between gap-2 px-3 py-2 border-b border-border bg-bg-secondary">
        <span className="text-xs text-muted-foreground min-w-0 truncate">
          {currentGroup && (
            <span className="font-semibold text-foreground">
              {getGroupDisplayName(currentGroup, recycleBinUuidId)}
            </span>
          )}
          {currentGroup && <span className="mx-1.5">·</span>}
          <span className="tabular-nums">
            {sorted.length} {sorted.length === 1 ? "entrada" : "entradas"}
          </span>
        </span>
        {isRecycleBin ? (
          sorted.length > 0 ? (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => void handleEmptyRecycleBin()}
              disabled={emptying}
              title="Apagar permanentemente todas as entradas da Lixeira"
              aria-label="Esvaziar Lixeira"
            >
              <Trash2 />
              {emptying ? "Esvaziando..." : "Esvaziar"}
            </Button>
          ) : null
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={handleCreate}
            disabled={!selectedGroupUuid}
            title="Nova entrada"
          >
            <Plus />
          </Button>
        )}
      </header>

      {sorted.length === 0 ? (
        // Estado vazio: Lixeira ganha ilustração + mensagem educativa.
        // Grupos normais mantêm o estado vazio mínimo herdado da Sessão 3
        // (polir esses outros casos fica pra sessão futura de UX).
        isRecycleBin ? (
          <div className="flex-1 overflow-hidden">
            <EmptyRecycleBinState />
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center p-6">
            <span className="text-xs text-muted-foreground">
              (sem entradas neste grupo)
            </span>
          </div>
        )
      ) : (
        <ul className="flex-1 overflow-y-auto divide-y divide-border">
          {sorted.map((entry, idx) => {
            const title = getTitle(entry) || "(sem título)";
            const username = getUsername(entry);
            const url = getUrl(entry);
            const subtitle = username || url || "";
            const selected = entry.uuid.id === selectedEntryUuid;
            return (
              <li key={entry.uuid.id}>
                <button
                  type="button"
                  data-entry-uuid={entry.uuid.id}
                  onClick={() => void handleEntryClick(entry.uuid.id)}
                  onKeyDown={(e) => void handleKeyDown(e, idx)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                    selected
                      ? "bg-[#E8F4FA] dark:bg-[#152B36] border-l-2 border-l-primary"
                      : "border-l-2 border-l-transparent hover:bg-muted",
                  )}
                >
                  <span
                    className={cn(
                      "size-8 rounded-md flex items-center justify-center text-xs font-semibold text-white shrink-0",
                      getAvatarColorClass(title),
                    )}
                  >
                    {getInitials(title)}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block font-semibold text-sm truncate">
                      {title}
                    </span>
                    {subtitle && (
                      <span className="block text-xs text-muted-foreground truncate">
                        {subtitle}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
