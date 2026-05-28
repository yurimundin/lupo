// Hook que restaura uma entry da Lixeira (RecycleBin) para o grupo raiz.
//
// Diferenças em relação ao `useDeleteEntry`:
//   - Sem `confirmDialog`: restaurar é ação benigna (reverte uma deleção),
//     confirmação seria fricção desnecessária. Padrão alinhado com
//     KeePassXC e Gmail (restaurar email da lixeira é instantâneo).
//   - Toast de sucesso menciona o destino ("grupo raiz") porque o usuário
//     pode estranhar não ter caminho de "voltar para o grupo de origem"
//     (limitação do KDBX, ver doc da função em lib/kdbx.ts).
//
// Fluxo:
//   1. Validações (cofre aberto, lastFilePath presente).
//   2. `restoreEntryFromRecycleBin(filePath, kdbx, entry)`:
//      - kdbx.move(entry, root) — mutação in-place
//      - saveVault — backup atômico + magic check + rename
//   3. Em sucesso: `incrementVaultVersion`, `selectEntry(null)` (entry
//      saiu da Lixeira, lista atual mudou), toast verde.
//   4. Em erro: toast vermelho, NÃO incrementa vaultVersion.
//
// Trade-off do erro: ver comentário em `restoreEntryFromRecycleBin`.

import type { KdbxEntry } from "kdbxweb";
import { useCallback } from "react";
import { toast } from "sonner";

import { restoreEntryFromRecycleBin } from "@/lib/kdbx";
import { useVaultStore } from "@/stores/vault";

import { useVaultMutationContext } from "./useVaultMutationContext";

export function useRestoreEntry(): (entry: KdbxEntry) => Promise<boolean> {
  const mutation = useVaultMutationContext();
  const selectEntry = useVaultStore((s) => s.selectEntry);

  return useCallback(
    async (entry: KdbxEntry): Promise<boolean> => {
      if (!mutation) {
        toast.error("Cofre não está pronto.");
        return false;
      }

      const result = await restoreEntryFromRecycleBin(
        mutation.lastFilePath,
        mutation.kdbx,
        entry,
      );
      if (!result.ok) {
        toast.error(`Falha ao restaurar: ${result.error}`);
        return false;
      }

      mutation.incrementVaultVersion();
      // Limpa seleção: entry saiu da Lixeira (lista atual da Lixeira muda).
      // Próxima entry da lista assume foco automaticamente via efeito do
      // EntryList (ou estado vazio se Lixeira ficou sem entries).
      selectEntry(null);
      toast.success(
        `Entrada restaurada para o grupo raiz (${result.durationMs}ms)`,
      );
      return true;
    },
    [mutation, selectEntry],
  );
}
