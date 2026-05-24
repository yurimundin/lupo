import { Check } from "lucide-react";
import { useState } from "react";
import type { KdbxGroup } from "kdbxweb";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  GROUP_ICON_OPTIONS,
  getGroupLucideIconId,
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
  ) => Promise<boolean>;
};

export function GroupIconDialog({
  open,
  onOpenChange,
  group,
  onConfirm,
}: Props) {
  const [submittingIconId, setSubmittingIconId] = useState<string | null>(null);
  const selectedIconId = getGroupLucideIconId(group) ?? "folder";

  async function handleSelect(iconId: GroupLucideIconId | null) {
    const submitKey = iconId ?? "folder";
    setSubmittingIconId(submitKey);
    const ok = await onConfirm(group, iconId);
    setSubmittingIconId(null);
    if (ok) onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Alterar icone</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
          {GROUP_ICON_OPTIONS.map((option) => {
            const Icon = option.icon;
            const selected = selectedIconId === option.id;
            const isSubmitting = submittingIconId === option.id;
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
                  void handleSelect(option.id === "folder" ? null : option.id)
                }
                disabled={!!submittingIconId}
                title={option.label}
              >
                <Icon className="size-5" />
                <span className="max-w-full truncate">{option.label}</span>
                {selected && (
                  <Check className="absolute right-1.5 top-1.5 size-3.5" />
                )}
                {isSubmitting && (
                  <span className="absolute inset-x-1 bottom-1 text-[10px] text-muted-foreground">
                    Salvando
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={!!submittingIconId}
          >
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
