// Sidebar (esquerda) — árvore recursiva de grupos do cofre.
//
// Sessão 11: substitui o render flat (filhos diretos do root) por
// hierarquia recursiva. Cada grupo pode ter chevron de expand/collapse
// (estado persistido por cofre em `useSettingsStore`). Ver §27 do
// CLAUDE.md.
//
// Keyboard nav: as setas ↑/↓ navegam pelos grupos VISÍVEIS (flatten da
// árvore considerando estado expandido/colapsado). Setas →/← respeitam
// o nó focado: → expande (se folha pode receber focus mas não faz nada),
// ← colapsa (ou sobe pro pai se já colapsado). Padrão alinhado com
// VS Code Explorer / KeePassXC.

import { useEffect, useMemo, useRef } from "react";

import { confirmDialog } from "@/lib/confirm";
import { useSettingsStore } from "@/stores/settings";
import {
  type GroupTreeNode,
  getHasUnsavedChanges,
  useGroupTree,
  useVaultStore,
} from "@/stores/vault";

import { GroupTreeItem } from "./GroupTreeItem";

interface FlatNode {
  node: GroupTreeNode;
  visible: boolean;
}

/**
 * Achata a árvore em uma lista linear na ordem visível, considerando
 * `forceExpanded` no nó raiz e o predicado `expandedPredicate` para os
 * demais. Usado pra keyboard nav (precisa de índice global do nó focado
 * em relação aos visíveis).
 */
function flattenVisible(
  tree: GroupTreeNode[],
  expandedPredicate: (uuid: string) => boolean,
): FlatNode[] {
  const out: FlatNode[] = [];
  function walk(node: GroupTreeNode, parentExpanded: boolean) {
    const visible = parentExpanded;
    out.push({ node, visible });
    const isRoot = node.parentUuid === null;
    const expanded = isRoot || expandedPredicate(node.uuid);
    for (const child of node.children) {
      walk(child, parentExpanded && expanded);
    }
  }
  for (const root of tree) {
    walk(root, true);
  }
  return out.filter((entry) => entry.visible);
}

export function GroupSidebar() {
  const tree = useGroupTree();
  const selectedGroupUuid = useVaultStore((s) => s.selectedGroupUuid);
  const selectGroup = useVaultStore((s) => s.selectGroup);
  const lastFilePath = useVaultStore((s) => s.lastFilePath);

  const toggleGroupExpanded = useSettingsStore((s) => s.toggleGroupExpanded);
  // Snapshot atômico do mapa por vault — re-renderiza quando muda. NÃO
  // chamar `isGroupExpanded(...)` direto no render porque isso leria via
  // `get()` sem subscribe (a UI não atualizaria).
  const expandedForVault = useSettingsStore((s) =>
    lastFilePath ? (s.expandedGroupsByVault[lastFilePath] ?? null) : null,
  );

  // Set imutável e estável por render — base do predicado pra renderer
  // e pro flatten. Recriado quando o array muda (ref ou conteúdo).
  const expandedSet = useMemo(
    () => new Set(expandedForVault ?? []),
    [expandedForVault],
  );

  const containerRef = useRef<HTMLElement>(null);

  // Mantém o foco do navegador no botão correspondente ao grupo selecionado.
  // Quando a seleção muda via setas, atualiza o `tabindex` natural só
  // depois do React re-renderizar.
  useEffect(() => {
    if (!selectedGroupUuid) return;
    const focused = document.activeElement;
    if (!(focused instanceof HTMLButtonElement)) return;
    if (!containerRef.current?.contains(focused)) return;
    const btn = containerRef.current.querySelector<HTMLButtonElement>(
      `[data-group-name-uuid="${selectedGroupUuid}"]`,
    );
    btn?.focus();
  }, [selectedGroupUuid]);

  // Lista linear dos nós visíveis — base da keyboard nav. Inclui o
  // próprio nó raiz (que sempre é visível, `forceExpanded`).
  const visibleNodes = useMemo(
    () => flattenVisible(tree, (uuid) => expandedSet.has(uuid)),
    [tree, expandedSet],
  );

  /**
   * Confirma com o usuário antes de descartar mudanças não-salvas.
   * Aplicado APENAS na mudança de seleção (não no toggle de chevron).
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

  async function handleSelect(uuid: string) {
    if (uuid === selectedGroupUuid) return;
    if (!(await confirmDiscardIfDirty())) return;
    selectGroup(uuid);
  }

  function handleToggleExpanded(uuid: string) {
    if (!lastFilePath) return;
    toggleGroupExpanded(lastFilePath, uuid);
  }

  function isExpanded(uuid: string): boolean {
    return expandedSet.has(uuid);
  }

  /**
   * Keyboard nav recursiva: ↑/↓ navega pelos visíveis; →/← expande/
   * colapsa quando faz sentido. Atalhos de seleção via Enter/Espaço
   * ficam por conta do comportamento padrão do `<button>`.
   */
  async function handleKeyDown(e: React.KeyboardEvent) {
    if (
      e.key !== "ArrowDown" &&
      e.key !== "ArrowUp" &&
      e.key !== "ArrowLeft" &&
      e.key !== "ArrowRight"
    ) {
      return;
    }

    const idx = visibleNodes.findIndex(
      (entry) => entry.node.uuid === selectedGroupUuid,
    );
    if (idx < 0) return;

    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      const nextIdx = e.key === "ArrowDown" ? idx + 1 : idx - 1;
      if (nextIdx < 0 || nextIdx >= visibleNodes.length) return;
      e.preventDefault();
      if (!(await confirmDiscardIfDirty())) return;
      selectGroup(visibleNodes[nextIdx].node.uuid);
      return;
    }

    const current = visibleNodes[idx].node;
    const isRoot = current.parentUuid === null;
    const hasChildren = current.children.length > 0;
    const currentlyExpanded = isExpanded(current.uuid);

    if (e.key === "ArrowRight" && hasChildren && !currentlyExpanded && !isRoot) {
      e.preventDefault();
      handleToggleExpanded(current.uuid);
      return;
    }

    if (e.key === "ArrowLeft") {
      if (hasChildren && currentlyExpanded && !isRoot) {
        e.preventDefault();
        handleToggleExpanded(current.uuid);
        return;
      }
      // Já colapsado (ou folha): sobe pro pai (sem ser o root, pra não
      // quebrar UX — root é sempre o ponto âncora).
      if (current.parentUuid && current.parentUuid !== tree[0]?.uuid) {
        e.preventDefault();
        if (!(await confirmDiscardIfDirty())) return;
        selectGroup(current.parentUuid);
      }
    }
  }

  if (tree.length === 0) {
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
      onKeyDown={(e) => void handleKeyDown(e)}
    >
      {tree.map((rootNode) => (
        <GroupTreeItem
          key={rootNode.uuid}
          node={rootNode}
          selectedGroupUuid={selectedGroupUuid}
          expanded={true}
          forceExpanded={true}
          onSelect={(uuid) => void handleSelect(uuid)}
          onToggleExpanded={handleToggleExpanded}
          isExpanded={isExpanded}
        />
      ))}
    </aside>
  );
}
