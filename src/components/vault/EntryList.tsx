// Lista (centro) — entradas do grupo selecionado.
//
// Cada item: avatar com iniciais (cor derivada do hash do título),
// título em bold, subtítulo (username || URL || ""). Setas ↑/↓ navegam
// quando algum item está focado.

import { useEffect, useMemo, useRef } from "react";

import {
  getAvatarColorClass,
  getInitials,
  getTitle,
  getUrl,
  getUsername,
} from "@/lib/entry-helpers";
import { cn } from "@/lib/utils";
import { useEntriesOfCurrentGroup, useVaultStore } from "@/stores/vault";

export function EntryList() {
  const entries = useEntriesOfCurrentGroup();
  const selectedEntryUuid = useVaultStore((s) => s.selectedEntryUuid);
  const selectEntry = useVaultStore((s) => s.selectEntry);

  const sorted = useMemo(() => {
    return [...entries].sort((a, b) =>
      getTitle(a).localeCompare(getTitle(b), "pt-BR", { sensitivity: "base" }),
    );
  }, [entries]);

  const containerRef = useRef<HTMLElement>(null);

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

  function handleKeyDown(e: React.KeyboardEvent, idx: number) {
    if (e.key === "ArrowDown" && idx < sorted.length - 1) {
      e.preventDefault();
      selectEntry(sorted[idx + 1].uuid.id);
    } else if (e.key === "ArrowUp" && idx > 0) {
      e.preventDefault();
      selectEntry(sorted[idx - 1].uuid.id);
    }
  }

  if (sorted.length === 0) {
    return (
      <section className="border-r border-border flex items-center justify-center p-6">
        <span className="text-xs text-muted-foreground">
          (sem entradas neste grupo)
        </span>
      </section>
    );
  }

  return (
    <section
      ref={containerRef}
      className="border-r border-border overflow-y-auto"
    >
      <ul className="divide-y divide-border">
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
                onClick={() => selectEntry(entry.uuid.id)}
                onKeyDown={(e) => handleKeyDown(e, idx)}
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
    </section>
  );
}
