import { useMemo } from "react";

import type { KdbxEntry, KdbxGroup } from "kdbxweb";

import { collectEntriesForSearch } from "@/lib/vault-search";
import {
  buildGroupTree,
  isGroupInRecycleBinSubtree,
  type GroupTreeNode,
} from "@/lib/vault-tree";
import {
  findGroupByUuidId,
  findGroupContainingEntry,
} from "@/lib/vault-find";

import { useVaultStore, type EntryDraft } from "./vault-store";

//
// Em Zustand os getters precisam ser hooks separados pra disparar re-render
// quando o state mudar. Os métodos `getCurrentGroup`/`getCurrentEntry` no
// próprio store seriam apenas snapshots — usaríamos só em event handlers,
// não em rendering. Centralizamos como hooks aqui.

/**
 * Estado de bloqueio derivado: `true` quando há um `lastFilePath` mas
 * nenhum `kdbx` ativo (i.e., usuário bloqueou ou auto-lock disparou e o
 * cofre lembrado pode ser reaberto).
 */
export function useIsLocked(): boolean {
  return useVaultStore((s) => s.kdbx === null && s.lastFilePath !== null);
}

/** Query de busca cross-group (Sessão 17). Driver da `EntryList`. */
export function useSearchQuery(): string {
  return useVaultStore((s) => s.searchQuery);
}

export function useCurrentGroup(): KdbxGroup | null {
  return useVaultStore((s) => {
    if (!s.kdbx || !s.selectedGroupUuid) return null;
    return findGroupByUuidId(s.kdbx.getDefaultGroup(), s.selectedGroupUuid);
  });
}

export function useCurrentEntry(): KdbxEntry | null {
  return useVaultStore((s) => {
    const group = s.kdbx
      ? findGroupContainingEntry(s.kdbx.getDefaultGroup(), s.selectedEntryUuid)
      : null;
    if (!group || !s.selectedEntryUuid) return null;
    return group.entries.find((e) => e.uuid.id === s.selectedEntryUuid) ?? null;
  });
}

/**
 * Lista de entradas do grupo selecionado.
 *
 * Implementação: o selector do Zustand retorna apenas referências/primitivos
 * estáveis (`kdbx`, `selectedGroupUuid`, `vaultVersion`). O array em si é
 * derivado em `useMemo`. Antes era inline no selector e criava array novo
 * a cada chamada, causando loop infinito do `useSyncExternalStore`. Ver
 * §15 do CLAUDE.md.
 */
export function useEntriesOfCurrentGroup(): KdbxEntry[] {
  const kdbx = useVaultStore((s) => s.kdbx);
  const selectedGroupUuid = useVaultStore((s) => s.selectedGroupUuid);
  const vaultVersion = useVaultStore((s) => s.vaultVersion);
  return useMemo(() => {
    if (!kdbx || !selectedGroupUuid) return [];
    const group = findGroupByUuidId(kdbx.getDefaultGroup(), selectedGroupUuid);
    return group?.entries ?? [];
    // vaultVersion é cache-buster intencional (§15): incrementa a cada
    // mutação in-place do kdbx; força re-execução sem ser referenciado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kdbx, selectedGroupUuid, vaultVersion]);
}

/**
 * Retorna TODAS as entries do cofre, EXCLUINDO as que estão na Lixeira
 * (incluindo subgrupos da Lixeira). Usado pela busca cross-group da
 * `EntryList` (Sessão 17).
 *
 * Memoização: re-computa quando `kdbx`, `vaultVersion` ou
 * `recycleBinUuidId` mudam. `recycleBinUuidId` muda quando a Lixeira é
 * criada/destruída — necessário para a exclusão da Lixeira ser correta
 * em runtime.
 *
 * Mesmo padrão de `useEntriesOfCurrentGroup`: lógica em `useMemo` fora
 * do selector para não criar array novo a cada chamada (ver §15).
 */
export function useAllEntries(): KdbxEntry[] {
  const kdbx = useVaultStore((s) => s.kdbx);
  const vaultVersion = useVaultStore((s) => s.vaultVersion);
  const recycleBinUuidId = useRecycleBinUuidId();
  return useMemo(() => {
    if (!kdbx) return [];
    return collectEntriesForSearch(kdbx.getDefaultGroup(), recycleBinUuidId);
    // vaultVersion é cache-buster intencional (§15): incrementa a cada
    // mutação in-place do kdbx; força re-execução sem ser referenciado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kdbx, vaultVersion, recycleBinUuidId]);
}

export function useGroupTree(): GroupTreeNode[] {
  const kdbx = useVaultStore((s) => s.kdbx);
  const vaultVersion = useVaultStore((s) => s.vaultVersion);
  const recycleBinUuidId = useRecycleBinUuidId();
  return useMemo(() => {
    if (!kdbx) return [];
    return buildGroupTree(kdbx.getDefaultGroup(), recycleBinUuidId);
    // vaultVersion é cache-buster intencional (§15): incrementa a cada
    // mutação in-place do kdbx; força re-execução sem ser referenciado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kdbx, vaultVersion, recycleBinUuidId]);
}

/**
 * `true` quando há mudanças no draft em relação ao snapshot. Comparação
 * shallow campo-a-campo (suficiente, todos os campos são `string`).
 *
 * Em modo `create` praticamente sempre retorna `true` assim que o usuário
 * digitar qualquer coisa (snapshot original tem todos campos vazios).
 */
export function useHasUnsavedChanges(): boolean {
  return useVaultStore((s) => {
    if (!s.draftEntry || !s.originalDraft) return false;
    return !draftsEqual(s.draftEntry, s.originalDraft);
  });
}

function draftsEqual(a: EntryDraft, b: EntryDraft): boolean {
  return (
    a.title === b.title &&
    a.username === b.username &&
    a.password === b.password &&
    a.url === b.url &&
    a.notes === b.notes &&
    a.groupUuid === b.groupUuid
  );
}

/**
 * Versão síncrona / não-hook de `useHasUnsavedChanges`. Útil em handlers
 * fora de componentes React (close-request listener do Tauri,
 * confirmação programática de lock, etc.).
 */
export function getHasUnsavedChanges(): boolean {
  const s = useVaultStore.getState();
  if (!s.draftEntry || !s.originalDraft) return false;
  return !draftsEqual(s.draftEntry, s.originalDraft);
}

/**
 * UUID-id (string) do grupo Lixeira, ou `null` se o cofre ainda não tem
 * Lixeira configurada. Usado pela sidebar pra diferenciar visualmente o
 * grupo Lixeira dos demais (ícone Trash2 em vez de Folder). Depende de
 * `vaultVersion` porque `meta.recycleBinUuid` é setado por
 * `createRecycleBin` em mutações in-place.
 */
export function useRecycleBinUuidId(): string | null {
  const kdbx = useVaultStore((s) => s.kdbx);
  const vaultVersion = useVaultStore((s) => s.vaultVersion);
  return useMemo(() => {
    if (!kdbx) return null;
    const uuid = kdbx.meta.recycleBinUuid;
    if (!uuid || uuid.empty) return null;
    return uuid.id;
    // vaultVersion é cache-buster intencional (§15): incrementa a cada
    // mutação in-place do kdbx; força re-execução sem ser referenciado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kdbx, vaultVersion]);
}

/**
 * `true` se a entry indicada está dentro do grupo Lixeira do cofre. Usado
 * para desabilitar editar/deletar (Sessão 4 deixa Lixeira read-only;
 * gerenciar fica para Sessão 5).
 */
export function useIsEntryInRecycleBin(entry: KdbxEntry | null): boolean {
  return useVaultStore((s) => {
    if (!entry || !s.kdbx) return false;
    const recycleBinUuid = s.kdbx.meta.recycleBinUuid;
    if (!recycleBinUuid || recycleBinUuid.empty) return false;
    return isGroupInRecycleBinSubtree(entry.parentGroup, recycleBinUuid.id);
  });
}

/**
 * `true` se o grupo atualmente selecionado é a Lixeira (ou sub-grupo
 * dela). Usado para desabilitar criação de novas entradas dentro da
 * lixeira.
 */
export function useIsCurrentGroupRecycleBin(): boolean {
  return useVaultStore((s) => {
    if (!s.kdbx || !s.selectedGroupUuid) return false;
    const recycleBinUuid = s.kdbx.meta.recycleBinUuid;
    if (!recycleBinUuid || recycleBinUuid.empty) return false;
    const group = findGroupByUuidId(
      s.kdbx.getDefaultGroup(),
      s.selectedGroupUuid,
    );
    return isGroupInRecycleBinSubtree(group, recycleBinUuid.id);
  });
}
