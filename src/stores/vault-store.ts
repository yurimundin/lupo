// =============================================================================
// ATENCAO - REGRA INEGOCIAVEL
// =============================================================================
// NUNCA usar middleware persist neste store. A instancia Kdbx carrega
// Credentials e ProtectedValues derivadas da senha-mestra, e NAO PODEM ser
// serializadas para localStorage, IndexedDB, sessionStorage ou arquivo.
// Cripto-state vive APENAS em memoria durante a sessao ativa do app.
// =============================================================================

import { create } from "zustand";

import type { Kdbx } from "kdbxweb";

import {
  getNotes,
  getPassword,
  getTitle,
  getUrl,
  getUsername,
} from "@/lib/entry-helpers";
import { findEntryByUuidIdInDb } from "@/lib/vault-find";

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

export interface VaultState {
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

