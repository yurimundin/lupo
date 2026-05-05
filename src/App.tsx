// Switch top-level: decide qual tela mostrar com base no estado do
// `useVaultStore`. Sem persist do estado de cripto — fechar o app volta
// pra tela inicial. `lastFilePath` vive em RAM (Sessão 3, Tarefa 1).
//
// Sessão 8: hidratação no boot a partir de `lastOpenedVaultPath`
// (persistido em settings via Zustand persist). Se o último cofre
// existe no disco, popula `lastFilePath` no vault store → o switch
// abaixo cai em <UnlockScreen /> automaticamente. Se sumiu, limpa o
// caminho persistido em silêncio (cair em OpenCreateScreen sem ruído).

import { useEffect } from "react";

import { ConfirmDialogHost } from "@/components/ConfirmDialogHost";
import { Toaster } from "@/components/ui/sonner";
import { OpenCreateScreen } from "@/components/vault/OpenCreateScreen";
import { UnlockScreen } from "@/components/vault/UnlockScreen";
import { VaultLayout } from "@/components/layout/VaultLayout";
import { useCloseRequestGuard } from "@/hooks/useCloseRequestGuard";
import { fileExists } from "@/lib/fs";
import { useSettingsStore } from "@/stores/settings";
import { useVaultStore } from "@/stores/vault";

function App() {
  const kdbx = useVaultStore((s) => s.kdbx);
  const lastFilePath = useVaultStore((s) => s.lastFilePath);

  // Intercepta o "fechar janela" do Tauri pra confirmar quando há draft
  // não-salvo. Hook seguro pra rodar em qualquer estado (no-op se não
  // houver dirty).
  useCloseRequestGuard();

  // Auto-load do último cofre no boot. Roda UMA vez no mount; se o vault
  // store já tem `lastFilePath` (via auto-lock dentro da sessão), não
  // precisa hidratar de novo. Verifica fileExists antes de popular pra
  // evitar UnlockScreen apontando pra arquivo fantasma.
  useEffect(() => {
    if (useVaultStore.getState().lastFilePath !== null) return;
    const persistedPath =
      useSettingsStore.getState().lastOpenedVaultPath;
    if (!persistedPath) return;

    void (async () => {
      const exists = await fileExists(persistedPath);
      if (exists) {
        const rememberedKeyFile = useSettingsStore
          .getState()
          .getRememberedKeyFile(persistedPath);
        useVaultStore
          .getState()
          .hydrateLastVault(persistedPath, rememberedKeyFile);
      } else {
        // Arquivo sumiu (cofre movido/renomeado/excluído fora do app).
        // Limpa em silêncio — o usuário cai em OpenCreateScreen e seleciona
        // o novo caminho manualmente.
        useSettingsStore.getState().setLastOpenedVaultPath(null);
      }
    })();
  }, []);

  let screen: React.ReactNode;
  if (kdbx) {
    screen = <VaultLayout />;
  } else if (lastFilePath) {
    screen = <UnlockScreen />;
  } else {
    screen = <OpenCreateScreen />;
  }

  return (
    <>
      {screen}
      <Toaster position="bottom-right" />
      <ConfirmDialogHost />
    </>
  );
}

export default App;
