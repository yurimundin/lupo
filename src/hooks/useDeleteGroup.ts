import { useCallback } from "react";
import type { KdbxGroup } from "kdbxweb";
import { toast } from "sonner";

import { confirmDialog } from "@/lib/confirm";
import { moveGroupToRecycleBin } from "@/lib/kdbx";
import { useVaultStore } from "@/stores/vault";

/**
 * Conta o total de entradas (recursivo) num subtree.
 *
 * Walk em todos os grupos descendentes + acumula entries.
 * Inclui o próprio group root no walk (entries diretas + descendentes).
 *
 * Utility inline no hook — se essa contagem virar necessária em outros
 * lugares, vale extrair para `lib/kdbx-tree.ts` ou similar.
 */
function countEntriesInSubtree(group: KdbxGroup): number {
  let count = group.entries.length;
  for (const child of group.groups) {
    count += countEntriesInSubtree(child);
  }
  return count;
}

/**
 * Hook para mover um grupo para a Lixeira do cofre. Operação
 * DESTRUTIVA (recuperável via Lixeira do KDBX, mas remove o grupo
 * da árvore principal e move todos os descendentes junto).
 *
 * Padrão S19 Bloco 3 + S22 (rollback no helper, hook coordena UX):
 * - confirmDialog({ variant: "danger" }) ANTES da mutação
 * - Texto da confirmação inclui contagem de entradas afetadas
 * - selectGroup(parentUuid) após sucesso (sobe um nível)
 * - Toast feedback verde ou vermelho
 *
 * O caller (GroupContextMenu) é responsável por:
 * - Garantir que o grupo é elegível (não é root, não é Lixeira,
 *   não está dentro da Lixeira)
 * - Acionar via right-click → menu item "Mover para Lixeira"
 *
 * Hook é responsável por:
 * - Pedir confirmação com contexto (nome do grupo + contagem)
 * - Chamar moveGroupToRecycleBin
 * - Atualizar seleção (parent do grupo deletado)
 * - Toast feedback
 *
 * @returns Função `deleteGroup(group)` que retorna Promise<boolean>
 *   (true se moveu para Lixeira, false em qualquer falha ou cancel).
 */
export function useDeleteGroup(): (group: KdbxGroup) => Promise<boolean> {
  const kdbx = useVaultStore((s) => s.kdbx);
  const lastFilePath = useVaultStore((s) => s.lastFilePath);
  const incrementVaultVersion = useVaultStore((s) => s.incrementVaultVersion);
  const selectGroup = useVaultStore((s) => s.selectGroup);

  return useCallback(
    async (group: KdbxGroup): Promise<boolean> => {
      if (!kdbx || !lastFilePath) {
        toast.error("Cofre não está pronto.");
        return false;
      }

      // Snapshot do parent ANTES da mutação para atualizar seleção
      // após sucesso (decisão UX: subir um nível).
      const parentGroup = group.parentGroup;
      const parentUuidId = parentGroup?.uuid.id ?? null;

      // Contagem de entradas afetadas para mensagem informativa
      const entryCount = countEntriesInSubtree(group);
      const groupName = group.name ?? "(sem nome)";

      // Confirmação com contexto
      const confirmed = await confirmDialog({
        title: "Mover grupo para a Lixeira?",
        description:
          entryCount > 0
            ? `O grupo "${groupName}" e suas ${entryCount} entrada(s) serão movidos para a Lixeira. Você pode restaurar depois.`
            : `O grupo "${groupName}" será movido para a Lixeira. Você pode restaurar depois.`,
        confirmLabel: "Mover para Lixeira",
        cancelLabel: "Cancelar",
        variant: "danger",
      });

      if (!confirmed) {
        return false;
      }

      const result = await moveGroupToRecycleBin(lastFilePath, kdbx, group);

      if (!result.ok) {
        toast.error(`Falha ao mover grupo para a Lixeira: ${result.error}`);
        return false;
      }

      incrementVaultVersion();

      // Decisão UX cravada: seleção sobe para o parent do grupo deletado.
      // Caller (GroupContextMenu) garante que root nunca chega aqui,
      // então parentUuidId sempre tem valor — guard de segurança.
      // Se chegar null por algum motivo, mantém seleção atual (que
      // logo será reconciliada pela árvore re-renderizada).
      if (parentUuidId) {
        selectGroup(parentUuidId);
      }

      const suffix = entryCount > 0 ? ` (${entryCount} entrada(s))` : "";
      toast.success(
        `Grupo "${groupName}" movido para a Lixeira${suffix} (${result.durationMs}ms).`,
      );
      return true;
    },
    [kdbx, lastFilePath, incrementVaultVersion, selectGroup],
  );
}
