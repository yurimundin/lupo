import { confirmDialog } from "@/lib/confirm";
import { getHasUnsavedChanges, useVaultStore } from "@/stores/vault";

export interface RequestLockOptions {
  /**
   * Se informado e houver draft pendente, o dialog auto-resolve depois
   * desse intervalo. Timeout descarta e bloqueia por segurança.
   */
  autoConfirmAfterMs?: number;
}

export async function requestLockWithGuard(
  opts: RequestLockOptions = {},
): Promise<void> {
  if (!getHasUnsavedChanges()) {
    useVaultStore.getState().lock();
    return;
  }

  const confirmed = await confirmDialog({
    title: "Mudanças não salvas",
    description:
      "Você tem mudanças não salvas. Bloquear o cofre vai descartar essas mudanças. Continuar?",
    confirmLabel: "Descartar e bloquear",
    cancelLabel: "Voltar e salvar",
    variant: "danger",
    autoResolveAfterMs: opts.autoConfirmAfterMs,
    autoResolveValue: true,
  });

  if (confirmed) {
    useVaultStore.getState().lock();
  }
}
