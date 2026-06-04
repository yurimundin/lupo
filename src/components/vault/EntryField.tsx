import { Copy } from "lucide-react";

import { Button } from "@/components/ui/button";

interface EntryFieldProps {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  valueClassName?: string;
  onCopy?: (() => void) | undefined;
  copyTitle?: string;
  copyButtonLabel?: string;
  extraAction?: React.ReactNode;
}

export function EntryField({
  icon,
  label,
  value,
  valueClassName,
  onCopy,
  copyTitle = "Copiar",
  copyButtonLabel,
  extraAction,
}: EntryFieldProps) {
  return (
    <div className="rounded-md border border-border bg-bg-secondary px-3 py-2.5">
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
        {icon}
        <span className="font-medium">{label}</span>
      </div>
      <div className="flex items-start gap-2">
        <div className={`flex-1 text-sm ${valueClassName ?? ""}`}>{value}</div>
        <div className="flex items-center gap-0.5 shrink-0">
          {extraAction}
          {onCopy && (
            <Button
              variant="ghost"
              size={copyButtonLabel ? "sm" : "icon-sm"}
              onClick={onCopy}
              title={copyTitle}
              aria-label={copyTitle}
            >
              <Copy />
              {copyButtonLabel}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
