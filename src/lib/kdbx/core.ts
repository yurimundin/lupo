import { invoke } from "@tauri-apps/api/core";
import * as kdbxweb from "kdbxweb";

import { deriveArgon2Key, type Argon2Variant } from "../argon2";

import {
  describeError,
  readFileBytes,
  toArrayBuffer,
  translateKdbxError,
} from "./shared";

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
    throw new Error(`Não foi possível ler o arquivo: ${describeError(e)}`, {
      cause: e,
    });
  }

  let keyFileBytes: Uint8Array | null = null;
  if (keyFilePath) {
    try {
      keyFileBytes = await readFileBytes(keyFilePath);
    } catch (e) {
      throw new Error(`Não foi possível ler o key file: ${describeError(e)}`, {
        cause: e,
      });
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
    throw new Error(translateKdbxError(e, { hasKeyFile: keyFilePath !== null }), {
      cause: e,
    });
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
