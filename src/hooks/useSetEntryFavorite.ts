import type { KdbxEntry } from "kdbxweb";
import { useCallback } from "react";
import { toast } from "sonner";

import { getTitle } from "@/lib/entry-helpers";
import { setEntryFavoriteInVault } from "@/lib/kdbx";
import { useVaultStore } from "@/stores/vault";

export function useSetEntryFavorite(): (
  entry: KdbxEntry,
  favorite: boolean,
) => Promise<boolean> {
  const kdbx = useVaultStore((s) => s.kdbx);
  const lastFilePath = useVaultStore((s) => s.lastFilePath);
  const incrementVaultVersion = useVaultStore((s) => s.incrementVaultVersion);

  return useCallback(
    async (entry: KdbxEntry, favorite: boolean): Promise<boolean> => {
      if (!kdbx || !lastFilePath) {
        toast.error("Cofre não está pronto.");
        return false;
      }

      const result = await setEntryFavoriteInVault(
        lastFilePath,
        kdbx,
        entry,
        favorite,
      );
      if (!result.ok) {
        toast.error(`Falha ao atualizar favorito: ${result.error}`);
        return false;
      }

      incrementVaultVersion();
      const title = getTitle(entry) || "(sem título)";
      toast.success(
        favorite
          ? `"${title}" adicionada aos favoritos`
          : `"${title}" removida dos favoritos`,
      );
      return true;
    },
    [kdbx, lastFilePath, incrementVaultVersion],
  );
}
