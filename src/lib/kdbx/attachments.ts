import type { Kdbx, KdbxEntry } from "kdbxweb";

import { saveVault } from "./persistence";
import { describeError, toArrayBuffer } from "./shared";

type EntryBinary = KdbxEntry["binaries"] extends Map<string, infer Binary>
  ? Binary
  : never;

type EntryBinaryWithHash = Extract<EntryBinary, { hash: string }>;

export interface EntryAttachmentInfo {
  name: string;
  sizeBytes: number | null;
}

export type AddEntryAttachmentResult =
  | { ok: true; durationMs: number; attachmentName: string }
  | { ok: false; error: string };

export type RemoveEntryAttachmentResult =
  | { ok: true; durationMs: number }
  | { ok: false; error: string };

export function getEntryAttachments(entry: KdbxEntry): EntryAttachmentInfo[] {
  return [...entry.binaries.entries()]
    .map(([name, binary]) => ({
      name,
      sizeBytes: getBinarySize(unwrapEntryBinary(binary)),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

export function getEntryAttachmentBytes(
  entry: KdbxEntry,
  attachmentName: string,
): Uint8Array | null {
  const binary = entry.binaries.get(attachmentName);
  if (!binary) return null;
  return getBinaryBytes(unwrapEntryBinary(binary));
}

export async function addEntryAttachmentInVault(
  filePath: string,
  kdbx: Kdbx,
  entry: KdbxEntry,
  attachmentName: string,
  bytes: Uint8Array,
): Promise<AddEntryAttachmentResult> {
  if (!filePath || !kdbx || !entry) {
    return { ok: false, error: "Estado inválido para anexar arquivo." };
  }
  if (!bytes || bytes.byteLength === 0) {
    return { ok: false, error: "Arquivo vazio não foi anexado." };
  }

  const normalizedName = normalizeAttachmentName(attachmentName);
  const uniqueName = makeUniqueAttachmentName(entry, normalizedName);
  const snapshot = new Map(entry.binaries);

  try {
    const binary = await kdbx.createBinary(toArrayBuffer(bytes));
    entry.binaries.set(uniqueName, binary);
    entry.times.update();

    const result = await saveVault(filePath, kdbx);
    if (!result.ok) {
      restoreBinariesSnapshot(entry, snapshot);
      return { ok: false, error: result.error };
    }

    return {
      ok: true,
      durationMs: result.durationMs,
      attachmentName: uniqueName,
    };
  } catch (e) {
    restoreBinariesSnapshot(entry, snapshot);
    return {
      ok: false,
      error: `Erro ao anexar arquivo: ${describeError(e)}`,
    };
  }
}

export async function removeEntryAttachmentInVault(
  filePath: string,
  kdbx: Kdbx,
  entry: KdbxEntry,
  attachmentName: string,
): Promise<RemoveEntryAttachmentResult> {
  if (!filePath || !kdbx || !entry) {
    return { ok: false, error: "Estado inválido para remover anexo." };
  }
  if (!entry.binaries.has(attachmentName)) {
    return { ok: false, error: "Anexo não encontrado." };
  }

  const snapshot = new Map(entry.binaries);

  try {
    entry.binaries.delete(attachmentName);
    entry.times.update();

    const result = await saveVault(filePath, kdbx);
    if (!result.ok) {
      restoreBinariesSnapshot(entry, snapshot);
      return { ok: false, error: result.error };
    }

    return { ok: true, durationMs: result.durationMs };
  } catch (e) {
    restoreBinariesSnapshot(entry, snapshot);
    return {
      ok: false,
      error: `Erro ao remover anexo: ${describeError(e)}`,
    };
  }
}

function restoreBinariesSnapshot(
  entry: KdbxEntry,
  snapshot: Map<string, EntryBinary>,
): void {
  entry.binaries.clear();
  for (const [name, binary] of snapshot) {
    entry.binaries.set(name, binary);
  }
}

function makeUniqueAttachmentName(
  entry: KdbxEntry,
  attachmentName: string,
): string {
  if (!entry.binaries.has(attachmentName)) return attachmentName;

  const { base, extension } = splitNameAndExtension(attachmentName);
  let counter = 2;
  let candidate = `${base} (${counter})${extension}`;

  while (entry.binaries.has(candidate)) {
    counter += 1;
    candidate = `${base} (${counter})${extension}`;
  }

  return candidate;
}

function splitNameAndExtension(name: string): {
  base: string;
  extension: string;
} {
  const lastDot = name.lastIndexOf(".");
  if (lastDot <= 0 || lastDot === name.length - 1) {
    return { base: name, extension: "" };
  }

  return {
    base: name.slice(0, lastDot),
    extension: name.slice(lastDot),
  };
}

function normalizeAttachmentName(name: string): string {
  const trimmed = name.trim();
  return trimmed.length > 0 ? trimmed : "anexo";
}

function unwrapEntryBinary(binary: EntryBinary): unknown {
  if (isEntryBinaryWithHash(binary)) return binary.value;
  return binary;
}

function isEntryBinaryWithHash(
  binary: EntryBinary,
): binary is EntryBinaryWithHash {
  return typeof binary === "object" && binary !== null && "hash" in binary;
}

function getBinarySize(value: unknown): number | null {
  if (value instanceof ArrayBuffer) return value.byteLength;
  if (ArrayBuffer.isView(value)) return value.byteLength;
  if (isProtectedValue(value)) return value.getBinary().byteLength;
  return null;
}

function getBinaryBytes(value: unknown): Uint8Array | null {
  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value);
  }
  if (value instanceof Uint8Array) {
    return value;
  }
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  if (isProtectedValue(value)) {
    return value.getBinary();
  }
  return null;
}

function isProtectedValue(
  value: unknown,
): value is { getBinary: () => Uint8Array } {
  return (
    typeof value === "object" &&
    value !== null &&
    "getBinary" in value &&
    typeof value.getBinary === "function"
  );
}
