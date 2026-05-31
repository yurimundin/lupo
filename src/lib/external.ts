// Helper para abrir URLs externas via Tauri opener plugin.
//
// Sessão 21: extraído como utilitário compartilhado depois que
// AboutDialog (S7) + EntryDetail (S4) + PoweredByBasis (S21) passaram
// a precisar do mesmo padrão try/catch + console.error.
//
// Hardening S32: migrou do plugin Shell para o plugin Opener, reduzindo a
// superfície exposta para abrir URLs externas sem habilitar comandos de shell.

import { openUrl } from "@tauri-apps/plugin-opener";

/**
 * Abre URL externa no navegador padrão do sistema.
 *
 * Não lança — em caso de falha, loga no console e segue silenciosamente.
 * Aceita apenas protocolos externos comuns. Caminhos locais, `file:`,
 * protocolos customizados e strings sem URL válida são bloqueados no front
 * antes de chegar ao Tauri.
 *
 * @example
 *   <button onClick={() => void openExternalSafe("https://example.com")}>
 *     Abrir
 *   </button>
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
