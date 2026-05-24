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

import type { KdbxGroup } from "kdbxweb";
import { Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { PoweredByBasis } from "@/components/layout/PoweredByBasis";
import { Button } from "@/components/ui/button";
import { useCreateGroup } from "@/hooks/useCreateGroup";
import { useDeleteGroup } from "@/hooks/useDeleteGroup";
import { useRenameGroup } from "@/hooks/useRenameGroup";
import { useRestoreGroup } from "@/hooks/useRestoreGroup";
import { useSetGroupIcon } from "@/hooks/useSetGroupIcon";
import { confirmDialog } from "@/lib/confirm";
import type { GroupIconColorId, GroupLucideIconId } from "@/lib/group-icons";
import { useSettingsStore } from "@/stores/settings";
import {
  type GroupTreeNode,
  findGroupByUuidIdInDb,
  getHasUnsavedChanges,
  useGroupTree,
  useRecycleBinUuidId,
  useVaultStore,
} from "@/stores/vault";

import { GroupTreeItem } from "./GroupTreeItem";
import { GroupIconDialog } from "./GroupIconDialog";
import { NewGroupDialog } from "./NewGroupDialog";
import { RenameGroupDialog } from "./RenameGroupDialog";

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

  // ----- S24 Bloco 3.D: criação de grupo via header "+" ---------------------
  const kdbx = useVaultStore((s) => s.kdbx);
  const recycleBinUuidId = useRecycleBinUuidId();
  const createGroup = useCreateGroup();
  const renameGroup = useRenameGroup();
  const deleteGroup = useDeleteGroup();
  const restoreGroup = useRestoreGroup();
  const setGroupIcon = useSetGroupIcon();
  const [isNewGroupOpen, setIsNewGroupOpen] = useState(false);
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [isIconDialogOpen, setIsIconDialogOpen] = useState(false);
  const [renameTargetGroup, setRenameTargetGroup] = useState<KdbxGroup | null>(
    null,
  );
  const [iconTargetGroup, setIconTargetGroup] = useState<KdbxGroup | null>(null);
  // Override do targetParent quando "Novo subgrupo" vem do context menu
  // (em vez do botão "+" do header). Reset ao fechar NewGroupDialog.
  const [ctxCreateTarget, setCtxCreateTarget] = useState<KdbxGroup | null>(
    null,
  );

  // Resolver parent: selectedGroup ou root como fallback (vault recém-aberto).
  const rootGroup = kdbx?.getDefaultGroup() ?? null;
  const selectedGroup =
    kdbx && selectedGroupUuid
      ? findGroupByUuidIdInDb(kdbx, selectedGroupUuid)
      : null;

  // Getter para passar como prop ao GroupTreeItem. Resolve KdbxGroup
  // a partir de uuid (lookup via findGroupByUuidIdInDb). Memoizado
  // com deps [kdbx] para estabilidade da prop.
  const getGroupByUuid = useCallback(
    (uuid: string): KdbxGroup | null =>
      kdbx ? findGroupByUuidIdInDb(kdbx, uuid) : null,
    [kdbx],
  );

  // Walk-up para detectar se o grupo selecionado é (ou descende da) Lixeira.
  // Sem helper exportado para isso (existe `useIsCurrentGroupRecycleBin` mas
  // é hook, não pode ser chamado dentro de outra função). Inline aqui.
  function isInRecycleBinSubtree(group: KdbxGroup | null): boolean {
    if (!group || !recycleBinUuidId) return false;
    let current: KdbxGroup | undefined = group;
    while (current) {
      if (current.uuid.id === recycleBinUuidId) return true;
      current = current.parentGroup;
    }
    return false;
  }

  const selectedIsRecycleBin = isInRecycleBinSubtree(selectedGroup);
  // Precedência: context menu > seleção atual > root.
  // ctxCreateTarget é setado quando "Novo subgrupo" vem do context menu,
  // permitindo criar subgrupo de um grupo específico sem mudar seleção.
  const targetParent = ctxCreateTarget ?? selectedGroup ?? rootGroup;
  const targetParentIsRoot =
    !!targetParent && targetParent.uuid.id === rootGroup?.uuid.id;
  const canCreateGroup = !!targetParent && !selectedIsRecycleBin && !!kdbx;

  /**
   * Handler de confirmação do NewGroupDialog: chama o hook de criação e,
   * em sucesso, garante que o `targetParent` esteja expandido na sidebar
   * (UX: usuário precisa ver o filho recém-criado).
   */
  async function handleCreateGroup(name: string): Promise<boolean> {
    if (!targetParent) return false;
    const ok = await createGroup(targetParent, name);
    if (ok) {
      const filePath = useVaultStore.getState().lastFilePath;
      if (
        filePath &&
        !useSettingsStore
          .getState()
          .isGroupExpanded(filePath, targetParent.uuid.id)
      ) {
        useSettingsStore
          .getState()
          .toggleGroupExpanded(filePath, targetParent.uuid.id);
      }
    }
    return ok;
  }

  // Handler do context menu: criar subgrupo de um grupo específico
  // (em vez do selectedGroup, que é o default do botão "+" do header).
  function handleCreateSubgroup(group: KdbxGroup) {
    setCtxCreateTarget(group);
    setIsNewGroupOpen(true);
  }

  // Handler do context menu: abrir dialog de renomear.
  function handleRename(group: KdbxGroup) {
    setRenameTargetGroup(group);
    setIsRenameOpen(true);
  }

  function handleChangeIcon(group: KdbxGroup) {
    setIconTargetGroup(group);
    setIsIconDialogOpen(true);
  }

  // Handler do context menu: mover grupo para Lixeira.
  // useDeleteGroup já cuida de confirmDialog + toast + selectGroup(parent).
  async function handleDelete(group: KdbxGroup) {
    await deleteGroup(group);
  }

  // Handler do context menu: restaurar grupo da Lixeira para o raiz.
  // useRestoreGroup cuida de toast + selectGroup(uuid) (navega pro grupo).
  async function handleRestore(group: KdbxGroup) {
    await restoreGroup(group);
  }

  // Handler do RenameGroupDialog: confirmar novo nome.
  async function handleConfirmRename(newName: string): Promise<boolean> {
    if (!renameTargetGroup) return false;
    return renameGroup(renameTargetGroup, newName);
  }

  async function handleConfirmIcon(
    group: KdbxGroup,
    iconId: GroupLucideIconId | null,
    colorId: GroupIconColorId | null,
  ): Promise<boolean> {
    return setGroupIcon(group, iconId, colorId);
  }

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
      className="border-r border-border flex flex-col h-full"
      onKeyDown={(e) => void handleKeyDown(e)}
    >
      <header className="shrink-0 px-3 py-2 border-b border-border flex items-center justify-between">
        <span className="text-xs text-muted-foreground font-medium">
          Grupos
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          disabled={!canCreateGroup}
          onClick={() => setIsNewGroupOpen(true)}
          title={
            selectedIsRecycleBin
              ? "Não é possível criar grupo na Lixeira"
              : "Criar novo grupo"
          }
          aria-label="Criar novo grupo"
        >
          <Plus className="size-4" />
        </Button>
      </header>
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
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
            recycleBinUuidId={recycleBinUuidId}
            getGroupByUuid={getGroupByUuid}
            onCreateSubgroup={handleCreateSubgroup}
            onChangeIcon={handleChangeIcon}
            onRename={handleRename}
            onDelete={(group) => void handleDelete(group)}
            onRestore={(group) => void handleRestore(group)}
          />
        ))}
      </div>
      <PoweredByBasis />
      {targetParent && (
        <NewGroupDialog
          open={isNewGroupOpen}
          onOpenChange={(open) => {
            setIsNewGroupOpen(open);
            if (!open) setCtxCreateTarget(null);
          }}
          parent={targetParent}
          parentIsRoot={targetParentIsRoot}
          onConfirm={handleCreateGroup}
        />
      )}
      {renameTargetGroup && (
        <RenameGroupDialog
          open={isRenameOpen}
          onOpenChange={(open) => {
            setIsRenameOpen(open);
            if (!open) setRenameTargetGroup(null);
          }}
          group={renameTargetGroup}
          onConfirm={handleConfirmRename}
        />
      )}
      {iconTargetGroup && (
        <GroupIconDialog
          open={isIconDialogOpen}
          onOpenChange={(open) => {
            setIsIconDialogOpen(open);
            if (!open) setIconTargetGroup(null);
          }}
          group={iconTargetGroup}
          onConfirm={handleConfirmIcon}
        />
      )}
    </aside>
  );
}
