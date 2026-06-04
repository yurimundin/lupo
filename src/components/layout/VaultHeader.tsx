// Header global do cofre. Inclui logo + filename, busca cross-group
// (Sessão 17), indicadores de save/auto-lock, toggle de tema (Sessão 20)
// e botões de configurações/sobre/bloquear.

import { Info, Lock as LockIcon, Settings, ShieldCheck } from "lucide-react";
import { useState } from "react";

import { AboutDialog } from "@/components/AboutDialog";
import { SecuritySettingsDialog } from "@/components/SecuritySettingsDialog";
import { Button } from "@/components/ui/button";
import { VaultAuditDialog } from "@/components/VaultAuditDialog";
import { SearchInput } from "@/components/vault/SearchInput";
import { requestLockWithGuard } from "@/services/lock-flow";
import {
  useHasUnsavedChanges,
  useSearchQuery,
  useVaultStore,
} from "@/stores/vault";

import { AutoLockIndicator } from "./AutoLockIndicator";
import { ThemeToggle } from "./ThemeToggle";

export function VaultHeader() {
  const filePath = useVaultStore((s) => s.filePath);
  const hasUnsavedChanges = useHasUnsavedChanges();
  const searchQuery = useSearchQuery();
  const setSearchQuery = useVaultStore((s) => s.setSearchQuery);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);

  return (
    <header className="h-12 shrink-0 flex items-center gap-3 px-4 border-b border-border bg-bg-secondary">
      <div className="flex items-center gap-2 min-w-0">
        <img
          src="/lupo-appicon-steel.svg"
          alt=""
          className="size-5 rounded shrink-0"
          aria-hidden="true"
        />
        <span
          className="font-medium text-sm truncate max-w-[200px]"
          title={filePath ?? ""}
        >
          {baseName(filePath)}
        </span>
      </div>

      <div className="flex-1 max-w-md">
        <SearchInput
          id="vault-search-input"
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Buscar entradas... (Ctrl+F ou Ctrl+K)"
        />
      </div>

      {hasUnsavedChanges && (
        <span
          className="text-xs text-warning font-medium"
          title="Mudanças não-salvas no editor"
        >
          ● não salvo
        </span>
      )}

      <Button
        variant="ghost"
        size="icon"
        onClick={() => setAuditOpen(true)}
        aria-label="Auditoria do cofre"
        title="Auditoria do cofre"
      >
        <ShieldCheck />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        onClick={() => setSettingsOpen(true)}
        aria-label="Configurações de segurança"
        title="Configurações de segurança"
      >
        <Settings />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        onClick={() => setAboutOpen(true)}
        aria-label="Sobre o Lupo"
        title="Sobre o Lupo"
      >
        <Info />
      </Button>

      <AutoLockIndicator />

      <ThemeToggle />

      <Button
        variant="outline"
        size="sm"
        onClick={() => void requestLockWithGuard()}
        title="Bloquear cofre (Ctrl+L)"
      >
        <LockIcon />
        Bloquear
      </Button>

      <SecuritySettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
      />
      <VaultAuditDialog open={auditOpen} onOpenChange={setAuditOpen} />
      <AboutDialog open={aboutOpen} onOpenChange={setAboutOpen} />
    </header>
  );
}

function baseName(filePath: string | null): string {
  if (!filePath) return "Sem cofre";
  const parts = filePath.split(/[\\/]/);
  return parts[parts.length - 1] || filePath;
}
