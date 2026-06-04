import { copyToClipboardWithAutoClear } from "./clipboard";
import { openExternalSafe } from "./external";

interface OpenUrlAndCopyPasswordDeps {
  openUrl: (url: string) => Promise<boolean>;
  copyPassword: (text: string, label?: string) => Promise<void>;
}

const defaultDeps: OpenUrlAndCopyPasswordDeps = {
  openUrl: openExternalSafe,
  copyPassword: copyToClipboardWithAutoClear,
};

export async function copySecretWithAutoClear(
  text: string,
  label = "Copiado",
): Promise<void> {
  return copyToClipboardWithAutoClear(text, label);
}

export async function openEntryUrl(url: string): Promise<boolean> {
  if (!url) return false;
  return openExternalSafe(url);
}

export async function openUrlAndCopyPassword(
  url: string,
  password: string,
  deps: OpenUrlAndCopyPasswordDeps = defaultDeps,
): Promise<boolean> {
  if (!url || !password) return false;

  const opened = await deps.openUrl(url);
  if (!opened) return false;

  await deps.copyPassword(password, "Senha copiada para usar no site");
  return true;
}
