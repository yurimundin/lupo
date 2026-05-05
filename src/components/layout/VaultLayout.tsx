// Layout principal do cofre aberto: header em cima, banner opcional de
// key file abaixo, e três colunas (sidebar de grupos, lista de entradas,
// detalhe). Aqui também vivem os hooks que precisam estar ativos durante
// toda a sessão desbloqueada: auto-lock e atalhos globais.

import { useAutoLock } from "@/hooks/useAutoLock";
import { useGlobalShortcuts } from "@/hooks/useGlobalShortcuts";

import { EntryDetail } from "@/components/vault/EntryDetail";
import { EntryList } from "@/components/vault/EntryList";
import { GroupSidebar } from "@/components/vault/GroupSidebar";
import { KeyFileBanner } from "@/components/vault/KeyFileBanner";

import { VaultHeader } from "./VaultHeader";

export function VaultLayout() {
  useAutoLock();
  useGlobalShortcuts();

  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      <VaultHeader />
      <KeyFileBanner />
      <div className="flex-1 grid grid-cols-[200px_280px_1fr] overflow-hidden">
        <GroupSidebar />
        <EntryList />
        <EntryDetail />
      </div>
    </div>
  );
}
