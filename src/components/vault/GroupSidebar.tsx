// Sidebar (esquerda) — lista de grupos do cofre.
//
// Por enquanto render flat (sem subgrupos expansíveis). O grupo raiz
// aparece como primeiro item. Setas ↑/↓ navegam quando algum item está
// focado; Enter/Espaço seleciona (comportamento padrão do <button>).

import { Folder } from "lucide-react";
import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";
import { useTopLevelGroups, useVaultStore } from "@/stores/vault";

export function GroupSidebar() {
  const groups = useTopLevelGroups();
  const selectedGroupUuid = useVaultStore((s) => s.selectedGroupUuid);
  const selectGroup = useVaultStore((s) => s.selectGroup);

  const containerRef = useRef<HTMLElement>(null);

  // Sincroniza o foco no botão selecionado quando navegação por setas
  // muda a seleção (mantém o "anel" do navegador no item certo).
  useEffect(() => {
    if (!selectedGroupUuid) return;
    const focused = document.activeElement;
    if (!(focused instanceof HTMLButtonElement)) return;
    if (!containerRef.current?.contains(focused)) return;
    const btn = containerRef.current.querySelector<HTMLButtonElement>(
      `[data-group-uuid="${selectedGroupUuid}"]`,
    );
    btn?.focus();
  }, [selectedGroupUuid]);

  function handleKeyDown(e: React.KeyboardEvent, idx: number) {
    if (e.key === "ArrowDown" && idx < groups.length - 1) {
      e.preventDefault();
      selectGroup(groups[idx + 1].uuid.id);
    } else if (e.key === "ArrowUp" && idx > 0) {
      e.preventDefault();
      selectGroup(groups[idx - 1].uuid.id);
    }
  }

  if (groups.length === 0) {
    return (
      <aside className="border-r border-border p-3 text-xs text-muted-foreground">
        (sem grupos)
      </aside>
    );
  }

  return (
    <aside
      ref={containerRef}
      className="border-r border-border overflow-y-auto p-2 space-y-0.5"
    >
      {groups.map((g, idx) => {
        const selected = g.uuid.id === selectedGroupUuid;
        return (
          <button
            key={g.uuid.id}
            type="button"
            data-group-uuid={g.uuid.id}
            onClick={() => selectGroup(g.uuid.id)}
            onKeyDown={(e) => handleKeyDown(e, idx)}
            className={cn(
              "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
              selected
                ? "bg-brand-soft font-semibold text-foreground"
                : "hover:bg-muted text-foreground",
            )}
          >
            <Folder className="size-4 text-brand-tertiary shrink-0" />
            <span className="flex-1 truncate">{g.name || "(sem nome)"}</span>
            <span className="text-xs text-muted-foreground tabular-nums">
              {g.entries.length}
            </span>
          </button>
        );
      })}
    </aside>
  );
}
