import type { KdbxEntry, KdbxGroup } from "kdbxweb";
import { useCallback } from "react";
import { toast } from "sonner";

import { confirmDialog } from "@/lib/confirm";
import { getTitle } from "@/lib/entry-helpers";
import { moveEntryToGroup } from "@/lib/kdbx";
import { getHasUnsavedChanges, useVaultStore } from "@/stores/vault";

export function useMoveEntryToGroup(): (
  entry: KdbxEntry,
  targetGroup: KdbxGroup,
) => Promise<boolean> {
  const kdbx = useVaultStore((s) => s.kdbx);
  const lastFilePath = useVaultStore((s) => s.lastFilePath);
  const incrementVaultVersion = useVaultStore((s) => s.incrementVaultVersion);
  const selectGroup = useVaultStore((s) => s.selectGroup);
  const selectEntry = useVaultStore((s) => s.selectEntry);
  const exitToViewMode = useVaultStore((s) => s.exitToViewMode);

  return useCallback(
    async (
      entry: KdbxEntry,
      targetGroup: KdbxGroup,
    ): Promise<boolean> => {
      if (!kdbx || !lastFilePath) {
        toast.error("Cofre não está pronto.");
        return false;
      }

      if (entry.parentGroup === targetGroup) {
        toast.info("A entrada já está nesta pasta.");
        return false;
      }

      if (getHasUnsavedChanges()) {
        const confirmed = await confirmDialog({
          title: "Mudanças não salvas",
          description:
            "Você tem mudanças não salvas. Mover a entrada vai descartar essas mudanças. Continuar?",
          confirmLabel: "Descartar e mover",
          cancelLabel: "Voltar e salvar",
          variant: "danger",
        });
        if (!confirmed) return false;
        exitToViewMode();
      }

      const result = await moveEntryToGroup(
        lastFilePath,
        kdbx,
        entry,
        targetGroup,
      );
      if (!result.ok) {
        toast.error(`Falha ao mover entrada: ${result.error}`);
        return false;
      }

      incrementVaultVersion();
      selectGroup(targetGroup.uuid.id);
      selectEntry(entry.uuid.id);
      toast.success(
        `"${getTitle(entry) || "(sem título)"}" movida para "${targetGroup.name}" (${result.durationMs}ms)`,
      );
      return true;
    },
    [
      kdbx,
      lastFilePath,
      incrementVaultVersion,
      selectGroup,
      selectEntry,
      exitToViewMode,
    ],
  );
}
