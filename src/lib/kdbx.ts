// Wrapper sobre a biblioteca kdbxweb.
//
// Centraliza:
//   - Inicialização (injeção do Argon2 nativo Rust em vez do default da lib).
//   - Operações de cofre (criar, abrir, salvar) com parâmetros KDF seguros.
//   - I/O de arquivo via comandos Tauri (com backup automático no save).
//
// Mantém o resto do app desacoplado da API pública da kdbxweb.

import { invoke } from "@tauri-apps/api/core";
import * as kdbxweb from "kdbxweb";

import type { Kdbx, KdbxEntry, KdbxGroup } from "kdbxweb";

import { deriveArgon2Key, type Argon2Variant } from "./argon2";

let initialized = false;

/**
 * Configura a kdbxweb para usar o Argon2 nativo (Rust via Tauri).
 *
 * Deve ser chamada uma única vez antes de qualquer operação de cofre.
 * Idempotente: chamadas subsequentes são ignoradas.
 */
export function initKdbxweb(): void {
  if (initialized) return;

  kdbxweb.CryptoEngine.setArgon2Impl(
    async (
      password: ArrayBuffer,
      salt: ArrayBuffer,
      memory: number,
      iterations: number,
      length: number,
      parallelism: number,
      type: number,
      version: number,
    ): Promise<ArrayBuffer> => {
      // kdbxweb usa: 0 = Argon2d, 2 = Argon2id (Argon2i não é usado no KDBX).
      const variant: Argon2Variant = type === 0 ? "argon2d" : "argon2id";
      if (version !== 0x10 && version !== 0x13) {
        throw new Error(
          `kdbx: versão Argon2 não suportada: 0x${version.toString(16)}`,
        );
      }

      const derived = await deriveArgon2Key({
        password: new Uint8Array(password),
        salt: new Uint8Array(salt),
        iterations,
        memoryKib: memory,
        parallelism,
        outputLen: length,
        version,
        variant,
      });

      // Devolve um ArrayBuffer "puro" — kdbxweb tipa o retorno assim, e
      // criar a partir do .buffer de um Uint8Array pode pegar offset/extent
      // diferentes do esperado. Copiamos pra evitar surpresas.
      const out = new ArrayBuffer(derived.byteLength);
      new Uint8Array(out).set(derived);
      return out;
    },
  );

  initialized = true;
}

/**
 * Parâmetros KDF de Argon2 alinhados ao padrão do KeePass 2.x para cofres
 * NOVOS. NÃO confiar no default da kdbxweb (`HeaderConst.DefaultKdfMemory`
 * = 1 MiB), que é dolorosamente fraco — a constante `DefaultKdfMemory` do
 * lib é só pra quem prioriza velocidade sobre segurança, totalmente fora
 * da nossa proposta.
 *
 * Usar `KDBX4_SECURE_KDF_PARAMS` em TODOS os caminhos que criem cofres
 * (UI principal, importação de outros gerenciadores, scripts de migração).
 * A centralização é proteção contra regressão se surgirem fluxos
 * secundários no futuro.
 *
 * Cofres ABERTOS (não criados) herdam os parâmetros do header do arquivo
 * original — `applySecureKdfParams` NÃO é chamada na abertura.
 */
export const KDBX4_SECURE_KDF_PARAMS = {
  memoryBytes: 64 * 1024 * 1024, // 64 MiB
  iterations: 2,
  parallelism: 2,
} as const;

/**
 * Aplica os parâmetros KDF seguros (`KDBX4_SECURE_KDF_PARAMS`) a um cofre
 * recém-criado. Use sempre antes do primeiro `save()` em cofres novos.
 */
function applySecureKdfParams(db: kdbxweb.Kdbx): void {
  // Argon2id é o variant moderno recomendado (KeePassXC default).
  db.setKdf(kdbxweb.Consts.KdfId.Argon2id);

  const params = db.header.kdfParameters;
  if (!params) {
    throw new Error("kdbx: kdfParameters indisponível após setKdf");
  }
  params.set(
    "M",
    kdbxweb.VarDictionary.ValueType.UInt64,
    kdbxweb.Int64.from(KDBX4_SECURE_KDF_PARAMS.memoryBytes),
  );
  params.set(
    "I",
    kdbxweb.VarDictionary.ValueType.UInt64,
    kdbxweb.Int64.from(KDBX4_SECURE_KDF_PARAMS.iterations),
  );
  params.set(
    "P",
    kdbxweb.VarDictionary.ValueType.UInt32,
    KDBX4_SECURE_KDF_PARAMS.parallelism,
  );
}

/** Versão do formato `.keyx` gerado: 2 = XML KeePassXC moderno. */
export const GENERATED_KEY_FILE_VERSION = 2;

/**
 * Cria um cofre KDBX4 novo em memória, já com KDF seguro aplicado.
 * Não persiste em disco — chame `writeNewVaultFile` para gravar a primeira
 * versão (não usar `saveVault` aqui: ele exige que o arquivo já exista).
 *
 * `keyFileBytes`: opcional. Se passado, esses bytes (formato `.keyx` v2 ou
 * arbitrário) compõem a chave junto com a senha-mestra.
 */
export async function createVault(
  name: string,
  password: string,
  keyFileBytes: Uint8Array | null = null,
): Promise<kdbxweb.Kdbx> {
  const credentials = new kdbxweb.Credentials(
    kdbxweb.ProtectedValue.fromString(password),
    keyFileBytes,
  );
  // O construtor expõe `ready` que resolve quando hashes assíncronos
  // (key file) terminaram de calcular.
  await credentials.ready;
  const db = kdbxweb.Kdbx.create(credentials, name);
  applySecureKdfParams(db);
  return db;
}

/**
 * Abre um cofre `.kdbx` lendo o arquivo do disco e desbloqueando com a
 * senha-mestra (e opcionalmente um key file). Lança erro com mensagem
 * amigável em PT-BR.
 */
export async function openVault(
  filePath: string,
  password: string,
  keyFilePath: string | null = null,
): Promise<kdbxweb.Kdbx> {
  let vaultBytes: Uint8Array;
  try {
    vaultBytes = await readFileBytes(filePath);
  } catch (e) {
    throw new Error(`Não foi possível ler o arquivo: ${describeError(e)}`);
  }

  let keyFileBytes: Uint8Array | null = null;
  if (keyFilePath) {
    try {
      keyFileBytes = await readFileBytes(keyFilePath);
    } catch (e) {
      throw new Error(`Não foi possível ler o key file: ${describeError(e)}`);
    }
  }

  const buffer = toArrayBuffer(vaultBytes);
  const credentials = new kdbxweb.Credentials(
    kdbxweb.ProtectedValue.fromString(password),
    keyFileBytes,
  );
  await credentials.ready;

  try {
    return await kdbxweb.Kdbx.load(buffer, credentials);
  } catch (e) {
    // Se o usuário forneceu key file e a abertura falhou, é provável que
    // o erro seja "InvalidKey" — indistinguível entre senha errada e key
    // file errado. Mensagem genérica unificada.
    throw new Error(translateKdbxError(e, { hasKeyFile: keyFilePath !== null }));
  }
}

/**
 * Gera um key file aleatório no formato `.keyx` v2 do KeePassXC e grava
 * no caminho indicado. NÃO sobrescreve sem backup — o
 * `write_file_with_backup` cuida disso.
 *
 * Retorna os bytes gerados para o chamador poder usá-los imediatamente
 * (sem reler do disco).
 */
export async function generateKeyFile(filePath: string): Promise<Uint8Array> {
  const keyFileBytes = await kdbxweb.Credentials.createRandomKeyFile(
    GENERATED_KEY_FILE_VERSION,
  );
  await invoke("write_file_with_backup", {
    path: filePath,
    bytes: Array.from(keyFileBytes),
  });
  return keyFileBytes;
}

/**
 * Grava a PRIMEIRA versão de um cofre recém-criado em disco.
 *
 * Diferença pra `saveVault` (gravação subsequente): este caminho é usado
 * SOMENTE quando o `.kdbx` ainda não existe no filesystem (cenário de
 * "Criar cofre"). O comando `save_vault_with_backup` do backend exige
 * arquivo existente para validar magic bytes e gerar `.bak`, então não
 * pode ser usado aqui.
 *
 * Internamente usa o `write_file_with_backup` antigo, que faz `rename`
 * do arquivo anterior se existir (no caso da criação, normalmente não
 * existe — escreve direto).
 */
export async function writeNewVaultFile(
  filePath: string,
  db: kdbxweb.Kdbx,
): Promise<void> {
  const buffer = await db.save();
  const bytes = new Uint8Array(buffer);
  await invoke("write_file_with_backup", {
    path: filePath,
    bytes: Array.from(bytes),
  });
}

/** Resultado de `saveVault` — backend pode retornar duração ou erro. */
export type SaveResult =
  | { ok: true; durationMs: number }
  | { ok: false; error: string };

/**
 * Persiste mudanças em um cofre EXISTENTE no disco com backup atômico.
 *
 * Sequência (no backend Rust, ver `save_vault_with_backup` em
 * `src-tauri/src/lib.rs`):
 *   1. Valida que o `.kdbx` atual existe e tem magic bytes corretos.
 *   2. Escreve `.kdbx.bak` (sobrescreve antigo) com `fsync`.
 *   3. Escreve `.kdbx.tmp` (novo conteúdo) com `fsync`.
 *   4. Re-valida magic bytes do `.tmp`.
 *   5. `rename(.tmp → .kdbx)` — atômico em mesmo volume.
 *
 * Garantia: em qualquer falha, o `.kdbx` original permanece íntegro
 * (rename só acontece após validação completa do tmp).
 *
 * Retorna `{ ok: true, durationMs }` ou `{ ok: false, error }`. NÃO
 * lança — chamadores devem tratar via discriminated union.
 *
 * Nota técnica: bytes são serializados como `number[]` (não `Uint8Array`)
 * porque o IPC do Tauri serializa via JSON e `Uint8Array` vira objeto
 * com chaves numéricas em vez de array. `Array.from(uint8)` é o
 * caminho que funciona em ambos os lados.
 *
 * Nota técnica 2: `durationMs` vem do BACKEND (medido em volta do I/O
 * real), não de `performance.now()` do front. Mais preciso porque
 * exclui overhead de serialização IPC.
 */
export async function saveVault(
  filePath: string,
  kdbx: kdbxweb.Kdbx,
): Promise<SaveResult> {
  // Validação local (pré-IPC) — feedback rápido, sem touch no backend.
  if (!filePath || filePath.trim().length === 0) {
    return { ok: false, error: "Caminho do cofre vazio." };
  }
  if (!kdbx) {
    return { ok: false, error: "Cofre inválido (referência nula)." };
  }

  let vaultBytes: number[];
  try {
    const buffer = await kdbx.save();
    const uint8 = new Uint8Array(buffer);
    vaultBytes = Array.from(uint8);
  } catch (e) {
    return {
      ok: false,
      error: `Erro ao serializar cofre: ${describeError(e)}`,
    };
  }

  try {
    // Backend já entrega mensagens PT-BR no caminho de erro — apenas
    // repassamos. Em sucesso, retorna número (ms).
    const durationMs = await invoke<number>("save_vault_with_backup", {
      filePath,
      vaultBytes,
    });
    return { ok: true, durationMs };
  } catch (e) {
    return { ok: false, error: describeError(e) };
  }
}

/** Resultado de `moveEntryToRecycleBin` — backend pode retornar duração ou erro. */
export type DeleteResult =
  | { ok: true; durationMs: number }
  | { ok: false; error: string };

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
 * Trade-off em caso de erro de save: o `kdbx` em memória já teve as
 * entries removidas; o disco mantém o estado antigo. Mesmo padrão de
 * `moveEntryToRecycleBin` e `restoreEntryFromRecycleBin`. TODO Sessão
 * 6+: rollback in-memory.
 */
export async function emptyRecycleBin(
  filePath: string,
  kdbx: Kdbx,
): Promise<EmptyRecycleBinResult> {
  if (!filePath || !kdbx) {
    return { ok: false, error: "Estado inválido para esvaziar Lixeira." };
  }

  try {
    const recycleBinUuid = kdbx.meta.recycleBinUuid;
    if (!recycleBinUuid || recycleBinUuid.empty) {
      return { ok: false, error: "Cofre não tem Lixeira configurada." };
    }
    const recycleBin = kdbx.getGroup(recycleBinUuid);
    if (!recycleBin) {
      return { ok: false, error: "Grupo Lixeira não encontrado no cofre." };
    }

    // Snapshot ANTES de iterar — kdbx.remove muta o array in-place.
    const entriesToRemove = [...recycleBin.entries];
    const count = entriesToRemove.length;

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
    for (const entry of entriesToRemove) {
      kdbx.move(entry, undefined);
    }

    const result = await saveVault(filePath, kdbx);
    if (!result.ok) {
      return { ok: false, error: result.error };
    }

    return {
      ok: true,
      durationMs: result.durationMs,
      entriesDeleted: count,
    };
  } catch (e) {
    return {
      ok: false,
      error: `Erro ao esvaziar Lixeira: ${describeError(e)}`,
    };
  }
}

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

// ----- Helpers internos de I/O e erro ---------------------------------------

async function readFileBytes(filePath: string): Promise<Uint8Array> {
  const raw = await invoke<number[] | Uint8Array>("read_file_bytes", {
    path: filePath,
  });
  return raw instanceof Uint8Array ? raw : new Uint8Array(raw);
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  );
}

function describeError(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  return String(e);
}

/** Traduz erros conhecidos da kdbxweb para mensagens amigáveis em PT-BR. */
function translateKdbxError(
  e: unknown,
  context: { hasKeyFile: boolean } = { hasKeyFile: false },
): string {
  const raw = describeError(e);

  if (/InvalidKey/i.test(raw) || /credentials/i.test(raw)) {
    return context.hasKeyFile
      ? "Senha mestra ou key file incorretos. Verifique e tente novamente."
      : "Senha mestra incorreta. Tente novamente.";
  }
  if (/BadSignature/i.test(raw) || /not a kdbx/i.test(raw)) {
    return "O arquivo não parece ser um cofre .kdbx válido.";
  }
  if (/InvalidVersion/i.test(raw) || /unsupported version/i.test(raw)) {
    return "Versão de cofre não suportada (este app trabalha com KDBX4).";
  }
  if (/FileCorrupt/i.test(raw) || /corrupt/i.test(raw)) {
    return "O arquivo do cofre parece estar corrompido.";
  }
  return `Não foi possível abrir o cofre: ${raw}`;
}
