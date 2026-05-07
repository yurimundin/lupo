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
      {/* gridTemplateColumns inline porque Tailwind 4 não detecta esta classe arbitrária no scan estático.
          Ver CLAUDE.md §12 — Bug do scanner Tailwind 4 com arbitrary grid-cols.
          Sessão 20: dimensões 220/300 alinhadas com mockup hi-fi (antes 200/280). */}
      <div
        className="flex-1 grid overflow-hidden"
        style={{ gridTemplateColumns: "220px 300px 1fr" }}
      >
        <GroupSidebar />
        <EntryList />
        <EntryDetail />
      </div>
    </div>
  );
}
