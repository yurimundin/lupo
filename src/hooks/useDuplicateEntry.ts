import type { KdbxEntry } from "kdbxweb";
import { useCallback } from "react";
import { toast } from "sonner";

import { useDirtyEntryGuard } from "@/hooks/useDirtyEntryGuard";
import { getTitle } from "@/lib/entry-helpers";
import { duplicateEntryInVault } from "@/lib/kdbx";
import { useVaultStore } from "@/stores/vault";

import { useVaultMutationContext } from "./useVaultMutationContext";

export function useDuplicateEntry(): (entry: KdbxEntry) => Promise<boolean> {
  const mutation = useVaultMutationContext();
  const selectGroup = useVaultStore((s) => s.selectGroup);
  const selectEntry = useVaultStore((s) => s.selectEntry);
  const exitToViewMode = useVaultStore((s) => s.exitToViewMode);
  const confirmDiscardIfDirty = useDirtyEntryGuard({
    description:
      "Você tem mudanças não salvas. Duplicar a entrada vai descartar essas mudanças. Continuar?",
    confirmLabel: "Descartar e duplicar",
  });

  return useCallback(
    async (entry: KdbxEntry): Promise<boolean> => {
      if (!mutation) {
        toast.error("Cofre não está pronto.");
        return false;
      }

      if (!(await confirmDiscardIfDirty())) {
        return false;
      }
      if (useVaultStore.getState().editMode !== "view") {
        exitToViewMode();
      }

      const result = await duplicateEntryInVault(
        mutation.lastFilePath,
        mutation.kdbx,
        entry,
      );
      if (!result.ok) {
        toast.error(`Falha ao duplicar entrada: ${result.error}`);
        return false;
      }

      mutation.incrementVaultVersion();
      const parentUuid = result.entry.parentGroup?.uuid.id;
      if (parentUuid) selectGroup(parentUuid);
      selectEntry(result.entry.uuid.id);
      toast.success(
        `"${getTitle(entry) || "(sem título)"}" duplicada (${result.durationMs}ms)`,
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
