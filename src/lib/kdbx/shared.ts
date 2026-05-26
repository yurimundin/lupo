import { invoke } from "@tauri-apps/api/core";

export async function readFileBytes(filePath: string): Promise<Uint8Array> {
  const raw = await invoke<number[] | Uint8Array>("read_file_bytes", {
    path: filePath,
  });
  return raw instanceof Uint8Array ? raw : new Uint8Array(raw);
}

export function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  // Cópia explícita para um ArrayBuffer "puro". TS 6 distingue
  // ArrayBuffer de SharedArrayBuffer estritamente, e `bytes.buffer`
  // tem tipo união (`ArrayBufferLike`) — slice() preserva o union,
  // não atribuível a ArrayBuffer. Mesmo padrão usado em initKdbxweb.
  const out = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(out).set(bytes);
  return out;
}

export function describeError(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  return String(e);
}

/** Traduz erros conhecidos da kdbxweb para mensagens amigáveis em PT-BR. */
export function translateKdbxError(
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

