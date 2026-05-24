import { Check } from "lucide-react";
import { useState } from "react";
import type { KdbxGroup } from "kdbxweb";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  GROUP_ICON_COLOR_OPTIONS,
  GROUP_ICON_OPTIONS,
  getGroupIconColorId,
  getGroupLucideIconId,
  type GroupIconColorId,
  type GroupLucideIconId,
} from "@/lib/group-icons";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: KdbxGroup;
  onConfirm: (
    group: KdbxGroup,
    iconId: GroupLucideIconId | null,
    colorId: GroupIconColorId | null,
  ) => Promise<boolean>;
};

export function GroupIconDialog({
  open,
  onOpenChange,
  group,
  onConfirm,
}: Props) {
  const currentIconId = getGroupLucideIconId(group) ?? "folder";
  const currentColorId = getGroupIconColorId(group) ?? "default";
  const [selectedIconId, setSelectedIconId] =
    useState<GroupLucideIconId>(currentIconId);
  const [selectedColorId, setSelectedColorId] =
    useState<GroupIconColorId>(currentColorId);
  const [submitting, setSubmitting] = useState(false);

  const sessionKey = `${open ? "1" : "0"}|${group.uuid.id}`;
  const [prevSessionKey, setPrevSessionKey] = useState(sessionKey);
  if (prevSessionKey !== sessionKey) {
    setPrevSessionKey(sessionKey);
    setSelectedIconId(currentIconId);
    setSelectedColorId(currentColorId);
    setSubmitting(false);
  }

  async function handleSubmit() {
    setSubmitting(true);
    const ok = await onConfirm(
      group,
      selectedIconId === "folder" ? null : selectedIconId,
      selectedColorId === "default" ? null : selectedColorId,
    );
    setSubmitting(false);
    if (ok) onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Alterar ícone e cor</DialogTitle>
          <DialogDescription>
            Escolha uma aparência visual para identificar esta pasta no
            Sec.Basis.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
            {GROUP_ICON_OPTIONS.map((option) => {
              const Icon = option.icon;
              const selected = selectedIconId === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  className={cn(
                    "relative h-20 rounded-md border border-border bg-background px-2 py-2 text-xs transition-colors outline-none",
                    "flex flex-col items-center justify-center gap-2 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50",
                    selected && "border-primary bg-primary/10 text-primary",
                  )}
                  onClick={() =>
                    setSelectedIconId(option.id)
                  }
                  disabled={submitting}
                  title={option.label}
                >
                  <Icon className="size-5" />
                  <span className="max-w-full truncate">{option.label}</span>
                  {selected && (
                    <Check className="absolute right-1.5 top-1.5 size-3.5" />
                  )}
                </button>
              );
            })}
          </div>

          <div className="space-y-2">
            <span className="text-xs font-medium text-muted-foreground">
              Cor do ícone
            </span>
            <div className="flex flex-wrap gap-2">
              {GROUP_ICON_COLOR_OPTIONS.map((option) => {
                const selected = selectedColorId === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    className={cn(
                      "size-8 rounded-full border border-border flex items-center justify-center transition-colors outline-none",
                      "hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50",
                      selected && "border-primary ring-2 ring-primary/30",
                    )}
                    onClick={() =>
                      setSelectedColorId(option.id)
                    }
                    disabled={submitting}
                    title={option.label}
                    aria-label={option.label}
                  >
                    <span
                      className={cn(
                        "size-4 rounded-full",
                        option.swatchClassName,
                      )}
                    />
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Fechar
          </Button>
          <Button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={submitting}
          >
            {submitting ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
