import { Check, Folder, Search } from "lucide-react";
import type { KdbxEntry, KdbxGroup } from "kdbxweb";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  GROUP_ICON_BY_ID,
  GROUP_ICON_COLOR_BY_ID,
} from "@/lib/group-icons";
import { cn } from "@/lib/utils";
import {
  buildMoveEntryTargetOptions,
  type MoveEntryTargetOption,
} from "@/lib/vault-tree";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: KdbxEntry;
  rootGroup: KdbxGroup;
  recycleBinUuidId: string | null;
  onConfirm: (targetGroup: KdbxGroup) => Promise<boolean>;
};

export function MoveEntryDialog({
  open,
  onOpenChange,
  entry,
  rootGroup,
  recycleBinUuidId,
  onConfirm,
}: Props) {
  const currentGroupUuid = entry.parentGroup?.uuid.id ?? null;
  const options = useMemo(
    () =>
      buildMoveEntryTargetOptions(
        rootGroup,
        currentGroupUuid,
        recycleBinUuidId,
      ),
    [rootGroup, currentGroupUuid, recycleBinUuidId],
  );
  const defaultTargetUuid =
    options.find((option) => !option.disabled)?.uuid ?? null;

  const [query, setQuery] = useState("");
  const [selectedUuid, setSelectedUuid] = useState<string | null>(
    defaultTargetUuid,
  );
  const [submitting, setSubmitting] = useState(false);

  const sessionKey = `${open ? "1" : "0"}|${entry.uuid.id}|${currentGroupUuid ?? ""}`;
  const [prevSessionKey, setPrevSessionKey] = useState(sessionKey);
  if (prevSessionKey !== sessionKey) {
    setPrevSessionKey(sessionKey);
    setQuery("");
    setSelectedUuid(defaultTargetUuid);
    setSubmitting(false);
  }

  const filteredOptions = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("pt-BR");
    if (!normalized) return options;
    return options.filter((option) =>
      option.name.toLocaleLowerCase("pt-BR").includes(normalized),
    );
  }, [options, query]);

  const selectedOption =
    options.find((option) => option.uuid === selectedUuid) ?? null;
  const canSubmit = !!selectedOption && !selectedOption.disabled && !submitting;

  async function handleSubmit() {
    if (!canSubmit || !selectedOption) return;
    setSubmitting(true);
    const ok = await onConfirm(selectedOption.group);
    setSubmitting(false);
    if (ok) onOpenChange(false);
  }

  function handleSelect(option: MoveEntryTargetOption) {
    if (option.disabled || submitting) return;
    setSelectedUuid(option.uuid);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Mover para pasta</DialogTitle>
          <DialogDescription>
            Escolha a pasta de destino para esta entrada.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar pasta"
            className="pl-9"
            disabled={submitting}
          />
        </div>

        <div className="max-h-[320px] overflow-y-auto rounded-md border border-border">
          {filteredOptions.length === 0 ? (
            <div className="px-3 py-8 text-center text-sm text-muted-foreground">
              Nenhuma pasta encontrada.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filteredOptions.map((option) => (
                <MoveTargetRow
                  key={option.uuid}
                  option={option}
                  selected={option.uuid === selectedUuid}
                  submitting={submitting}
                  onSelect={handleSelect}
                />
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={!canSubmit}
          >
            {submitting ? "Movendo..." : "Mover"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MoveTargetRow({
  option,
  selected,
  submitting,
  onSelect,
}: {
  option: MoveEntryTargetOption;
  selected: boolean;
  submitting: boolean;
  onSelect: (option: MoveEntryTargetOption) => void;
}) {
  const Icon = GROUP_ICON_BY_ID[option.iconId ?? "folder"] ?? Folder;
  const iconColorClass =
    GROUP_ICON_COLOR_BY_ID[option.iconColorId ?? "default"].className;

  return (
    <button
      type="button"
      onClick={() => onSelect(option)}
      disabled={option.disabled || submitting}
      className={cn(
        "flex w-full items-center gap-2 px-3 py-2 text-left text-sm outline-none transition-colors",
        "hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50",
        selected && "bg-selected text-selected-foreground",
        option.disabled && "cursor-not-allowed opacity-55 hover:bg-transparent",
      )}
      style={{ paddingLeft: `${12 + option.depth * 16}px` }}
    >
      <Icon className={cn("size-4 shrink-0", iconColorClass)} />
      <span className="min-w-0 flex-1 truncate">{option.name}</span>
      {option.disabledReason === "current-group" ? (
        <span className="shrink-0 text-xs text-muted-foreground">
          Atual
        </span>
      ) : selected ? (
        <Check className="size-4 shrink-0" />
      ) : (
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {option.entryCount}
        </span>
      )}
    </button>
  );
}
