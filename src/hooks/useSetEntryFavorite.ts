import type { KdbxEntry } from "kdbxweb";
import { useCallback } from "react";
import { toast } from "sonner";

import { getTitle } from "@/lib/entry-helpers";
import { setEntryFavoriteInVault } from "@/lib/kdbx";

import { useVaultMutationContext } from "./useVaultMutationContext";

export function useSetEntryFavorite(): (
  entry: KdbxEntry,
  favorite: boolean,
) => Promise<boolean> {
  const mutation = useVaultMutationContext();

  return useCallback(
    async (entry: KdbxEntry, favorite: boolean): Promise<boolean> => {
      if (!mutation) {
        toast.error("Cofre não está pronto.");
        return false;
      }

      const result = await setEntryFavoriteInVault(
        mutation.lastFilePath,
        mutation.kdbx,
        entry,
        favorite,
      );
      if (!result.ok) {
        toast.error(`Falha ao atualizar favorito: ${result.error}`);
        return false;
      }

      mutation.incrementVaultVersion();
      const title = getTitle(entry) || "(sem título)";
      toast.success(
        favorite
          ? `"${title}" adicionada aos favoritos`
          : `"${title}" removida dos favoritos`,
      );
      return true;
    },
    [mutation],
  );
}
