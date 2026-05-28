import type { Kdbx, KdbxEntry, KdbxGroup } from "kdbxweb";

import {
  SEC_BASIS_ENTRY_FAVORITE_KEY,
  setEntryFavorite,
} from "../entry-helpers";
import { saveVault } from "./persistence";
import { describeError } from "./shared";

type KdbxEntryCustomDataItem = NonNullable<KdbxEntry["customData"]> extends Map<
  string,
  infer Item
>
  ? Item
  : never;

/** Resultado de `moveEntryToRecycleBin` — backend pode retornar duração ou erro. */
export type DeleteResult =
  | { ok: true; durationMs: number }
  | { ok: false; error: string };

/** Resultado de `moveEntryToGroup` — duração ou erro. */
export type MoveEntryResult =
  | { ok: true; durationMs: number }
  | { ok: false; error: string };

/** Resultado de `setEntryFavoriteInVault` — duração ou erro. */
export type SetEntryFavoriteResult =
  | { ok: true; durationMs: number }
  | { ok: false; error: string };

function isGroupInRecycleBinSubtree(
  group: KdbxGroup | undefined,
  recycleBin: KdbxGroup | undefined,
): boolean {
  if (!group || !recycleBin) return false;
  let current: KdbxGroup | undefined = group;
  while (current) {
    if (current === recycleBin) return true;
    current = current.parentGroup;
  }
  return false;
}

export async function setEntryFavoriteInVault(
  filePath: string,
  kdbx: Kdbx,
  entry: KdbxEntry,
  favorite: boolean,
): Promise<SetEntryFavoriteResult> {
  if (!filePath || !kdbx || !entry) {
    return { ok: false, error: "Estado inválido para favoritar entrada." };
  }

  const snapshot = {
    hadCustomData: !!entry.customData,
    oldFavoriteItem: entry.customData?.get(SEC_BASIS_ENTRY_FAVORITE_KEY) as
      | KdbxEntryCustomDataItem
      | undefined,
  };

  try {
    setEntryFavorite(entry, favorite);
    entry.times.update();

    const result = await saveVault(filePath, kdbx);
    if (!result.ok) {
      restoreEntryFavoriteSnapshot(entry, snapshot);
      return { ok: false, error: result.error };
    }

    return { ok: true, durationMs: result.durationMs };
  } catch (e) {
    restoreEntryFavoriteSnapshot(entry, snapshot);
    return {
      ok: false,
      error: `Erro ao favoritar entrada: ${describeError(e)}`,
    };
  }
}

function restoreEntryFavoriteSnapshot(
  entry: KdbxEntry,
  snapshot: {
    hadCustomData: boolean;
    oldFavoriteItem: KdbxEntryCustomDataItem | undefined;
  },
): void {
  if (!snapshot.hadCustomData) {
    entry.customData = undefined;
    return;
  }

  entry.customData ??= new Map();
  if (snapshot.oldFavoriteItem) {
    entry.customData.set(
      SEC_BASIS_ENTRY_FAVORITE_KEY,
      snapshot.oldFavoriteItem,
    );
  } else {
    entry.customData.delete(SEC_BASIS_ENTRY_FAVORITE_KEY);
  }
}

/**
 * Move uma entry para outro grupo normal do cofre e persiste a alteração.
 *
 * Esta é a operação usada pelo drag and drop da sidebar. Não substitui
 * o fluxo de Lixeira: mover para/de dentro da Lixeira continua passando
 * por `moveEntryToRecycleBin` e `restoreEntryFromRecycleBin`, que têm
 * semântica própria de exclusão/restauração.
 *
 * Em caso de erro de save, desfaz a movimentação em memória para manter
 * o estado do app consistente com o arquivo no disco.
 */
export async function moveEntryToGroup(
  filePath: string,
  kdbx: Kdbx,
  entry: KdbxEntry,
  targetGroup: KdbxGroup,
): Promise<MoveEntryResult> {
  if (!filePath || !kdbx || !entry || !targetGroup) {
    return { ok: false, error: "Estado inválido para mover entrada." };
  }

  try {
    const originalParent = entry.parentGroup;
    if (!originalParent) {
      return {
        ok: false,
        error: "Grupo original da entrada não encontrado.",
      };
    }

    if (originalParent === targetGroup) {
      return { ok: false, error: "Entrada já está nesta pasta." };
    }

    let recycleBin: KdbxGroup | undefined;
    const recycleBinUuid = kdbx.meta.recycleBinUuid;
    if (recycleBinUuid && !recycleBinUuid.empty) {
      recycleBin = kdbx.getGroup(recycleBinUuid);
    }

    if (
      isGroupInRecycleBinSubtree(originalParent, recycleBin) ||
      isGroupInRecycleBinSubtree(targetGroup, recycleBin)
    ) {
      return {
        ok: false,
        error: "Mover entradas envolvendo a Lixeira não é permitido.",
      };
    }

    kdbx.move(entry, targetGroup);

    const result = await saveVault(filePath, kdbx);
    if (!result.ok) {
      kdbx.move(entry, originalParent);
      return { ok: false, error: result.error };
    }

    return { ok: true, durationMs: result.durationMs };
  } catch (e) {
    return {
      ok: false,
      error: `Erro ao mover entrada: ${describeError(e)}`,
    };
  }
}

/**
 * Move uma entry para o grupo Lixeira (RecycleBin) do cofre. Soft-delete
 * compatível com KeePass/KeePassXC — usa a API nativa `kdbx.move(...)` da
 * kdbxweb, que atualiza `parentGroup`, `LocationChanged` e demais campos
 * de housekeeping da forma esperada por outros leitores do formato.
 *
 * Soft-delete (não hard-delete) é a escolha porque:
 *   1. Compatibilidade total com KeePass/KeePassXC: lixeira gerada/movida
 *      no Sec.Basis aparece nos outros clientes do ecossistema.
 *   2. UX padrão do KeePass há décadas — usuário pode restaurar entradas
 *      deletadas por engano.
 *   3. MVP atual não implementa restaurar/esvaziar (Sessão 5+); isso é OK
 *      porque a entry continua acessível via KeePassXC enquanto o gerente
 *      não estiver pronto.
 *
 * Se o cofre ainda não tem RecycleBin configurado (ou o UUID está vazio),
 * cria via `kdbx.createRecycleBin()` — mesmo padrão do KeePassXC quando
 * o usuário move algo pela primeira vez.
 *
 * Persistência: chama `saveVault` (escrita atômica + backup `.bak` +
 * magic-check, ver §17 do CLAUDE.md). NÃO lança — sempre retorna
 * `DeleteResult`.
 *
 * Em caso de erro de save: rollback in-memory automático — a entry é
 * movida de volta para o parent original. Edge case: se a Lixeira foi
 * criada nesta operação (não existia antes), ela permanece em memória
 * como Lixeira vazia órfã. Esse estado é válido no formato KDBX e será
 * persistido consistentemente no próximo save bem-sucedido. kdbxweb
 * não expõe API para destruir Lixeira; reverter manipulando
 * `meta.recycleBinUuid` teria risco de corrupção.
 */
export async function moveEntryToRecycleBin(
  filePath: string,
  kdbx: Kdbx,
  entry: KdbxEntry,
): Promise<DeleteResult> {
  if (!filePath || !kdbx || !entry) {
    return { ok: false, error: "Estado inválido para mover entrada." };
  }

  try {
    // Snapshot ANTES de qualquer mutação para rollback em caso de
    // erro de save. Captura o parent original da entry; a Lixeira
    // recém-criada (se houver) é aceita como estado órfão (vide docstring).
    const originalParent = entry.parentGroup;

    let recycleBin: KdbxGroup | undefined;
    const existingUuid = kdbx.meta.recycleBinUuid;
    if (existingUuid && !existingUuid.empty) {
      recycleBin = kdbx.getGroup(existingUuid);
    }

    if (!recycleBin) {
      // Cria grupo "Recycle Bin" e seta `meta.recycleBinUuid` em uma só
      // chamada — comportamento idêntico ao KeePassXC quando o usuário
      // move a primeira entry de um cofre que ainda não tem lixeira.
      kdbx.createRecycleBin();
      const newUuid = kdbx.meta.recycleBinUuid;
      if (newUuid && !newUuid.empty) {
        recycleBin = kdbx.getGroup(newUuid);
      }
      if (!recycleBin) {
        return { ok: false, error: "Falha ao criar grupo Lixeira no cofre." };
      }
    }

    // Defesa: se a entry já está dentro da lixeira, não fazer nada (e
    // ainda assim reportar OK pra UI ficar consistente). Cenário não
    // deveria acontecer porque o botão Deletar está disabled em entries
    // da lixeira, mas vale defesa programática.
    if (entry.parentGroup === recycleBin) {
      return { ok: false, error: "Entrada já está na Lixeira." };
    }

    kdbx.move(entry, recycleBin);

    const result = await saveVault(filePath, kdbx);
    if (!result.ok) {
      // Rollback: voltar entry para o parent original.
      // Lixeira recém-criada (se houver) permanece como estado órfão
      // válido — ver docstring.
      if (originalParent) {
        kdbx.move(entry, originalParent);
      }
      return { ok: false, error: result.error };
    }

    return { ok: true, durationMs: result.durationMs };
  } catch (e) {
    return {
      ok: false,
      error: `Erro ao mover entrada: ${describeError(e)}`,
    };
  }
}

/** Resultado de `restoreEntryFromRecycleBin` — duração ou erro. */
export type RestoreResult =
  | { ok: true; durationMs: number }
  | { ok: false; error: string };

/**
 * Restaura uma entry da Lixeira (RecycleBin) para o grupo raiz do cofre.
 *
 * Comportamento alinhado com KeePassXC: o grupo de origem NÃO é preservado
 * (KDBX não armazena essa informação no momento do soft-delete). A entry
 * vai sempre para o grupo raiz; o usuário pode movê-la depois para outro
 * grupo se quiser.
 *
 * Ao contrário do `moveEntryToRecycleBin`, restaurar é ação benigna
 * (reverte uma deleção) — o hook chamador (`useRestoreEntry`) NÃO usa
 * `confirmDialog`. Padrão alinhado com KeePassXC e Gmail.
 *
 * Persistência: chama `saveVault` (escrita atômica + backup `.bak` +
 * magic-check, ver §17 do CLAUDE.md). NÃO lança — sempre retorna
 * `RestoreResult`.
 *
 * Em caso de erro de save: rollback in-memory automático — a entry é
 * movida de volta para a Lixeira (parentGroup original), preservando
 * a consistência entre estado em memória e disco.
 */
export async function restoreEntryFromRecycleBin(
  filePath: string,
  kdbx: Kdbx,
  entry: KdbxEntry,
): Promise<RestoreResult> {
  if (!filePath || !kdbx || !entry) {
    return { ok: false, error: "Estado inválido para restaurar entrada." };
  }

  try {
    // Validação defensiva: confirmar que o cofre tem RecycleBin e que a
    // entry está REALMENTE dentro dela. UI já desabilita o botão fora
    // desse caso, mas defesa programática evita corrupção silenciosa se
    // algum bug futuro chamar essa função em estado errado.
    const recycleBinUuid = kdbx.meta.recycleBinUuid;
    if (!recycleBinUuid || recycleBinUuid.empty) {
      return { ok: false, error: "Cofre não tem Lixeira configurada." };
    }
    const recycleBin = kdbx.getGroup(recycleBinUuid);
    if (!recycleBin) {
      return { ok: false, error: "Grupo Lixeira não encontrado no cofre." };
    }
    if (entry.parentGroup !== recycleBin) {
      return { ok: false, error: "Esta entrada não está na Lixeira." };
    }

    const root = kdbx.getDefaultGroup();
    if (!root) {
      return { ok: false, error: "Grupo raiz não encontrado no cofre." };
    }

    // Snapshot ANTES da mutação para rollback em caso de erro de save.
    const originalParent = entry.parentGroup;

    kdbx.move(entry, root);

    const result = await saveVault(filePath, kdbx);
    if (!result.ok) {
      // Rollback: voltar entry para o parent original (Lixeira).
      // Mantém estado in-memory consistente com o disco.
      if (originalParent) {
        kdbx.move(entry, originalParent);
      }
      return { ok: false, error: result.error };
    }

    return { ok: true, durationMs: result.durationMs };
  } catch (e) {
    return {
      ok: false,
      error: `Erro ao restaurar entrada: ${describeError(e)}`,
    };
  }
}

/** Resultado de `emptyRecycleBin` — duração + contagem ou erro. */
export type EmptyRecycleBinResult =
  | { ok: true; durationMs: number; entriesDeleted: number }
  | { ok: false; error: string };

/**
 * Apaga permanentemente todas as entries do grupo Lixeira (RecycleBin)
 * — hard-delete, sem possibilidade de restauração pelo Sec.Basis.
 *
 * Mecânica: itera `kdbx.move(entry, undefined)` em cada entry da
 * Lixeira (ver detalhe da escolha da API logo abaixo, dentro da função).
 * Cada `move(..., undefined)` chama `addDeletedObject()` da kdbxweb
 * automaticamente, populando `meta.deletedObjects` (lista interna do
 * KDBX usada para reconciliação em cenários de sincronização entre
 * múltiplos cofres) com o tombstone da entry. A entry deixa de aparecer
 * em qualquer grupo, mas o tombstone permanece no formato — é o
 * comportamento padrão do KeePass e é o que outros leitores esperam.
 *
 * Snapshot do array antes de iterar é OBRIGATÓRIO porque `kdbx.move`
 * muta `recycleBin.entries` in-place; iterar diretamente faria skip de
 * elementos.
 *
 * Persistência: chama `saveVault` (escrita atômica + backup `.bak` +
 * magic-check, ver §17 do CLAUDE.md). NÃO lança — sempre retorna
 * `EmptyRecycleBinResult`.
 *
 * Em caso de erro de save (ou exceção mid-loop): rollback in-memory
 * completo (padrão §19 Bloco 3 — pendência aberta desde S19 fechada
 * em S31). Restaura `recycleBin.entries` na ordem original via splice,
 * reverte `parentGroup` de cada entry para o `recycleBin`, e trunca
 * `kdbx.deletedObjects` removendo os tombstones adicionados (que
 * nunca chegaram ao disco). Snapshots declarados fora do `try {}`
 * para serem acessíveis no `catch`.
 */
export async function emptyRecycleBin(
  filePath: string,
  kdbx: Kdbx,
): Promise<EmptyRecycleBinResult> {
  if (!filePath || !kdbx) {
    return { ok: false, error: "Estado inválido para esvaziar Lixeira." };
  }

  // Vars de snapshot declaradas fora do try {} para acesso no catch
  // (rollback de exceção mid-loop). Permanecem em estado vazio até o
  // snapshot bem-sucedido logo abaixo as popule. `recycleBin` é
  // undefined no início — o `if (recycleBin && ...)` no catch garante
  // que rollback só roda se o snapshot foi capturado.
  let recycleBin: KdbxGroup | undefined;
  let originalEntries: KdbxEntry[] = [];
  let tombstoneCountBefore = 0;

  try {
    const recycleBinUuid = kdbx.meta.recycleBinUuid;
    if (!recycleBinUuid || recycleBinUuid.empty) {
      return { ok: false, error: "Cofre não tem Lixeira configurada." };
    }
    recycleBin = kdbx.getGroup(recycleBinUuid);
    if (!recycleBin) {
      return { ok: false, error: "Grupo Lixeira não encontrado no cofre." };
    }

    // Snapshot completo ANTES do hard-delete — duas dimensões:
    //   1. originalEntries: cópia do array recycleBin.entries para
    //      preservar a ORDEM e permitir restauração via splice no
    //      rollback (kdbx.move muta o array in-place — iterar
    //      diretamente faria skip de elementos).
    //   2. tombstoneCountBefore: tamanho atual de
    //      kdbx.deletedObjects. Cada kdbx.move(entry, undefined) faz
    //      push de um KdbxDeletedObject; rollback trunca o array de
    //      volta ao tamanho original (in-memory only — save falhou,
    //      tombstones nunca foram persistidos).
    originalEntries = [...recycleBin.entries];
    const count = originalEntries.length;
    tombstoneCountBefore = kdbx.deletedObjects.length;

    if (count === 0) {
      return { ok: false, error: "Lixeira já está vazia." };
    }

    // Hard-delete de cada entry.
    // kdbx.move(entry, undefined) é a API correta de hard-delete na
    // kdbxweb: quando toGroup é undefined, kdbx.move() chama
    // addDeletedObject() automaticamente, populando meta.deletedObjects
    // com tombstone.
    //
    // IMPORTANTE: kdbx.remove() NÃO é hard-delete quando
    // recycleBinEnabled. JSDoc da kdbxweb: "Depending on settings,
    // removes either to trash, or completely". Como o default é
    // recycleBinEnabled=true, remove() move para a Lixeira. Quando
    // entry JÁ está na Lixeira, vira no-op (splice + push no mesmo
    // array). Ver §21 do CLAUDE.md.
    for (const entry of originalEntries) {
      kdbx.move(entry, undefined);
    }

    const result = await saveVault(filePath, kdbx);
    if (!result.ok) {
      // Rollback in-memory completo (S31 fechou pendência §19 Bloco 3):
      //   1. Restaurar recycleBin.entries com cópia original via splice
      //      (preserva a REFERÊNCIA do array — não fazer reassign,
      //      Zustand/seletores podem depender da identidade do array).
      //   2. Restaurar parentGroup em cada entry (kdbx.move undefined
      //      setou parentGroup = undefined; reverter para recycleBin).
      //   3. Truncar kdbx.deletedObjects ao count pré-loop. Os
      //      tombstones adicionados nunca foram persistidos em disco
      //      (save falhou) — descartar in-memory é seguro.
      recycleBin.entries.splice(
        0,
        recycleBin.entries.length,
        ...originalEntries,
      );
      for (const entry of originalEntries) {
        entry.parentGroup = recycleBin;
      }
      kdbx.deletedObjects.length = tombstoneCountBefore;
      return { ok: false, error: result.error };
    }

    return {
      ok: true,
      durationMs: result.durationMs,
      entriesDeleted: count,
    };
  } catch (e) {
    // Rollback defensivo no caminho de exceção. Usa splice ao invés
    // de push porque é idempotente em qualquer ponto do loop:
    //   - Exceção pré-snapshot: originalEntries vazio → splice no-op.
    //   - Exceção mid-loop: recycleBin.entries parcialmente vaziada
    //     → splice substitui pelo array completo original.
    //   - Exceção pós-loop: recycleBin.entries vazia → splice preenche.
    if (recycleBin && originalEntries.length > 0) {
      recycleBin.entries.splice(
        0,
        recycleBin.entries.length,
        ...originalEntries,
      );
      for (const entry of originalEntries) {
        entry.parentGroup = recycleBin;
      }
      kdbx.deletedObjects.length = tombstoneCountBefore;
    }
    return {
      ok: false,
      error: `Erro ao esvaziar Lixeira: ${describeError(e)}`,
    };
  }
}
