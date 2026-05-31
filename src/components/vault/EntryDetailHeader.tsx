import {
  CopyPlus,
  FolderInput,
  History,
  Pencil,
  Star,
  Trash2,
  Undo2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EntryDetailHeaderProps {
  title: string;
  updatedLabel: string;
  groupName: string;
  favorite: boolean;
  favoriting: boolean;
  inRecycleBin: boolean;
  restoring: boolean;
  duplicating: boolean;
  historyCount: number;
  canMove: boolean;
  onOpenHistory: () => void;
  onRestore: () => void;
  onToggleFavorite: () => void;
  onDuplicate: () => void;
  onEdit: () => void;
  onMove: () => void;
  onDelete: () => void;
}

export function EntryDetailHeader({
  title,
  updatedLabel,
  groupName,
  favorite,
  favoriting,
  inRecycleBin,
  restoring,
  duplicating,
  historyCount,
  canMove,
  onOpenHistory,
  onRestore,
  onToggleFavorite,
  onDuplicate,
  onEdit,
  onMove,
  onDelete,
}: EntryDetailHeaderProps) {
  return (
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
        {historyCount > 0 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onOpenHistory}
            title="Ver histórico da entrada"
          >
            <History />
            Histórico
          </Button>
        )}
        {inRecycleBin ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRestore}
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
              onClick={onToggleFavorite}
              disabled={favoriting}
              title={
                favorite ? "Remover dos favoritos" : "Adicionar aos favoritos"
              }
              aria-label={
                favorite
                  ? "Remover entrada dos favoritos"
                  : "Adicionar entrada aos favoritos"
              }
              className={cn(favorite && "text-amber-500 hover:text-amber-500")}
            >
              <Star className={cn(favorite && "fill-current")} />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onDuplicate}
              disabled={duplicating}
              title="Duplicar entrada"
              aria-label="Duplicar entrada"
            >
              <CopyPlus />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onEdit}
              title="Editar entrada (Ctrl+E)"
            >
              <Pencil />
              Editar
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onMove}
              disabled={!canMove}
              title="Mover para pasta"
            >
              <FolderInput />
              Mover
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onDelete}
              title="Mover para a lixeira (Delete)"
              className="text-destructive hover:text-destructive"
            >
              <Trash2 />
            </Button>
          </>
        )}
      </div>
    </header>
  );
}
