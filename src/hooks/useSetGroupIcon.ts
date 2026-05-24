import { useCallback } from "react";
import type { KdbxGroup } from "kdbxweb";
import { toast } from "sonner";

import type { GroupLucideIconId } from "@/lib/group-icons";
import { setGroupVisualIconInVault } from "@/lib/kdbx";
import { useVaultStore } from "@/stores/vault";

export function useSetGroupIcon(): (
  group: KdbxGroup,
  iconId: GroupLucideIconId | null,
) => Promise<boolean> {
  const kdbx = useVaultStore((s) => s.kdbx);
  const lastFilePath = useVaultStore((s) => s.lastFilePath);
  const incrementVaultVersion = useVaultStore((s) => s.incrementVaultVersion);

  return useCallback(
    async (group, iconId) => {
      if (!kdbx || !lastFilePath) {
        toast.error("Cofre nao esta aberto.");
        return false;
      }

      const result = await setGroupVisualIconInVault(
        lastFilePath,
        kdbx,
        group,
        iconId,
      );

      if (!result.ok) {
        toast.error(`Falha ao alterar icone: ${result.error}`);
        return false;
      }

      incrementVaultVersion();
      toast.success(`Icone de "${group.name}" atualizado (${result.durationMs}ms).`);
      return true;
    },
    [kdbx, lastFilePath, incrementVaultVersion],
  );
}
