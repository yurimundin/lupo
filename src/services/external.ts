import { openUrl } from "@tauri-apps/plugin-opener";

/**
 * Abre URL externa no navegador padrão do sistema.
 * Aceita apenas protocolos externos comuns.
 */
export async function openExternalSafe(url: string): Promise<boolean> {
  if (!isAllowedExternalUrl(url)) {
    console.warn("[opener.openUrl] URL externa bloqueada:", url);
    return false;
  }

  try {
    await openUrl(url);
    return true;
  } catch (err) {
    console.error("[opener.openUrl] falhou:", err);
    return false;
  }
}

function isAllowedExternalUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return ["http:", "https:", "mailto:", "tel:"].includes(parsed.protocol);
  } catch {
    return false;
  }
}
