// Hook que restaura um grupo da Lixeira (RecycleBin) para o grupo raiz.
//
// Diferenças em relação ao `useDeleteGroup`:
//   - Sem `confirmDialog`: restaurar é ação benigna (reverte uma deleção),
//     confirmação seria fricção desnecessária. Padrão alinhado com
//     useRestoreEntry e KeePassXC.
//   - Toast de sucesso menciona o destino ("grupo raiz") porque o usuário
//     pode estranhar não ter caminho de "voltar para o grupo de origem"
//     (limitação do KDBX: o grupo de origem não é preservado no soft-delete).
//   - `selectGroup(group.uuid.id)` navega para o grupo restaurado
//     (UX: usuário vê imediatamente onde foi parar, pode reorganizar).
//
// Fluxo:
//   1. Validações (cofre aberto, lastFilePath presente).
//   2. `restoreGroupFromRecycleBin(filePath, kdbx, group)`:
//      - Valida grupo é filho direto da Lixeira
//      - kdbx.move(group, root) — mutação in-place (cascade: subgrupos seguem)
//      - saveVault — backup atômico + magic check + rename
//      - Rollback automático se save falhar
//   3. Em sucesso: `incrementVaultVersion`, `selectGroup(uuid)`, toast verde.
//   4. Em erro: toast vermelho, NÃO incrementa vaultVersion.

import type { KdbxGroup } from "kdbxweb";
import { useCallback } from "react";
import { toast } from "sonner";

import { restoreGroupFromRecycleBin } from "@/lib/kdbx";
import { useVaultStore } from "@/stores/vault";

export function useRestoreGroup(): (group: KdbxGroup) => Promise<boolean> {
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

      const groupName = group.name ?? "(sem nome)";

      const result = await restoreGroupFromRecycleBin(
        lastFilePath,
        kdbx,
        group,
      );
      if (!result.ok) {
        toast.error(`Falha ao restaurar grupo: ${result.error}`);
        return false;
      }

      incrementVaultVersion();
      // Navega para o grupo restaurado (agora no raiz).
      selectGroup(group.uuid.id);
      toast.success(
        `Grupo "${groupName}" restaurado para o grupo raiz (${result.durationMs}ms).`,
      );
      return true;
    },
    [kdbx, lastFilePath, incrementVaultVersion, selectGroup],
  );
}
