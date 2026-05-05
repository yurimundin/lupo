// Switch top-level: decide qual tela mostrar com base no estado do
// `useVaultStore`. Sem persist do estado de cripto — fechar o app volta
// pra tela inicial. `lastFilePath` vive em RAM (Sessão 3, Tarefa 1).

import { Toaster } from "@/components/ui/sonner";
import { OpenCreateScreen } from "@/components/vault/OpenCreateScreen";
import { UnlockScreen } from "@/components/vault/UnlockScreen";
import { VaultLayout } from "@/components/layout/VaultLayout";
import { useVaultStore } from "@/stores/vault";

function App() {
  const kdbx = useVaultStore((s) => s.kdbx);
  const lastFilePath = useVaultStore((s) => s.lastFilePath);

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
    </>
  );
}

export default App;
