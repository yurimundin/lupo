// Hook que move uma entry pra Lixeira (RecycleBin) do cofre. Soft-delete
// compatível com KeePass/KeePassXC.
//
// Fluxo:
//   1. Validações (cofre aberto, lastFilePath presente).
//   2. ConfirmDialog "Mover para a lixeira?" com nome da entry.
//   3. `moveEntryToRecycleBin(filePath, kdbx, entry)` (ver lib/kdbx.ts):
//      - cria RecycleBin se não existir
//      - kdbx.move(entry, recycleBin) — mutação in-place
//      - saveVault — backup atômico + magic check + rename
//   4. Em sucesso: `incrementVaultVersion`, `selectEntry(null)` (entry
//      saiu do grupo atual), toast verde.
//   5. Em erro: toast vermelho, NÃO incrementa vaultVersion (UI segue
//      mostrando estado antigo até próxima mutação bem-sucedida).
//
// Trade-off do erro: ver comentário em `moveEntryToRecycleBin`. Aceitável
// para MVP.

import type { KdbxEntry } from "kdbxweb";
import { useCallback } from "react";
import { toast } from "sonner";

import { confirmDialog } from "@/lib/confirm";
import { getTitle } from "@/lib/entry-helpers";
import { moveEntryToRecycleBin } from "@/lib/kdbx";
import { useVaultStore } from "@/stores/vault";

import { useVaultMutationContext } from "./useVaultMutationContext";

export function useDeleteEntry(): (entry: KdbxEntry) => Promise<boolean> {
  const mutation = useVaultMutationContext();
  const selectEntry = useVaultStore((s) => s.selectEntry);

  return useCallback(
    async (entry: KdbxEntry): Promise<boolean> => {
      if (!mutation) {
        toast.error("Cofre não está pronto.");
        return false;
      }

      const title = getTitle(entry) || "(sem título)";

      const confirmed = await confirmDialog({
        title: "Mover para a lixeira?",
        description: `A entrada "${title}" vai para a Lixeira. Você pode restaurá-la ou apagá-la permanentemente depois.`,
        confirmLabel: "Mover para lixeira",
        cancelLabel: "Cancelar",
        variant: "danger",
      });

      if (!confirmed) return false;

      const result = await moveEntryToRecycleBin(
        mutation.lastFilePath,
        mutation.kdbx,
        entry,
      );
      if (!result.ok) {
        toast.error(`Falha ao mover: ${result.error}`);
        return false;
      }

      mutation.incrementVaultVersion();
      // Limpa seleção: entry saiu do grupo atual (foi pra Lixeira).
      // Quem quiser ver onde está agora seleciona o grupo Lixeira na
      // sidebar.
      selectEntry(null);
      toast.success(`Movido para a lixeira (${result.durationMs}ms)`);
      return true;
    },
    [mutation, selectEntry],
  );
}
