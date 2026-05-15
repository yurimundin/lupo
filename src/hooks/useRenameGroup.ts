import { useCallback } from "react";
import type { KdbxGroup } from "kdbxweb";
import { toast } from "sonner";

import { renameGroupInVault } from "@/lib/kdbx";
import { useVaultStore } from "@/stores/vault";

/**
 * Hook para renomear um grupo no cofre. Segue padrão S19 Bloco 3
 * (rollback delegado ao helper) + convenções de useCreateGroup
 * (selectors atômicos, useCallback, toast feedback).
 *
 * Rename é operação benigna (sem destruição) — NÃO usa confirmDialog,
 * diferente de useDeleteGroup. Toast vermelho cobre feedback de erro.
 *
 * O caller (RenameGroupDialog) é responsável por:
 * - Validar o nome ANTES de chamar (não-vazio, max 64, sem duplicata
 *   entre siblings — mesmas validações de NewGroupDialog)
 * - Determinar o group target (geralmente selectedGroup do context menu)
 * - Fechar o dialog após sucesso
 *
 * Hook é responsável por:
 * - Chamar helper renameGroupInVault
 * - Toast verde (success) ou vermelho (erro)
 * - incrementVaultVersion (cache-buster §15)
 *
 * Seleção do grupo NÃO muda — mesmo uuid, só nome novo.
 *
 * @returns Função `renameGroup(group, newName)` que retorna Promise<boolean>
 *   (true se renomeou, false em qualquer erro).
 */
export function useRenameGroup(): (
  group: KdbxGroup,
  newName: string,
) => Promise<boolean> {
  const kdbx = useVaultStore((s) => s.kdbx);
  const lastFilePath = useVaultStore((s) => s.lastFilePath);
  const incrementVaultVersion = useVaultStore((s) => s.incrementVaultVersion);

  return useCallback(
    async (group, newName) => {
      if (!kdbx || !lastFilePath) {
        toast.error("Cofre não está aberto.");
        return false;
      }

      const result = await renameGroupInVault(lastFilePath, kdbx, group, newName);

      if (!result.ok) {
        toast.error(`Falha ao renomear grupo: ${result.error}`);
        return false;
      }

      incrementVaultVersion();
      toast.success(`Grupo renomeado para "${newName}" (${result.durationMs}ms).`);
      return true;
    },
    [kdbx, lastFilePath, incrementVaultVersion],
  );
}
