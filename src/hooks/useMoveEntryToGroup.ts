import type { KdbxEntry, KdbxGroup } from "kdbxweb";
import { useCallback } from "react";
import { toast } from "sonner";

import { useDirtyEntryGuard } from "@/hooks/useDirtyEntryGuard";
import { getTitle } from "@/lib/entry-helpers";
import { moveEntryToGroup } from "@/lib/kdbx";
import { useVaultStore } from "@/stores/vault";

import { useVaultMutationContext } from "./useVaultMutationContext";

export function useMoveEntryToGroup(): (
  entry: KdbxEntry,
  targetGroup: KdbxGroup,
) => Promise<boolean> {
  const mutation = useVaultMutationContext();
  const selectGroup = useVaultStore((s) => s.selectGroup);
  const selectEntry = useVaultStore((s) => s.selectEntry);
  const exitToViewMode = useVaultStore((s) => s.exitToViewMode);
  const confirmDiscardIfDirty = useDirtyEntryGuard({
    description:
      "Você tem mudanças não salvas. Mover a entrada vai descartar essas mudanças. Continuar?",
    confirmLabel: "Descartar e mover",
  });

  return useCallback(
    async (
      entry: KdbxEntry,
      targetGroup: KdbxGroup,
    ): Promise<boolean> => {
      if (!mutation) {
        toast.error("Cofre não está pronto.");
        return false;
      }

      if (entry.parentGroup === targetGroup) {
        toast.info("A entrada já está nesta pasta.");
        return false;
      }

      if (!(await confirmDiscardIfDirty())) {
        return false;
      }
      if (useVaultStore.getState().editMode !== "view") {
        exitToViewMode();
      }

      const result = await moveEntryToGroup(
        mutation.lastFilePath,
        mutation.kdbx,
        entry,
        targetGroup,
      );
      if (!result.ok) {
        toast.error(`Falha ao mover entrada: ${result.error}`);
        return false;
      }

      mutation.incrementVaultVersion();
      selectGroup(targetGroup.uuid.id);
      selectEntry(entry.uuid.id);
      toast.success(
        `"${getTitle(entry) || "(sem título)"}" movida para "${targetGroup.name}" (${result.durationMs}ms)`,
      );
      return true;
    },
    [
      mutation,
      selectGroup,
      selectEntry,
      exitToViewMode,
      confirmDiscardIfDirty,
    ],
  );
}
