// Store Zustand de preferências do usuário (com `persist`).
//
// O que vai aqui: configurações declaradas pelo usuário que devem
// sobreviver entre execuções do app — tempos de auto-lock, auto-clear de
// clipboard, e flags de UX como banners já vistos.
//
// O que NÃO vai aqui: nada relacionado ao cofre desbloqueado (Kdbx,
// senhas, ProtectedValue). Para isso, ver `vault.ts` (sem persist).
//
// Sobre o tema: a Sessão 2 implementou o tema em `src/lib/theme.ts` com
// localStorage próprio (chave `sec-basis-theme`). Não migramos pra cá
// nesta sessão pra evitar refactor não pedido. Uma sessão futura pode
// unificar; por hoje, theme.ts é a fonte de verdade do tema.

import { create } from "zustand";
import { persist } from "zustand/middleware";

/** Auto-lock: 5 minutos de inatividade. Configurável pelo usuário. */
export const DEFAULT_AUTO_LOCK_MS = 5 * 60 * 1000;
/** Auto-clear de clipboard: 20 segundos. Configurável pelo usuário. */
export const DEFAULT_CLIPBOARD_AUTO_CLEAR_MS = 20 * 1000;

interface SettingsState {
  autoLockMs: number;
  clipboardAutoClearMs: number;
  /**
   * Mapa `<filePath do cofre>` → `true` quando o usuário fechou o banner
   * informativo de key file daquele cofre. Persistido para não reaparecer
   * a cada abertura.
   */
  seenKeyFileBanner: Record<string, boolean>;
  /**
   * Mapa `<filePath do cofre>` → `<filePath do key file>`. Permite
   * pré-preencher a tela de abrir cofre quando o usuário voltar a um
   * cofre que usa key file.
   *
   * Tratado como **metadata operacional, não segredo** — armazenado em
   * texto puro no localStorage (via persist do Zustand). Ver §6 do
   * CLAUDE.md "Path do key file por cofre" para a justificativa
   * completa: KeePass/KeePassXC tratam da mesma forma; criptografar via
   * DPAPI seria security theater (mesmo limite de segurança que o ACL
   * NTFS já oferece pra leitura do APPDATA do usuário).
   */
  keyFilePathByVault: Record<string, string>;
  /**
   * Caminho do último cofre que o usuário abriu com sucesso. Persistido
   * entre sessões via Zustand persist → localStorage. Permite o app pré-
   * preencher a tela de unlock no boot, sem o usuário ter que selecionar
   * o arquivo de novo a cada vez. Mesma natureza de "metadata operacional"
   * de `keyFilePathByVault` (ver §6 CLAUDE.md): caminho de arquivo não é
   * segredo, ACL do APPDATA é o limite de segurança real.
   *
   * Limpo silenciosamente quando o boot detecta que o arquivo sumiu do
   * disco (cair em OpenCreateScreen sem ruído).
   */
  lastOpenedVaultPath: string | null;
  /**
   * Mapa `<filePath do cofre>` → array de UUIDs de grupos atualmente
   * expandidos na sidebar daquele cofre. Persistido entre sessões para
   * manter o layout escolhido pelo usuário (igual ao KeePassXC, VS Code
   * Explorer, etc.).
   *
   * Mesma natureza de "metadata operacional" dos demais campos por
   * vault path — ver §6 do CLAUDE.md.
   *
   * Estado inicial: vazio. O nó raiz da árvore renderiza com
   * `forceExpanded` no componente, então a UX inicial sempre mostra os
   * subgrupos do primeiro nível mesmo sem registro persistido.
   */
  expandedGroupsByVault: Record<string, string[]>;

  setAutoLockMs(ms: number): void;
  setClipboardAutoClearMs(ms: number): void;
  markKeyFileBannerSeen(filePath: string): void;
  hasSeenKeyFileBanner(filePath: string): boolean;
  rememberKeyFile(vaultPath: string, keyFilePath: string): void;
  forgetKeyFile(vaultPath: string): void;
  getRememberedKeyFile(vaultPath: string): string | null;
  setLastOpenedVaultPath(path: string | null): void;
  toggleGroupExpanded(vaultPath: string, groupUuid: string): void;
  isGroupExpanded(vaultPath: string, groupUuid: string): boolean;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      autoLockMs: DEFAULT_AUTO_LOCK_MS,
      clipboardAutoClearMs: DEFAULT_CLIPBOARD_AUTO_CLEAR_MS,
      seenKeyFileBanner: {},
      keyFilePathByVault: {},
      lastOpenedVaultPath: null,
      expandedGroupsByVault: {},

      setAutoLockMs: (autoLockMs) => set({ autoLockMs }),
      setClipboardAutoClearMs: (clipboardAutoClearMs) =>
        set({ clipboardAutoClearMs }),
      markKeyFileBannerSeen: (filePath) =>
        set({
          seenKeyFileBanner: {
            ...get().seenKeyFileBanner,
            [filePath]: true,
          },
        }),
      hasSeenKeyFileBanner: (filePath) =>
        Boolean(get().seenKeyFileBanner[filePath]),
      rememberKeyFile: (vaultPath, keyFilePath) =>
        set({
          keyFilePathByVault: {
            ...get().keyFilePathByVault,
            [vaultPath]: keyFilePath,
          },
        }),
      forgetKeyFile: (vaultPath) =>
        set((state) => {
          const next = { ...state.keyFilePathByVault };
          delete next[vaultPath];
          return { keyFilePathByVault: next };
        }),
      getRememberedKeyFile: (vaultPath) =>
        get().keyFilePathByVault[vaultPath] ?? null,
      setLastOpenedVaultPath: (path) => set({ lastOpenedVaultPath: path }),
      toggleGroupExpanded: (vaultPath, groupUuid) =>
        set((state) => {
          const current = state.expandedGroupsByVault[vaultPath] ?? [];
          const next = current.includes(groupUuid)
            ? current.filter((id) => id !== groupUuid)
            : [...current, groupUuid];
          return {
            expandedGroupsByVault: {
              ...state.expandedGroupsByVault,
              [vaultPath]: next,
            },
          };
        }),
      isGroupExpanded: (vaultPath, groupUuid) => {
        const expanded = get().expandedGroupsByVault[vaultPath] ?? [];
        return expanded.includes(groupUuid);
      },
    }),
    { name: "sec-basis-settings" },
  ),
);
