// Header global do cofre aberto. Mostra nome do arquivo, busca
// (placeholder por enquanto — tarefa para Sessão 4), indicador de
// auto-lock e botão "Bloquear".

import { Lock as LockIcon, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useHasUnsavedChanges, useVaultStore } from "@/stores/vault";

import { AutoLockIndicator } from "./AutoLockIndicator";

export function VaultHeader() {
  const filePath = useVaultStore((s) => s.filePath);
  const lock = useVaultStore((s) => s.lock);
  const hasUnsavedChanges = useHasUnsavedChanges();

  return (
    <header className="h-12 shrink-0 flex items-center gap-3 px-4 border-b border-border bg-bg-secondary">
      <span
        className="font-medium text-sm truncate max-w-[200px]"
        title={filePath ?? ""}
      >
        {baseName(filePath)}
      </span>

      <div className="flex-1 max-w-md relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
        <Input
          id="vault-search-input"
          placeholder="Buscar entradas... (Ctrl+K)"
          className="pl-8 h-8"
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

      <AutoLockIndicator />

      <Button
        variant="outline"
        size="sm"
        onClick={lock}
        title="Bloquear cofre (Ctrl+L)"
      >
        <LockIcon />
        Bloquear
      </Button>
    </header>
  );
}

function baseName(filePath: string | null): string {
  if (!filePath) return "Sem cofre";
  const parts = filePath.split(/[\\/]/);
  return parts[parts.length - 1] || filePath;
}
