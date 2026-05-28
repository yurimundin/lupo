import type { KdbxEntry } from "kdbxweb";
import { useCallback } from "react";
import { toast } from "sonner";

import { confirmDialog } from "@/lib/confirm";
import {
  getEntryHistoryItems,
  restoreEntryHistoryVersionInVault,
} from "@/lib/kdbx";
import { useVaultStore } from "@/stores/vault";

export function useRestoreEntryHistory(): (
  entry: KdbxEntry,
  historyIndex: number,
) => Promise<boolean> {
  const kdbx = useVaultStore((s) => s.kdbx);
  const lastFilePath = useVaultStore((s) => s.lastFilePath);
  const incrementVaultVersion = useVaultStore((s) => s.incrementVaultVersion);

  return useCallback(
    async (entry: KdbxEntry, historyIndex: number): Promise<boolean> => {
      if (!kdbx || !lastFilePath) {
        toast.error("Cofre não está pronto.");
        return false;
      }

      const historyItem = getEntryHistoryItems(entry).find(
        (item) => item.index === historyIndex,
      );
      if (!historyItem) {
        toast.error("Versão de histórico não encontrada.");
        return false;
      }

      const title = historyItem.title || "(sem título)";
      const confirmed = await confirmDialog({
        title: "Restaurar versão?",
        description: `A entrada atual será salva no histórico e os campos serão restaurados para "${title}".`,
        confirmLabel: "Restaurar versão",
        cancelLabel: "Cancelar",
        variant: "danger",
      });
      if (!confirmed) return false;

      const result = await restoreEntryHistoryVersionInVault(
        lastFilePath,
        kdbx,
        entry,
        historyIndex,
      );
      if (!result.ok) {
        toast.error(`Falha ao restaurar histórico: ${result.error}`);
        return false;
      }

      incrementVaultVersion();
      toast.success(`Versão restaurada (${result.durationMs}ms).`);
      return true;
    },
    [kdbx, lastFilePath, incrementVaultVersion],
  );
}
