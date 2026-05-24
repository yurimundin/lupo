// =============================================================================
// ⚠️  ATENÇÃO — REGRA INEGOCIÁVEL  ⚠️
// =============================================================================
// NUNCA usar middleware `persist` (ou qualquer outro mecanismo de persistência)
// neste store. A instância `Kdbx` carrega Credentials e ProtectedValues
// derivadas da senha-mestra, e NÃO PODEM ser serializadas para localStorage,
// IndexedDB, sessionStorage ou arquivo. Cripto-state vive APENAS em memória
// durante a sessão ativa do app.
//
// O único campo "persistente entre bloqueios" é `lastFilePath`, que é só um
// caminho de arquivo (não-secreto) — e ainda assim só persiste em RAM (não
// vai pra disco). Quando o app é fechado, o caminho some e o usuário volta
// pra tela de abrir/criar.
//
// Drafts de edição (campos `draftEntry` / `originalDraft`) também são
// mantidos em memória e NUNCA persistidos. Senhas em draft vivem como
// `string` durante edição ativa (custo aceitável dado que estão sendo
// digitadas/exibidas na UI). No commit, são convertidas para
// `ProtectedValue` antes de entrar no Kdbx.
//
// Para preferências do usuário (tema, autoLockMs, etc.), use `settings.ts`
// que TEM persist habilitado.
// =============================================================================

import * as kdbxweb from "kdbxweb";
import { useMemo } from "react";
import { create } from "zustand";

import type { KdbxEntry, KdbxGroup, Kdbx } from "kdbxweb";

import {
  getNotes,
  getPassword,
  getTitle,
  getUrl,
  getUsername,
} from "@/lib/entry-helpers";
import {
  getGroupIconColorId,
  getGroupLucideIconId,
  type GroupIconColorId,
  type GroupLucideIconId,
} from "@/lib/group-icons";

/** Modo do painel direito (EntryDetail/EntryEditor). */
export type EditMode = "view" | "edit" | "create";

/**
 * Snapshot dos campos editáveis de uma entrada. Usado durante `edit` e
 * `create`. Senha em string clara (necessário pra `<input type=password>`);
 * conversão pra `ProtectedValue` acontece no commit, antes de entrar no
 * Kdbx.
 */
export interface EntryDraft {
  title: string;
  username: string;
  password: string;
  url: string;
  notes: string;
  /** UUID do grupo de origem (em edit) ou destino (em create). */
  groupUuid: string;
}

interface VaultState {
  /** Instância do cofre desbloqueado. `null` quando bloqueado ou nenhum cofre. */
  kdbx: Kdbx | null;
  /** Caminho do arquivo do cofre atual. `null` quando não há cofre ativo. */
  filePath: string | null;
  /**
   * Caminho do último cofre desbloqueado nesta sessão. Mantido após
   * `lock()` para a tela de desbloqueio simplificada não exigir que o
   * usuário selecione o arquivo de novo. Some em `reset()` ou ao fechar
   * o app.
   */
  lastFilePath: string | null;
  /**
   * Caminho do key file usado no último desbloqueio. Mantido após `lock()`
   * para o re-prompt na tela de desbloqueio simplificada. NÃO é o conteúdo
   * do key file — só o caminho.
   */
  lastKeyFilePath: string | null;
  /** UUID do grupo selecionado na sidebar. */
  selectedGroupUuid: string | null;
  /** UUID da entrada selecionada na lista. */
  selectedEntryUuid: string | null;

  /** Modo do painel direito. `view` é o padrão. */
  editMode: EditMode;
  /** Estado atual do form de edição/criação. `null` em modo `view`. */
  draftEntry: EntryDraft | null;
  /**
   * Snapshot do draft no momento em que entramos em edit/create. Usado
   * para detectar mudanças não-salvas (`useHasUnsavedChanges`). Não muda
   * com `updateDraft`.
   */
  originalDraft: EntryDraft | null;
  /**
   * Contador incrementado a cada mutação in-place do `kdbx` (entries
   * adicionadas/editadas/movidas, fields alterados, etc.). Selectors que
   * derivam arrays/objetos de dentro do kdbx dependem dele em `useMemo`
   * para invalidar quando o conteúdo muda — a referência do `kdbx`
   * sozinha não muda em mutações in-place.
   *
   * Quem mexe no kdbx via APIs da kdbxweb DEVE chamar
   * `incrementVaultVersion()` em seguida. Ver §15 do CLAUDE.md.
   */
  vaultVersion: number;
  /**
   * Query de busca em tempo real (Sessão 17). Vive no store porque o
   * input está no `VaultHeader` (global) e a lista filtrada está na
   * `EntryList` — siblings que precisam compartilhar estado. Resetado
   * ao trocar/bloquear/destravar o cofre (uma busca de um cofre não
   * sobrevive ao próximo).
   */
  searchQuery: string;

  setVault(kdbx: Kdbx, filePath: string, keyFilePath: string | null): void;
  lock(): void;
  unlock(kdbx: Kdbx): void;
  selectGroup(uuid: string): void;
  selectEntry(uuid: string | null): void;
  reset(): void;

  /** Entra em modo `edit` populando o draft com dados da entry indicada. */
  enterEditMode(entryUuid: string): void;
  /**
   * Entra em modo `create` com draft vazio, fixando o grupo destino
   * (default = grupo atualmente selecionado). NÃO muda `selectedEntryUuid`.
   */
  enterCreateMode(groupUuid?: string): void;
  /** Atualiza um campo do draft. */
  updateDraft(field: keyof EntryDraft, value: string): void;
  /**
   * Sai de edit/create sem aplicar mudanças. Limpa draft e snapshot.
   * Quem chama é responsável por confirmar com o usuário se houver
   * mudanças não-salvas.
   */
  cancelEdit(): void;
  /**
   * Sai do modo de edição mantendo o estado de view (após commit
   * bem-sucedido). NÃO mexe na seleção de entry — quem chama é o fluxo
   * de save (ver Tarefa 6, hook `useCommitEdit`).
   */
  exitToViewMode(): void;

  /**
   * Incrementa `vaultVersion`. Chamar SEMPRE após qualquer mutação
   * in-place do `kdbx` (criar/editar/mover/deletar entry ou grupo,
   * setar campo via `entry.fields.set`, etc.).
   */
  incrementVaultVersion(): void;

  /** Atualiza a query de busca global (driver da `EntryList` em modo
   * cross-group). Ver §17 e `searchQuery` acima. */
  setSearchQuery(query: string): void;

  /**
   * Hidrata `lastFilePath` (e opcionalmente `lastKeyFilePath`) sem
   * exigir uma instância de `Kdbx`. Usado APENAS no boot do app, a
   * partir do `lastOpenedVaultPath` persistido em `settings.ts`. O
   * resultado é que o switch do `App.tsx` cai em `<UnlockScreen />`
   * automaticamente quando há cofre lembrado, sem o usuário precisar
   * selecionar o arquivo de novo.
   *
   * NÃO usar em outros caminhos — `setVault` e `unlock` já tratam o
   * `lastFilePath` corretamente quando há um Kdbx ativo.
   */
  hydrateLastVault(filePath: string, keyFilePath: string | null): void;
}

export const useVaultStore = create<VaultState>((set, get) => ({
  kdbx: null,
  filePath: null,
  lastFilePath: null,
  lastKeyFilePath: null,
  selectedGroupUuid: null,
  selectedEntryUuid: null,
  editMode: "view",
  draftEntry: null,
  originalDraft: null,
  vaultVersion: 0,
  searchQuery: "",

  setVault: (kdbx, filePath, keyFilePath) =>
    set({
      kdbx,
      filePath,
      lastFilePath: filePath,
      lastKeyFilePath: keyFilePath,
      // Seleciona o grupo raiz por padrão pra UI ter algo pra mostrar.
      selectedGroupUuid: kdbx.getDefaultGroup().uuid.id,
      selectedEntryUuid: null,
      editMode: "view",
      draftEntry: null,
      originalDraft: null,
      searchQuery: "",
    }),

  lock: () =>
    set({
      kdbx: null,
      filePath: null,
      // Mantém lastFilePath e lastKeyFilePath para a tela de desbloqueio.
      selectedGroupUuid: null,
      selectedEntryUuid: null,
      editMode: "view",
      draftEntry: null,
      originalDraft: null,
      searchQuery: "",
    }),

  unlock: (kdbx) =>
    set((state) => ({
      kdbx,
      filePath: state.lastFilePath,
      selectedGroupUuid: kdbx.getDefaultGroup().uuid.id,
      selectedEntryUuid: null,
      editMode: "view",
      draftEntry: null,
      originalDraft: null,
      searchQuery: "",
    })),

  selectGroup: (uuid) =>
    set({
      selectedGroupUuid: uuid,
      selectedEntryUuid: null,
      editMode: "view",
      draftEntry: null,
      originalDraft: null,
    }),
  selectEntry: (uuid) => set({ selectedEntryUuid: uuid }),

  reset: () =>
    set({
      kdbx: null,
      filePath: null,
      lastFilePath: null,
      lastKeyFilePath: null,
      selectedGroupUuid: null,
      selectedEntryUuid: null,
      editMode: "view",
      draftEntry: null,
      originalDraft: null,
      searchQuery: "",
    }),

  enterEditMode: (entryUuid) => {
    const { kdbx } = get();
    if (!kdbx) return;
    const entry = findEntryByUuidIdInDb(kdbx, entryUuid);
    if (!entry) return;
    const groupUuid = entry.parentGroup?.uuid.id;
    if (!groupUuid) return;
    const draft: EntryDraft = {
      title: getTitle(entry),
      username: getUsername(entry),
      password: getPassword(entry),
      url: getUrl(entry),
      notes: getNotes(entry),
      groupUuid,
    };
    set({
      editMode: "edit",
      selectedEntryUuid: entryUuid,
      draftEntry: draft,
      originalDraft: { ...draft },
    });
  },

  enterCreateMode: (groupUuid) => {
    const target = groupUuid ?? get().selectedGroupUuid;
    if (!target) return;
    const draft: EntryDraft = {
      title: "",
      username: "",
      password: "",
      url: "",
      notes: "",
      groupUuid: target,
    };
    set({
      editMode: "create",
      // Em create não há entry selecionada (entry ainda não existe).
      selectedEntryUuid: null,
      draftEntry: draft,
      originalDraft: { ...draft },
    });
  },

  updateDraft: (field, value) =>
    set((state) =>
      state.draftEntry
        ? { draftEntry: { ...state.draftEntry, [field]: value } }
        : {},
    ),

  cancelEdit: () => {
    // Higiene de memória: zerar a string de senha do draft antes de
    // descartar. Strings em JS são imutáveis (a "zeragem" reatribui a
    // property pra `""` e libera a referência da senha original pro GC),
    // então NÃO é defesa contra memory dump do processo — é boa prática
    // que reduz a janela de tempo em que a senha fica em heap acessível
    // por outras referências. A defesa real continua sendo o
    // `ProtectedValue` da kdbxweb depois do commit.
    const state = get();
    if (state.draftEntry) state.draftEntry.password = "";
    if (state.originalDraft) state.originalDraft.password = "";
    set({
      editMode: "view",
      draftEntry: null,
      originalDraft: null,
    });
  },

  exitToViewMode: () => {
    // Mesma higiene de memória do `cancelEdit`. Ver comentário acima.
    const state = get();
    if (state.draftEntry) state.draftEntry.password = "";
    if (state.originalDraft) state.originalDraft.password = "";
    set({
      editMode: "view",
      draftEntry: null,
      originalDraft: null,
    });
  },

  incrementVaultVersion: () =>
    set((state) => ({ vaultVersion: state.vaultVersion + 1 })),

  setSearchQuery: (query) => set({ searchQuery: query }),

  hydrateLastVault: (filePath, keyFilePath) =>
    set({
      lastFilePath: filePath,
      lastKeyFilePath: keyFilePath,
    }),
}));

// ---------------------------------------------------------------------------
// Hooks selectors
// ---------------------------------------------------------------------------
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

/**
 * Walk recursivo sobre `group.groups`, coletando entries para busca.
 * Pula a Lixeira inteira (e qualquer subgrupo dela) — quando o grupo
 * atual é a Lixeira, retorna sem descer.
 */
export function collectEntriesForSearch(
  root: KdbxGroup,
  recycleBinUuidId: string | null,
): KdbxEntry[] {
  const acc: KdbxEntry[] = [];
  collectEntriesRecursive(root, acc, recycleBinUuidId);
  return acc;
}

function collectEntriesRecursive(
  group: KdbxGroup,
  acc: KdbxEntry[],
  recycleBinUuidId: string | null,
): void {
  if (recycleBinUuidId !== null && group.uuid.id === recycleBinUuidId) {
    return;
  }
  for (const entry of group.entries) {
    acc.push(entry);
  }
  for (const child of group.groups) {
    collectEntriesRecursive(child, acc, recycleBinUuidId);
  }
}

/**
 * Hook que retorna a lista de grupos diretos do cofre (filhos do grupo
 * raiz). Não inclui sub-sub-grupos por enquanto — render flat conforme
 * Tarefa 5 da Sessão 3.
 *
 * Mesmo padrão do `useEntriesOfCurrentGroup`: lógica em `useMemo` fora do
 * selector para não criar array novo a cada chamada.
 *
 * MANTIDO POR COMPATIBILIDADE — desde a Sessão 11 a sidebar usa
 * `useGroupTree` (recursivo). Se outro consumidor não aparecer, esta
 * função pode ser removida no futuro.
 */
export function useTopLevelGroups(): KdbxGroup[] {
  const kdbx = useVaultStore((s) => s.kdbx);
  const vaultVersion = useVaultStore((s) => s.vaultVersion);
  return useMemo(() => {
    if (!kdbx) return [];
    const root = kdbx.getDefaultGroup();
    // Inclui o próprio root como primeiro item — corresponde ao "Cofre" raiz
    // que o usuário verá. Subgrupos vêm em seguida.
    return [root, ...root.groups];
    // vaultVersion é cache-buster intencional (§15): incrementa a cada
    // mutação in-place do kdbx; força re-execução sem ser referenciado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kdbx, vaultVersion]);
}

/**
 * Nó da árvore de grupos do cofre, pré-computado para a sidebar
 * recursiva (Sessão 11).
 *
 * - `name` já passa por `getGroupDisplayName` (Lixeira i18n).
 * - `entryCount` é a contagem direta de entries do próprio grupo,
 *   sem somar entries de subgrupos (consistência com a contagem
 *   exibida hoje no badge à direita).
 * - `parentUuid === null` apenas no nó raiz.
 */
export interface GroupTreeNode {
  uuid: string;
  name: string;
  iconId: GroupLucideIconId | null;
  iconColorId: GroupIconColorId | null;
  depth: number;
  children: GroupTreeNode[];
  parentUuid: string | null;
  isRecycleBin: boolean;
  entryCount: number;
}

export function buildGroupTreeNode(
  group: KdbxGroup,
  depth: number,
  parentUuid: string | null,
  recycleBinUuidId: string | null,
): GroupTreeNode {
  const uuidId = group.uuid.id;
  return {
    uuid: uuidId,
    name: getGroupDisplayName(group, recycleBinUuidId),
    iconId: getGroupLucideIconId(group),
    iconColorId: getGroupIconColorId(group),
    depth,
    children: sortGroupsForDisplay(group.groups, recycleBinUuidId).map((child) =>
      buildGroupTreeNode(child, depth + 1, uuidId, recycleBinUuidId),
    ),
    parentUuid,
    isRecycleBin: recycleBinUuidId !== null && uuidId === recycleBinUuidId,
    entryCount: group.entries.length,
  };
}

function sortGroupsForDisplay(
  groups: KdbxGroup[],
  recycleBinUuidId: string | null,
): KdbxGroup[] {
  return [...groups].sort((a, b) => {
    const aIsRecycleBin = recycleBinUuidId !== null && a.uuid.id === recycleBinUuidId;
    const bIsRecycleBin = recycleBinUuidId !== null && b.uuid.id === recycleBinUuidId;

    if (aIsRecycleBin && !bIsRecycleBin) return 1;
    if (!aIsRecycleBin && bIsRecycleBin) return -1;

    return getGroupDisplayName(a, recycleBinUuidId).localeCompare(
      getGroupDisplayName(b, recycleBinUuidId),
      "pt-BR",
      { sensitivity: "base" },
    );
  });
}

/**
 * Hook recursivo que retorna a árvore inteira de grupos do cofre.
 * Sempre retorna um array de length 1 (o nó raiz) — o renderer da
 * sidebar trata o nó raiz como `forceExpanded` (sem chevron).
 *
 * Memoizado por `[kdbx, vaultVersion, recycleBinUuidId]`. Re-invalida
 * sempre que houver mutação in-place do `kdbx` (`vaultVersion`) ou
 * que a Lixeira for criada/destruída (mudando `recycleBinUuidId`).
 *
 * NUNCA retornar derivação inline dentro do selector do Zustand — a
 * referência mudaria a cada chamada e o `useSyncExternalStore` entraria
 * em loop. Ver §15 do CLAUDE.md.
 */
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

export function buildGroupTree(
  root: KdbxGroup,
  recycleBinUuidId: string | null,
): GroupTreeNode[] {
  return [buildGroupTreeNode(root, 0, null, recycleBinUuidId)];
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
 * Retorna o nome de exibição de um grupo, traduzindo "Recycle Bin" para
 * "Lixeira" quando o grupo é a Lixeira do cofre.
 *
 * IMPORTANTE: NÃO altera o `group.name` interno do XML. O grupo continua
 * com nome canônico ("Recycle Bin") no arquivo `.kdbx` para
 * compatibilidade com KeePassXC e demais clientes KeePass do ecossistema
 * (que tratam "Recycle Bin" como o nome convencional internacionalizado
 * pelo próprio cliente). A tradução é estritamente de renderização.
 *
 * Função pura — combinar com `useRecycleBinUuidId()` no componente
 * chamador. Não tem hook próprio porque a derivação é trivial.
 */
export function getGroupDisplayName(
  group: KdbxGroup,
  recycleBinUuidId: string | null,
): string {
  if (recycleBinUuidId && group.uuid.id === recycleBinUuidId) {
    return "Lixeira";
  }
  return group.name || "(sem nome)";
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
    return isInGroupSubtree(entry, recycleBinUuid.id);
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
    if (s.selectedGroupUuid === recycleBinUuid.id) return true;
    // Sobe a árvore do grupo selecionado verificando se passa pela lixeira.
    let current = findGroupByUuidId(
      s.kdbx.getDefaultGroup(),
      s.selectedGroupUuid,
    )?.parentGroup;
    while (current) {
      if (current.uuid.id === recycleBinUuid.id) return true;
      current = current.parentGroup;
    }
    return false;
  });
}

function isInGroupSubtree(entry: KdbxEntry, groupUuidId: string): boolean {
  let current: KdbxGroup | undefined = entry.parentGroup;
  while (current) {
    if (current.uuid.id === groupUuidId) return true;
    current = current.parentGroup;
  }
  return false;
}

/**
 * Busca a entrada por UUID em qualquer nível da árvore. Útil em handlers
 * de eventos globais (ex.: Ctrl+C copia senha da entry selecionada).
 * Retorna `null` se não encontrar.
 */
export function findEntryByUuidIdInDb(
  db: Kdbx,
  entryUuidId: string,
): KdbxEntry | null {
  return findEntryRecursive(db.getDefaultGroup(), entryUuidId);
}

function findEntryRecursive(
  group: KdbxGroup,
  entryUuidId: string,
): KdbxEntry | null {
  const direct = group.entries.find((e) => e.uuid.id === entryUuidId);
  if (direct) return direct;
  for (const sub of group.groups) {
    const hit = findEntryRecursive(sub, entryUuidId);
    if (hit) return hit;
  }
  return null;
}

/** Busca um grupo por UUID em qualquer nível da árvore. */
export function findGroupByUuidIdInDb(
  db: Kdbx,
  groupUuidId: string,
): KdbxGroup | null {
  return findGroupByUuidId(db.getDefaultGroup(), groupUuidId);
}

// ---------------------------------------------------------------------------
// Helpers internos de busca por UUID
// ---------------------------------------------------------------------------

function findGroupByUuidId(root: KdbxGroup, uuidId: string): KdbxGroup | null {
  if (root.uuid.id === uuidId) return root;
  for (const sub of root.groups) {
    const hit = findGroupByUuidId(sub, uuidId);
    if (hit) return hit;
  }
  return null;
}

function findGroupContainingEntry(
  root: KdbxGroup,
  entryUuidId: string | null,
): KdbxGroup | null {
  if (!entryUuidId) return null;
  if (root.entries.some((e) => e.uuid.id === entryUuidId)) return root;
  for (const sub of root.groups) {
    const hit = findGroupContainingEntry(sub, entryUuidId);
    if (hit) return hit;
  }
  return null;
}

// Mantém a referência ao módulo kdbxweb na bundle para tipos (alguns
// pacotes só funcionam se o import principal estiver presente).
void kdbxweb;
