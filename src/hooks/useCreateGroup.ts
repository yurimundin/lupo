// Hook que cria um novo grupo no cofre. Padrão herdado de S19 Bloco 3
// (rollback in-memory delegado ao helper de `lib/kdbx.ts`) + convenções
// dos outros hooks de mutação (`useDeleteEntry`, `useCommitEdit`).
//
// Responsabilidades — CALLER (GroupSidebar / NewGroupDialog):
//   - Validar o `name` ANTES de chamar (não-vazio após trim, max chars,
//     duplicata entre siblings do mesmo parent). Hook assume input
//     válido — helper de baixo nível também assume.
//   - Resolver o `parent` (ex.: KdbxGroup do `selectedGroupUuid`, ou
//     root como fallback).
//   - Fechar o dialog em caso de sucesso.
//   - Auto-expand do parent na sidebar (estado em `useSettingsStore`,
//     não responsabilidade deste hook).
//
// Responsabilidades — HOOK:
//   - Validar estado (cofre aberto + lastFilePath).
//   - Delegar mutação + save + rollback ao `createGroupInVault`.
//   - Toast verde/vermelho conforme resultado.
//   - `incrementVaultVersion()` no sucesso (cache-buster §15 — selectors
//     `useGroupTree`, `useAllEntries` etc. reagem a isso).
//   - `selectGroup(newUuid)` no sucesso (feedback visual: o novo grupo
//     fica selecionado).

import type { KdbxGroup } from "kdbxweb";
import { useCallback } from "react";
import { toast } from "sonner";

import { createGroupInVault } from "@/lib/kdbx";
import { useVaultStore } from "@/stores/vault";

import { useVaultMutationContext } from "./useVaultMutationContext";

export function useCreateGroup(): (
  parent: KdbxGroup,
  name: string,
) => Promise<boolean> {
  const mutation = useVaultMutationContext();
  const selectGroup = useVaultStore((s) => s.selectGroup);

  return useCallback(
    async (parent: KdbxGroup, name: string): Promise<boolean> => {
      if (!mutation) {
        toast.error("Cofre não está pronto.");
        return false;
      }

      const result = await createGroupInVault(
        mutation.lastFilePath,
        mutation.kdbx,
        parent,
        name,
      );
      if (!result.ok) {
        toast.error(`Falha ao criar grupo: ${result.error}`);
        return false;
      }

      mutation.incrementVaultVersion();
      selectGroup(result.group.uuid.id);
      toast.success(`Grupo "${name}" criado (${result.durationMs}ms)`);
      return true;
    },
    [mutation, selectGroup],
  );
}
