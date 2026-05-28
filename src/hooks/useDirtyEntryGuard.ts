import { useCallback } from "react";

import { confirmDialog } from "@/lib/confirm";
import { getHasUnsavedChanges } from "@/stores/vault";

interface DirtyEntryGuardOptions {
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

export function useDirtyEntryGuard({
  description,
  confirmLabel = "Descartar e continuar",
  cancelLabel = "Voltar e salvar",
}: DirtyEntryGuardOptions): () => Promise<boolean> {
  return useCallback(async (): Promise<boolean> => {
    if (!getHasUnsavedChanges()) return true;

    return confirmDialog({
      title: "Mudanças não salvas",
      description,
      confirmLabel,
      cancelLabel,
      variant: "danger",
    });
  }, [cancelLabel, confirmLabel, description]);
}
