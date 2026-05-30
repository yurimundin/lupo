// Hook que esvazia a Lixeira (RecycleBin) — hard-delete em massa.
//
// Diferenças em relação a `useDeleteEntry` / `useRestoreEntry`:
//   - Confirmação OBRIGATÓRIA com lembrete explícito de fazer backup
//     externo do `.kdbx` antes (Lupo NÃO tem rollback após esvaziar).
//   - Recebe `entryCount` como argumento porque o título do dialog precisa
//     dele dinamicamente — e o componente chamador (`EntryList`) já tem o
//     número via `useEntriesOfCurrentGroup().length`. Evita o hook
//     re-derivar a contagem (que dependeria de mais selectors).
//   - Pluralização correta de "entrada" / "entradas" no título e no toast.
//
// Fluxo:
//   1. Validações (cofre aberto, lastFilePath presente, count > 0).
//   2. ConfirmDialog "Apagar permanentemente N entradas?" com aviso de
//      backup.
//   3. `emptyRecycleBin(filePath, kdbx)`:
//      - kdbx.remove() em cada entry → tombstones em meta.deletedObjects
//      - saveVault — backup atômico + magic check + rename
//   4. Em sucesso: `incrementVaultVersion`, `selectEntry(null)` (entries
//      não existem mais), toast verde com contagem.
//   5. Em erro: toast vermelho, NÃO incrementa vaultVersion (UI segue
//      mostrando entries, refletindo o estado real do disco).

import { useCallback } from "react";
import { toast } from "sonner";

import { confirmDialog } from "@/lib/confirm";
import { emptyRecycleBin } from "@/lib/kdbx";
import { useVaultStore } from "@/stores/vault";

export function useEmptyRecycleBin(): (entryCount: number) => Promise<boolean> {
  const kdbx = useVaultStore((s) => s.kdbx);
  const lastFilePath = useVaultStore((s) => s.lastFilePath);
  const incrementVaultVersion = useVaultStore((s) => s.incrementVaultVersion);
  const selectEntry = useVaultStore((s) => s.selectEntry);

  return useCallback(
    async (entryCount: number): Promise<boolean> => {
      if (!kdbx || !lastFilePath) {
        toast.error("Cofre não está pronto.");
        return false;
      }

      if (entryCount === 0) {
        // Botão deveria estar escondido nesse caso (decisão de UX), mas
        // defesa em profundidade — não dispara nem o dialog.
        return false;
      }

      const noun = entryCount === 1 ? "entrada" : "entradas";

      const confirmed = await confirmDialog({
        title: `Apagar permanentemente ${entryCount} ${noun}?`,
        description: `Esta ação não pode ser desfeita pelo Lupo. Se você precisa de backup, faça uma cópia do arquivo .kdbx antes de continuar. As entradas atuais permanecem na Lixeira até você confirmar.`,
        confirmLabel: "Apagar permanentemente",
        cancelLabel: "Cancelar",
        variant: "danger",
      });

      if (!confirmed) return false;

      const result = await emptyRecycleBin(lastFilePath, kdbx);
      if (!result.ok) {
        toast.error(`Falha ao esvaziar Lixeira: ${result.error}`);
        return false;
      }

      incrementVaultVersion();
      // Limpa seleção: entries removidas não existem mais no cofre.
      selectEntry(null);

      const deletedNoun = result.entriesDeleted === 1 ? "entrada" : "entradas";
      toast.success(
        `Lixeira esvaziada (${result.entriesDeleted} ${deletedNoun}, ${result.durationMs}ms)`,
      );
      return true;
    },
    [kdbx, lastFilePath, incrementVaultVersion, selectEntry],
  );
}
