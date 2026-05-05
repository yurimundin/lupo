// Cópia para clipboard com auto-clear após `clipboardAutoClearMs`
// (configurado em `settings`).
//
// Padrão de comportamento:
// 1. Escreve no clipboard.
// 2. Mostra toast informando o tempo de auto-clear.
// 3. Após o timeout, lê o clipboard atual:
//    - Se ainda contém o texto que escrevemos, sobrescreve com "".
//    - Se mudou (usuário copiou outra coisa), NÃO mexe.
// 4. Se a leitura do clipboard for negada por permissão, fallback é
//    LIMPAR INCONDICIONALMENTE — preferir segurança a UX. Isso afeta o
//    caso (improvável) de o usuário ter copiado outra coisa nesse meio
//    tempo. Documentado no CLAUDE.md.

import { toast } from "sonner";

import { useSettingsStore } from "@/stores/settings";

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
  const seconds = Math.round(ms / 1000);
  toast.success(`${label}. Será limpo em ${seconds}s.`);

  window.setTimeout(async () => {
    try {
      const current = await navigator.clipboard.readText();
      if (current === text) {
        await navigator.clipboard.writeText("");
      }
      // Se já mudou, deixa quieto — usuário copiou outra coisa.
    } catch {
      // Sem permissão de readText: por segurança, limpa incondicionalmente.
      try {
        await navigator.clipboard.writeText("");
      } catch (writeErr) {
        console.error("[clipboard] auto-clear falhou:", writeErr);
      }
    }
  }, ms);
}
