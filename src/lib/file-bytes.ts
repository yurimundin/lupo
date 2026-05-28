import { invoke } from "@tauri-apps/api/core";

export async function readLocalFileBytes(filePath: string): Promise<Uint8Array> {
  const raw = await invoke<number[] | Uint8Array>("read_file_bytes", {
    path: filePath,
  });
  return raw instanceof Uint8Array ? raw : new Uint8Array(raw);
}

export async function writeLocalFileBytes(
  filePath: string,
  bytes: Uint8Array,
): Promise<void> {
  await invoke("write_file_with_backup", {
    path: filePath,
    bytes: Array.from(bytes),
  });
}

export function getFileNameFromPath(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/");
  const fileName = normalized.split("/").pop()?.trim();
  return fileName && fileName.length > 0 ? fileName : "anexo";
}
