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
  getGroupPath,
  getInitials,
  getTitle,
  getUrl,
  getUsername,
  highlightMatch,
  matchesSearch,
} from "@/lib/entry-helpers";
import { cn } from "@/lib/utils";
import {
  getGroupDisplayName,
  getHasUnsavedChanges,
  useAllEntries,
  useCurrentGroup,
  useEntriesOfCurrentGroup,
  useIsCurrentGroupRecycleBin,
  useRecycleBinUuidId,
  useSearchQuery,
  useVaultStore,
} from "@/stores/vault";

import { EmptyRecycleBinState } from "./EmptyRecycleBinState";
import { EmptySearchResults } from "./EmptySearchResults";

export function EntryList() {
  // Search query vive no store (`setSearchQuery` no `VaultHeader` →
  // re-render aqui). Ver §17. Reset automático em lock/unlock/setVault.
  const searchQuery = useSearchQuery();
  const isSearching = searchQuery.trim().length > 0;

  const groupEntries = useEntriesOfCurrentGroup();
  // `useAllEntries` é chamado sempre (hooks não podem ser condicionais) mas
  // só usado quando a query tem texto. Memoização interna do hook evita
  // re-walk recursivo desnecessário.
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

  // Fonte: durante busca, todas as entries (ex-Lixeira); fora dela,
  // entries do grupo selecionado (comportamento antigo preservado).
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
        {isSearching ? (
          <span className="text-xs text-muted-foreground min-w-0 truncate">
            <span className="font-semibold text-foreground">Resultados</span>
            <span className="mx-1.5">·</span>
            <span className="tabular-nums">
              {sorted.length} {sorted.length === 1 ? "entrada" : "entradas"}
            </span>
          </span>
        ) : (
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
        )}
        {/* Botões à direita escondidos durante busca: criar entry no
            grupo "ativo" é ambíguo quando a lista mostra todos os grupos;
            esvaziar Lixeira não faz sentido pois Lixeira está fora do
            resultado. Após ESC volta tudo. */}
        {!isSearching &&
          (isRecycleBin ? (
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
          ))}
      </header>

      {sorted.length === 0 ? (
        // Estado vazio: durante busca, EmptySearchResults tem prioridade
        // (cross-group, isRecycleBin do grupo selecionado é irrelevante).
        // Fora de busca: Lixeira ganha ilustração; grupo normal o estado
        // mínimo herdado da Sessão 3 (polir os outros casos é trabalho
        // de UX futuro).
        isSearching ? (
          <EmptySearchResults query={searchQuery} />
        ) : isRecycleBin ? (
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
                      ? "bg-selected-entry border-l-2 border-l-selected-border"
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
                    <span
                      className={cn(
                        "block font-semibold text-sm truncate",
                        selected && "text-selected-entry-foreground",
                      )}
                    >
                      {/* Highlight do trecho que casa com a query.
                          Aplicado APENAS durante busca e quando há
                          título real (não no fallback "(sem título)"). */}
                      {isSearching && getTitle(entry)
                        ? highlightMatch(getTitle(entry), searchQuery).map(
                            (part, i) =>
                              part.highlighted ? (
                                <mark
                                  key={i}
                                  className="bg-yellow-200 dark:bg-yellow-800/50 rounded-sm px-0.5"
                                >
                                  {part.text}
                                </mark>
                              ) : (
                                <span key={i}>{part.text}</span>
                              ),
                          )
                        : title}
                    </span>
                    {subtitle && (
                      <span className="block text-xs text-muted-foreground truncate">
                        {subtitle}
                      </span>
                    )}
                    {/* Caminho do grupo abaixo do username quando busca
                        ativa. Cor sutil (muted/70) para subordinar à
                        info principal. */}
                    {isSearching && (
                      <span className="block text-xs text-muted-foreground/70 truncate">
                        {getGroupPath(entry, recycleBinUuidId)}
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
