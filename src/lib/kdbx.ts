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
