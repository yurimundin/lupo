// Atalhos de teclado globais do cofre aberto.
//
// Tabela canônica (ver §11 do CLAUDE.md):
//   Ctrl+L                            → bloquear cofre
//   Ctrl+F                            → focar input de busca (id="vault-search-input")
//   Ctrl+C  (entry selecionada)       → copiar senha com auto-clear
//   ↑/↓     (na sidebar/lista)         → navegar (tratado nos próprios componentes)
//   Esc                               → desfocar elemento focado
//
// Este hook NÃO trata setas — esse roteamento fica nos componentes que
// têm o foco (sidebar, lista) pra ser independente do estado global.

import { useEffect } from "react";

import { copyToClipboardWithAutoClear } from "@/lib/clipboard";
import { getPassword } from "@/lib/entry-helpers";
import { requestLockWithGuard } from "@/lib/lock-flow";
import { findEntryByUuidIdInDb, useVaultStore } from "@/stores/vault";

interface GlobalShortcutsOptions {
  onOpenCommandPalette?: () => void;
}

export function useGlobalShortcuts(
  options: GlobalShortcutsOptions = {},
): void {
  const { onOpenCommandPalette } = options;

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      // Esc: desfoca elemento atual. Em modo edit/create, o EntryEditor
      // tem seu próprio handler de Esc com confirmação (cancelar com
      // dialog se dirty). Esse handler aqui é o "fallback" pra view mode.
      if (e.key === "Escape") {
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        return;
      }

      const ctrl = e.ctrlKey || e.metaKey;
      if (!ctrl) return;

      const key = e.key.toLowerCase();

      if (key === "k") {
        e.preventDefault();
        onOpenCommandPalette?.();
        return;
      }

      if (key === "l") {
        e.preventDefault();
        // Lock com guarda de "mudanças não salvas" (`requestLockWithGuard`
        // confirma com o usuário se houver draft pendente).
        void requestLockWithGuard();
        return;
      }

      if (key === "f") {
        e.preventDefault();
        const input = document.getElementById("vault-search-input");
        if (input instanceof HTMLInputElement) {
          input.focus();
          input.select();
        }
        return;
      }

      if (key === "c") {
        // Não interferir se o usuário está copiando texto selecionado.
        const selection = window.getSelection?.()?.toString();
        if (selection && selection.length > 0) return;

        // Não interferir se o foco está num input/textarea (Ctrl+C nativo).
        const tag = document.activeElement?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;

        const state = useVaultStore.getState();
        if (!state.kdbx || !state.selectedEntryUuid) return;
        const entry = findEntryByUuidIdInDb(
          state.kdbx,
          state.selectedEntryUuid,
        );
        if (!entry) return;

        const pw = getPassword(entry);
        if (!pw) return;

        e.preventDefault();
        void copyToClipboardWithAutoClear(pw, "Senha copiada");
      }
    }

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onOpenCommandPalette]);
}
