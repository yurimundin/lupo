import type { KdbxEntry } from "kdbxweb";
import { useCallback } from "react";
import { toast } from "sonner";

import { confirmDialog } from "@/lib/confirm";
import {
  getEntryHistoryItems,
  removeEntryHistoryVersionInVault,
} from "@/lib/kdbx";

import { useVaultMutationContext } from "./useVaultMutationContext";

export function useRemoveEntryHistory(): (
  entry: KdbxEntry,
  historyIndex: number,
) => Promise<boolean> {
  const mutation = useVaultMutationContext();

  return useCallback(
    async (entry: KdbxEntry, historyIndex: number): Promise<boolean> => {
      if (!mutation) {
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

      const confirmed = await confirmDialog({
        title: "Apagar versão antiga?",
        description:
          "Esta versão será removida permanentemente do histórico da entrada.",
        confirmLabel: "Apagar versão",
        cancelLabel: "Cancelar",
        variant: "danger",
      });
      if (!confirmed) return false;

      const result = await removeEntryHistoryVersionInVault(
        mutation.lastFilePath,
        mutation.kdbx,
        entry,
        historyIndex,
      );
      if (!result.ok) {
        toast.error(`Falha ao apagar histórico: ${result.error}`);
        return false;
      }

      mutation.incrementVaultVersion();
      toast.success(`Versão antiga apagada (${result.durationMs}ms).`);
      return true;
    },
    [mutation],
  );
}
