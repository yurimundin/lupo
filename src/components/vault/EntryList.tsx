import { Fragment } from "react";
import { Plus, Star, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useEntryListController } from "@/hooks/useEntryListController";
import {
  getAvatarColorClass,
  getGroupPath,
  getInitials,
  getTitle,
  getUrl,
  getUsername,
  highlightMatch,
  isEntryFavorite,
} from "@/lib/entry-helpers";
import { cn } from "@/lib/utils";
import { getGroupDisplayName } from "@/lib/vault-tree";

import { EmptyRecycleBinState } from "./EmptyRecycleBinState";
import { EmptySearchResults } from "./EmptySearchResults";

export function EntryList() {
  const {
    canDragEntry,
    containerRef,
    currentGroup,
    emptying,
    favoriteEntries,
    handleCreate,
    handleDragStart,
    handleEmptyRecycleBin,
    handleEntryClick,
    handleKeyDown,
    isRecycleBin,
    isSearching,
    orderedEntries,
    otherEntries,
    recycleBinUuidId,
    searchQuery,
    selectedEntryUuid,
    selectedGroupUuid,
    sorted,
  } = useEntryListController();

  return (
    <section
      ref={containerRef}
      className="border-r border-border flex flex-col overflow-hidden"
    >
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
              onClick={() => void handleCreate()}
              disabled={!selectedGroupUuid}
              title="Nova entrada"
            >
              <Plus />
            </Button>
          ))}
      </header>

      {sorted.length === 0 ? (
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
          {orderedEntries.map((entry, idx) => {
            const title = getTitle(entry) || "(sem título)";
            const username = getUsername(entry);
            const url = getUrl(entry);
            const subtitle = username || url || "";
            const selected = entry.uuid.id === selectedEntryUuid;
            const draggable = canDragEntry(entry);
            const favorite = isEntryFavorite(entry);
            const showFavoritesHeader = favoriteEntries.length > 0 && idx === 0;
            const showOthersHeader =
              favoriteEntries.length > 0 &&
              otherEntries.length > 0 &&
              idx === favoriteEntries.length;

            return (
              <Fragment key={entry.uuid.id}>
                {showFavoritesHeader && (
                  <li className="bg-bg-secondary px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Favoritos
                  </li>
                )}
                {showOthersHeader && (
                  <li className="bg-bg-secondary px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Outras entradas
                  </li>
                )}
                <li>
                  <button
                    type="button"
                    data-entry-uuid={entry.uuid.id}
                    draggable={draggable}
                    onDragStart={(e) => handleDragStart(e, entry)}
                    onClick={() => void handleEntryClick(entry.uuid.id)}
                    onKeyDown={(e) => void handleKeyDown(e, idx)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                      draggable && "cursor-grab active:cursor-grabbing",
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
                          "flex min-w-0 items-center gap-1 font-semibold text-sm",
                          selected && "text-selected-entry-foreground",
                        )}
                      >
                        {favorite && (
                          <Star className="size-3.5 shrink-0 fill-amber-400 text-amber-500" />
                        )}
                        <span className="truncate">
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
                      </span>
                      {subtitle && (
                        <span className="block text-xs text-muted-foreground truncate">
                          {subtitle}
                        </span>
                      )}
                      {isSearching && (
                        <span className="block text-xs text-muted-foreground/70 truncate">
                          {getGroupPath(entry, recycleBinUuidId)}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              </Fragment>
            );
          })}
        </ul>
      )}
    </section>
  );
}
