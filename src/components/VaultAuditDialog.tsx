import {
  AlertTriangle,
  CheckCircle2,
  Info,
  ShieldCheck,
  ShieldAlert,
} from "lucide-react";
import { useMemo } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  auditVaultEntries,
  type AuditFinding,
  type AuditSeverity,
} from "@/lib/vault-audit";
import { cn } from "@/lib/utils";
import { useAllEntries } from "@/stores/vault";

interface VaultAuditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SEVERITY_LABEL: Record<AuditSeverity, string> = {
  high: "Crítico",
  medium: "Atenção",
  low: "Baixo",
};

const SEVERITY_CLASS: Record<AuditSeverity, string> = {
  high: "border-destructive/40 bg-destructive/10 text-destructive",
  medium: "border-warning/40 bg-warning/10 text-warning",
  low: "border-border bg-muted text-muted-foreground",
};

const SEVERITY_DOT_CLASS: Record<AuditSeverity, string> = {
  high: "bg-destructive",
  medium: "bg-warning",
  low: "bg-muted-foreground",
};

export function VaultAuditDialog({
  open,
  onOpenChange,
}: VaultAuditDialogProps) {
  const entries = useAllEntries();
  const audit = useMemo(() => auditVaultEntries(entries), [entries]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[720px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-primary" />
            Auditoria do cofre
          </DialogTitle>
          <DialogDescription>
            Análise local das entradas fora da Lixeira. Nenhum dado sai deste
            dispositivo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <SummaryCard
              label="Entradas"
              value={audit.summary.totalEntries}
              tone="neutral"
            />
            <SummaryCard
              label="Crítico"
              value={audit.summary.high}
              tone="high"
            />
            <SummaryCard
              label="Atenção"
              value={audit.summary.medium}
              tone="medium"
            />
            <SummaryCard label="Baixo" value={audit.summary.low} tone="low" />
          </div>

          {audit.findings.length === 0 ? (
            <div className="flex items-start gap-3 rounded-md border border-border bg-muted/30 p-4">
              <CheckCircle2 className="mt-0.5 size-5 text-emerald-500" />
              <div>
                <p className="text-sm font-medium">Nenhum alerta encontrado</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  As entradas analisadas não têm senhas fracas, reutilizadas ou
                  metadados básicos ausentes.
                </p>
              </div>
            </div>
          ) : (
            <div className="max-h-[420px] overflow-y-auto rounded-md border border-border">
              <ul className="divide-y divide-border">
                {audit.findings.map((finding, index) => (
                  <AuditFindingItem
                    key={`${finding.type}-${finding.entryIds.join("-")}-${index}`}
                    finding={finding}
                  />
                ))}
              </ul>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: AuditSeverity | "neutral";
}) {
  const className =
    tone === "neutral"
      ? "border-border bg-background text-foreground"
      : SEVERITY_CLASS[tone];

  return (
    <div className={cn("rounded-md border px-3 py-2", className)}>
      <p className="text-xs font-medium">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function AuditFindingItem({ finding }: { finding: AuditFinding }) {
  const Icon = finding.severity === "high" ? ShieldAlert : AlertTriangle;

  return (
    <li className="p-3">
      <div className="flex items-start gap-3">
        <Icon
          className={cn(
            "mt-0.5 size-4 shrink-0",
            finding.severity === "high" ? "text-destructive" : "text-warning",
            finding.severity === "low" && "text-muted-foreground",
          )}
        />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
                SEVERITY_CLASS[finding.severity],
              )}
            >
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  SEVERITY_DOT_CLASS[finding.severity],
                )}
              />
              {SEVERITY_LABEL[finding.severity]}
            </span>
            {finding.entryIds.length > 1 && (
              <span className="text-xs text-muted-foreground">
                {finding.entryIds.length} entradas afetadas
              </span>
            )}
          </div>

          <div>
            <p className="text-sm font-medium">{finding.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {finding.description}
            </p>
          </div>

          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <Info className="mt-0.5 size-3.5 shrink-0" />
            <span>{finding.recommendation}</span>
          </p>
        </div>
      </div>
    </li>
  );
}
