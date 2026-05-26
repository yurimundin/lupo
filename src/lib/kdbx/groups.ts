import type { Kdbx, KdbxGroup } from "kdbxweb";

import { saveVault } from "./persistence";
import { describeError } from "./shared";

/** Resultado de `createGroupInVault` — grupo criado ou erro. */
export type CreateGroupResult =
  | { ok: true; group: KdbxGroup; durationMs: number }
  | { ok: false; error: string };

/**
 * Cria um novo grupo dentro de um grupo parent, persiste no arquivo,
 * e faz rollback in-memory se o save falhar.
 *
 * Padrão S19 Bloco 3 (rollback in-memory): snapshot antes da mutação +
 * revert no caminho de erro. Aqui o snapshot é trivial — só remover o
 * grupo recém-criado de `parent.groups` no rollback (não há side
 * effects adicionais como `meta.recycleBinUuid` do move).
 *
 * Validações de nome (não-vazio, max chars, duplicata entre siblings)
 * ficam no caller (UI dialog em `GroupSidebar`). Helper assume input
 * já validado.
 *
 * @returns `CreateGroupResult` — `{ ok: true, group, durationMs }` no
 *   sucesso, `{ ok: false, error }` em falha. NÃO lança — sempre
 *   retorna resultado.
 */
export async function createGroupInVault(
  filePath: string,
  kdbx: Kdbx,
  parent: KdbxGroup,
  name: string,
): Promise<CreateGroupResult> {
  if (!filePath || !kdbx || !parent || !name) {
    return { ok: false, error: "Estado inválido para criar grupo." };
  }

  try {
    // Mutação: kdbxweb adiciona ao parent.groups internamente.
    const newGroup = kdbx.createGroup(parent, name);

    const result = await saveVault(filePath, kdbx);
    if (!result.ok) {
      // Rollback in-memory: remover o grupo recém-criado de parent.groups.
      const idx = parent.groups.indexOf(newGroup);
      if (idx >= 0) {
        parent.groups.splice(idx, 1);
      }
      return { ok: false, error: result.error };
    }

    return { ok: true, group: newGroup, durationMs: result.durationMs };
  } catch (e) {
    return {
      ok: false,
      error: `Erro ao criar grupo: ${describeError(e)}`,
    };
  }
}

/** Resultado de `renameGroupInVault` — sucesso ou erro. */
export type RenameGroupResult =
  | { ok: true; durationMs: number }
  | { ok: false; error: string };

/**
 * Renomeia um grupo (set name + update times) e persiste no arquivo,
 * com rollback in-memory do nome se o save falhar.
 *
 * Padrão S19 Bloco 3 (rollback in-memory): snapshot do oldName antes
 * da mutação + revert no caminho de erro.
 *
 * Observação sutil sobre `times.update()`: o método altera
 * `lastModificationTime` em memória. Em caso de falha, fazemos
 * rollback do `name` mas NÃO do `times` — rationale:
 * (1) o arquivo persistido continua com times antigo (save falhou),
 * (2) UI não exibe `lastModificationTime` para usuário,
 * (3) próximo save bem-sucedido vai persistir times consistente.
 * Rollback completo de times exigiria snapshot de KdbxTimes inteiro
 * (mais complexo, ganho operacional nulo).
 *
 * Validações de nome (não-vazio, max chars, duplicata entre siblings)
 * ficam no caller (UI dialog). Helper assume input já validado.
 *
 * @returns `RenameGroupResult` — `{ ok: true, durationMs }` no
 *   sucesso, `{ ok: false, error }` em falha. NÃO lança — sempre
 *   retorna resultado.
 */
export async function renameGroupInVault(
  filePath: string,
  kdbx: Kdbx,
  group: KdbxGroup,
  newName: string,
): Promise<RenameGroupResult> {
  if (!filePath || !kdbx || !group || !newName) {
    return { ok: false, error: "Estado inválido para renomear grupo." };
  }

  // Snapshot do nome para rollback em caso de save fail.
  const oldName = group.name;

  try {
    // Mutação: set name + update times (kdbxweb convention).
    group.name = newName;
    group.times.update();

    const result = await saveVault(filePath, kdbx);
    if (!result.ok) {
      // Rollback in-memory do nome. Times mantém update (ver docstring).
      group.name = oldName;
      return { ok: false, error: result.error };
    }

    return { ok: true, durationMs: result.durationMs };
  } catch (e) {
    // Rollback do nome em exceção também.
    group.name = oldName;
    return {
      ok: false,
      error: `Erro ao renomear grupo: ${describeError(e)}`,
    };
  }
}

/** Resultado de `moveGroupToRecycleBin` — sucesso ou erro. */
export type MoveGroupResult =
  | { ok: true; durationMs: number }
  | { ok: false; error: string };

/**
 * Move um grupo (e todos os seus descendentes) para a Lixeira do
 * cofre, persiste no arquivo, e faz rollback in-memory se o save
 * falhar.
 *
 * Padrão S19 Bloco 3 (rollback in-memory): snapshot do `originalParent`
 * antes da mutação + revert no caminho de erro.
 *
 * kdbxweb cascade: `kdbx.move(group, recycleBin)` move o subtree
 * inteiro (todos os descendentes — grupos + entradas — seguem o
 * parent automaticamente). Comportamento KDBX padrão, sem código
 * adicional de cascade.
 *
 * Edge case (consistente com `moveEntryToRecycleBin`): se a Lixeira
 * for criada implicitamente por `kdbx.move` (vault sem Lixeira
 * anterior), ela permanece no cofre mesmo após rollback do grupo.
 * kdbxweb não expõe `destroyRecycleBin` — estado válido KDBX, aceito
 * como trade-off.
 *
 * Validações de elegibilidade (não pode mover root, não pode mover
 * a própria Lixeira, não pode mover grupo já dentro da Lixeira)
 * ficam no caller (UI context menu). Helper assume input já validado.
 *
 * @returns `MoveGroupResult` — `{ ok: true, durationMs }` no
 *   sucesso, `{ ok: false, error }` em falha. NÃO lança — sempre
 *   retorna resultado.
 */
export async function moveGroupToRecycleBin(
  filePath: string,
  kdbx: Kdbx,
  group: KdbxGroup,
): Promise<MoveGroupResult> {
  if (!filePath || !kdbx || !group) {
    return { ok: false, error: "Estado inválido para mover grupo para a lixeira." };
  }

  // Snapshot do parent original para rollback em caso de save fail.
  const originalParent = group.parentGroup;

  try {
    // Lookup da Lixeira via guard de UUID (consistente com
    // moveEntryToRecycleBin).
    let recycleBin: KdbxGroup | undefined;
    const existingUuid = kdbx.meta.recycleBinUuid;
    if (existingUuid && !existingUuid.empty) {
      recycleBin = kdbx.getGroup(existingUuid);
    }

    // Se não existir, criar explicitamente.
    if (!recycleBin) {
      kdbx.createRecycleBin();
      const newUuid = kdbx.meta.recycleBinUuid;
      if (newUuid && !newUuid.empty) {
        recycleBin = kdbx.getGroup(newUuid);
      }
      if (!recycleBin) {
        return {
          ok: false,
          error: "Falha ao criar a Lixeira do cofre.",
        };
      }
    }

    // Mutação: move o grupo (e descendentes) para a Lixeira.
    kdbx.move(group, recycleBin);

    const result = await saveVault(filePath, kdbx);
    if (!result.ok) {
      // Rollback in-memory: restaurar o grupo ao parent original.
      // Defesa: se originalParent é undefined (grupo era root), não
      // tentar mover de volta (não deveria acontecer pelas validações
      // do caller, mas seguro).
      if (originalParent) {
        kdbx.move(group, originalParent);
      }
      return { ok: false, error: result.error };
    }

    return { ok: true, durationMs: result.durationMs };
  } catch (e) {
    // Rollback em exceção também.
    if (originalParent) {
      try {
        kdbx.move(group, originalParent);
      } catch {
        // Rollback secundário falhou — estado inconsistente,
        // mas erro original do try é mais relevante.
      }
    }
    return {
      ok: false,
      error: `Erro ao mover grupo para a lixeira: ${describeError(e)}`,
    };
  }
}

/** Resultado de `restoreGroupFromRecycleBin` — duração ou erro. */
export type RestoreGroupResult =
  | { ok: true; durationMs: number }
  | { ok: false; error: string };

/**
 * Restaura um grupo da Lixeira (RecycleBin) para o grupo raiz do cofre.
 *
 * Apenas grupos diretamente filhos da Lixeira são elegíveis. Subgrupos
 * aninhados dentro de grupos na Lixeira são movidos junto com o pai
 * (cascade kdbxweb — mesma mecânica de `moveGroupToRecycleBin`).
 *
 * Comportamento alinhado com KeePassXC: grupo restaurado vai sempre
 * para o grupo raiz. O usuário pode movê-lo depois para outro grupo.
 *
 * Sem `confirmDialog` no helper — restaurar é ação benigna (reverte
 * uma deleção). Decisão UX fica no caller/hook.
 *
 * Persistência: chama `saveVault` (escrita atômica + backup `.bak` +
 * magic-check, ver §17 do CLAUDE.md). NÃO lança — sempre retorna
 * `RestoreGroupResult`.
 *
 * Em caso de erro de save: rollback in-memory automático — o grupo é
 * movido de volta para a Lixeira, preservando consistência com o disco.
 */
export async function restoreGroupFromRecycleBin(
  filePath: string,
  kdbx: Kdbx,
  group: KdbxGroup,
): Promise<RestoreGroupResult> {
  if (!filePath || !kdbx || !group) {
    return { ok: false, error: "Estado inválido para restaurar grupo." };
  }

  try {
    // Validação defensiva: confirmar Lixeira existe e que o grupo é
    // filho DIRETO dela (não mais profundo). UI já garante via context
    // menu condicional, mas defesa programática evita corrupção.
    const recycleBinUuid = kdbx.meta.recycleBinUuid;
    if (!recycleBinUuid || recycleBinUuid.empty) {
      return { ok: false, error: "Cofre não tem Lixeira configurada." };
    }
    const recycleBin = kdbx.getGroup(recycleBinUuid);
    if (!recycleBin) {
      return { ok: false, error: "Grupo Lixeira não encontrado no cofre." };
    }
    if (group.parentGroup !== recycleBin) {
      return { ok: false, error: "Este grupo não é filho direto da Lixeira." };
    }

    const root = kdbx.getDefaultGroup();
    if (!root) {
      return { ok: false, error: "Grupo raiz não encontrado no cofre." };
    }

    // Snapshot ANTES da mutação para rollback em caso de erro de save.
    const originalParent = group.parentGroup;

    kdbx.move(group, root);

    const result = await saveVault(filePath, kdbx);
    if (!result.ok) {
      // Rollback: voltar grupo para a Lixeira.
      if (originalParent) {
        kdbx.move(group, originalParent);
      }
      return { ok: false, error: result.error };
    }

    return { ok: true, durationMs: result.durationMs };
  } catch (e) {
    return {
      ok: false,
      error: `Erro ao restaurar grupo: ${describeError(e)}`,
    };
  }
}

