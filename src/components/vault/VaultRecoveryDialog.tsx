import { AlertTriangle, ArchiveRestore, FileLock2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  canRestoreBackup,
  getRecoverySummary,
} from "@/lib/vault-recovery";
import {
  restoreVaultBackup,
  type VaultRecoveryState,
} from "@/services/tauri/fs";

type Props = {
  open: boolean;
  filePath: string;
  recovery: VaultRecoveryState | null;
  onOpenCurrent: () => void;
  onRecovered: () => void;
  onOpenChange: (open: boolean) => void;
};

export function VaultRecoveryDialog({
  open,
  filePath,
  recovery,
  onOpenCurrent,
  onRecovered,
  onOpenChange,
}: Props) {
  const [restoring, setRestoring] = useState(false);

  if (!recovery) return null;

  const restoreAvailable = canRestoreBackup(recovery);

  async function handleRestore() {
    if (!restoreAvailable || restoring) return;
    setRestoring(true);
    try {
      const result = await restoreVaultBackup(filePath);
      toast.success(
        `Backup restaurado. Cofre anterior preservado em ${baseName(
          result.previousVaultBackupPath,
        )}.`,
      );
      onRecovered();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setRestoring(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-warning" />
            Recuperacao de cofre
          </DialogTitle>
          <DialogDescription>
            Revise os arquivos encontrados e escolha se deseja restaurar o
            backup.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Alert>
            <FileLock2 className="size-4" />
            <AlertTitle>{baseName(filePath)}</AlertTitle>
            <AlertDescription>{getRecoverySummary(recovery)}</AlertDescription>
          </Alert>

          <div className="rounded-md border border-border p-3 text-sm space-y-2">
            <RecoveryLine
              label="Arquivo temporario"
              active={recovery.tmp.exists}
              detail={recovery.tmp.exists ? baseName(recovery.tmp.path) : "nao encontrado"}
            />
            <RecoveryLine
              label="Backup"
              active={recovery.bak.exists}
              detail={
                recovery.bak.exists
                  ? recovery.bak.hasKdbxMagic
                    ? "backup valido encontrado"
                    : "backup encontrado, mas invalido"
                  : "nao encontrado"
              }
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={onOpenCurrent}
            disabled={restoring}
          >
            Abrir cofre atual
          </Button>
          <Button
            type="button"
            onClick={() => void handleRestore()}
            disabled={!restoreAvailable || restoring}
          >
            <ArchiveRestore />
            {restoring ? "Restaurando..." : "Restaurar backup"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RecoveryLine({
  label,
  active,
  detail,
}: {
  label: string;
  active: boolean;
  detail: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className={active ? "text-foreground" : "text-muted-foreground"}>
        {detail}
      </span>
    </div>
  );
}

function baseName(filePath: string): string {
  const parts = filePath.split(/[\\/]/);
  return parts[parts.length - 1] || filePath;
}
