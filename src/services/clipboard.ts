import { toast } from "sonner";

import { useSettingsStore } from "@/stores/settings";

/**
 * Copia texto para o clipboard e limpa depois do tempo configurado.
 * Se a leitura do clipboard falhar, limpa incondicionalmente por segurança.
 */
export async function copyToClipboardWithAutoClear(
  text: string,
  label = "Copiado",
): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch (err) {
    toast.error("Falha ao copiar para a área de transferência.");
    console.error("[clipboard] writeText falhou:", err);
    return;
  }

  const ms = useSettingsStore.getState().clipboardAutoClearMs;
  if (ms <= 0) {
    toast.success(label);
    return;
  }

  const seconds = Math.round(ms / 1000);
  toast.success(`${label}. Será limpo em ${seconds}s.`);

  window.setTimeout(async () => {
    try {
      const current = await navigator.clipboard.readText();
      if (current === text) {
        await navigator.clipboard.writeText("");
      }
    } catch {
      try {
        await navigator.clipboard.writeText("");
      } catch (writeErr) {
        console.error("[clipboard] auto-clear falhou:", writeErr);
      }
    }
  }, ms);
}
