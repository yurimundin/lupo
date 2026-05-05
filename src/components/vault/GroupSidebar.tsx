// Sidebar (esquerda) — lista de grupos do cofre.
//
// Por enquanto render flat (sem subgrupos expansíveis). O grupo raiz
// aparece como primeiro item. Setas ↑/↓ navegam quando algum item está
// focado; Enter/Espaço seleciona (comportamento padrão do <button>).

import { Folder, Trash2 } from "lucide-react";
import { useEffect, useRef } from "react";

import { confirmDialog } from "@/lib/confirm";
import { cn } from "@/lib/utils";
import {
  getGroupDisplayName,
  getHasUnsavedChanges,
  useRecycleBinUuidId,
  useTopLevelGroups,
  useVaultStore,
} from "@/stores/vault";

export function GroupSidebar() {
  const groups = useTopLevelGroups();
  const selectedGroupUuid = useVaultStore((s) => s.selectedGroupUuid);
  const selectGroup = useVaultStore((s) => s.selectGroup);
  // UUID da Lixeira (string) ou null. Usado pra (a) trocar o ícone do
  // grupo correspondente (Trash2 em vez de Folder) e (b) traduzir o nome
  // exibido para "Lixeira" via `getGroupDisplayName` — sem mexer no XML
  // canônico ("Recycle Bin"), preservando interop com KeePassXC.
  const recycleBinUuidId = useRecycleBinUuidId();

  const containerRef = useRef<HTMLElement>(null);

  // Sincroniza o foco no botão selecionado quando navegação por setas
  // muda a seleção (mantém o "anel" do navegador no item certo).
  useEffect(() => {
    if (!selectedGroupUuid) return;
    const focused = document.activeElement;
    if (!(focused instanceof HTMLButtonElement)) return;
    if (!containerRef.current?.contains(focused)) return;
    const btn = containerRef.current.querySelector<HTMLButtonElement>(
      `[data-group-uuid="${selectedGroupUuid}"]`,
    );
    btn?.focus();
  }, [selectedGroupUuid]);

  /**
   * Guard pra trocar de grupo quando há draft pendente. `selectGroup` no
   * store já limpa editMode/draft, mas precisamos confirmar com o usuário
   * antes pra ele não perder mudanças por engano.
   */
  async function confirmDiscardIfDirty(): Promise<boolean> {
    if (!getHasUnsavedChanges()) return true;
    return confirmDialog({
      title: "Mudanças não salvas",
      description:
        "Você tem mudanças não salvas. Mudar de grupo vai descartar essas mudanças. Continuar?",
      confirmLabel: "Descartar e continuar",
      cancelLabel: "Voltar e salvar",
      variant: "danger",
    });
  }

  async function handleGroupClick(uuid: string) {
    if (uuid === selectedGroupUuid) return;
    if (!(await confirmDiscardIfDirty())) return;
    selectGroup(uuid);
  }

  async function handleKeyDown(e: React.KeyboardEvent, idx: number) {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const nextIdx =
      e.key === "ArrowDown" ? idx + 1 : e.key === "ArrowUp" ? idx - 1 : -1;
    if (nextIdx < 0 || nextIdx >= groups.length) return;
    e.preventDefault();
    if (!(await confirmDiscardIfDirty())) return;
    selectGroup(groups[nextIdx].uuid.id);
  }

  if (groups.length === 0) {
    return (
      <aside className="border-r border-border p-3 text-xs text-muted-foreground">
        (sem grupos)
      </aside>
    );
  }

  return (
    <aside
      ref={containerRef}
      className="border-r border-border overflow-y-auto p-2 space-y-0.5"
    >
      {groups.map((g, idx) => {
        const selected = g.uuid.id === selectedGroupUuid;
        const isRecycleBin = g.uuid.id === recycleBinUuidId;
        const Icon = isRecycleBin ? Trash2 : Folder;
        return (
          <button
            key={g.uuid.id}
            type="button"
            data-group-uuid={g.uuid.id}
            onClick={() => void handleGroupClick(g.uuid.id)}
            onKeyDown={(e) => void handleKeyDown(e, idx)}
            className={cn(
              "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
              selected
                ? "bg-brand-soft font-semibold text-foreground"
                : "hover:bg-muted text-foreground",
            )}
          >
            <Icon
              className={cn(
                "size-4 shrink-0",
                isRecycleBin ? "text-muted-foreground" : "text-brand-tertiary",
              )}
            />
            <span className="flex-1 truncate">
              {getGroupDisplayName(g, recycleBinUuidId)}
            </span>
            <span className="text-xs text-muted-foreground tabular-nums">
              {g.entries.length}
            </span>
          </button>
        );
      })}
    </aside>
  );
}
