import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Info,
  Pencil,
  ShieldCheck,
  ShieldAlert,
} from "lucide-react";
import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { confirmDialog } from "@/lib/confirm";
import {
  auditVaultEntries,
  type AuditAffectedEntry,
  type AuditFinding,
  type AuditSeverity,
} from "@/lib/vault-audit";
import { cn } from "@/lib/utils";
import {
  getHasUnsavedChanges,
  useAllEntries,
  useVaultStore,
} from "@/stores/vault";

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
  const selectGroup = useVaultStore((s) => s.selectGroup);
  const selectEntry = useVaultStore((s) => s.selectEntry);
  const enterEditMode = useVaultStore((s) => s.enterEditMode);
  const setSearchQuery = useVaultStore((s) => s.setSearchQuery);

  async function confirmDiscardIfDirty(): Promise<boolean> {
    if (!getHasUnsavedChanges()) return true;
    return confirmDialog({
      title: "Mudanças não salvas",
      description:
        "Você tem mudanças não salvas. Abrir outra entrada vai descartar essas mudanças. Continuar?",
      confirmLabel: "Descartar e continuar",
      cancelLabel: "Voltar e salvar",
      variant: "danger",
    });
  }

  async function openAffectedEntry(
    affectedEntry: AuditAffectedEntry,
    mode: "view" | "edit",
  ) {
    const parentGroup = affectedEntry.source.parentGroup;
    if (!parentGroup) return;
    if (!(await confirmDiscardIfDirty())) return;

    setSearchQuery("");
    selectGroup(parentGroup.uuid.id);
    if (mode === "edit") {
      enterEditMode(affectedEntry.id);
    } else {
      selectEntry(affectedEntry.id);
    }
    onOpenChange(false);
  }

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
                    onOpenEntry={(entry) => void openAffectedEntry(entry, "view")}
                    onEditEntry={(entry) => void openAffectedEntry(entry, "edit")}
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

function AuditFindingItem({
  finding,
  onOpenEntry,
  onEditEntry,
}: {
  finding: AuditFinding;
  onOpenEntry: (entry: AuditAffectedEntry) => void;
  onEditEntry: (entry: AuditAffectedEntry) => void;
}) {
  const Icon = finding.severity === "high" ? ShieldAlert : AlertTriangle;
  const singleEntry =
    finding.affectedEntries.length === 1 ? finding.affectedEntries[0] : null;

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

          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">{finding.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {finding.description}
              </p>
            </div>
            {singleEntry && (
              <AuditEntryActions
                entry={singleEntry}
                onOpen={onOpenEntry}
                onEdit={onEditEntry}
              />
            )}
          </div>

          {!singleEntry && finding.affectedEntries.length > 0 && (
            <div className="rounded-md border border-border bg-background">
              {finding.affectedEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center gap-2 border-b border-border px-2 py-1.5 last:border-b-0"
                >
                  <span className="min-w-0 flex-1 truncate text-xs">
                    {affectedEntryLabel(entry)}
                  </span>
                  <AuditEntryActions
                    entry={entry}
                    onOpen={onOpenEntry}
                    onEdit={onEditEntry}
                    compact
                  />
                </div>
              ))}
            </div>
          )}

          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <Info className="mt-0.5 size-3.5 shrink-0" />
            <span>{finding.recommendation}</span>
          </p>
        </div>
      </div>
    </li>
  );
}

function AuditEntryActions({
  entry,
  onOpen,
  onEdit,
  compact = false,
}: {
  entry: AuditAffectedEntry;
  onOpen: (entry: AuditAffectedEntry) => void;
  onEdit: (entry: AuditAffectedEntry) => void;
  compact?: boolean;
}) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      <Button
        type="button"
        variant="outline"
        size={compact ? "icon-sm" : "sm"}
        onClick={() => onOpen(entry)}
        title="Abrir entrada"
        aria-label={`Abrir ${affectedEntryLabel(entry)}`}
      >
        <ArrowRight />
        {!compact && "Abrir"}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size={compact ? "icon-sm" : "sm"}
        onClick={() => onEdit(entry)}
        title="Corrigir entrada"
        aria-label={`Corrigir ${affectedEntryLabel(entry)}`}
      >
        <Pencil />
        {!compact && "Corrigir"}
      </Button>
    </div>
  );
}

function affectedEntryLabel(entry: AuditAffectedEntry): string {
  return entry.title || entry.url || entry.username || "(sem título)";
}
