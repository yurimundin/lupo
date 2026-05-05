import React from "react";
import ReactDOM from "react-dom/client";

// Fonte Geologica (variable, axis weight). Carregada via @fontsource para
// satisfazer o princípio offline-first (NÃO usar Google Fonts CDN).
import "@fontsource-variable/geologica";

import App from "./App";
import "./App.css";
import { initKdbxweb } from "./lib/kdbx";
import { initTheme } from "./lib/theme";

// Resolve e aplica o tema (light/dark) antes do React montar. O index.html
// já fez um pré-aplique síncrono no <head> para evitar flicker; este passo
// também registra o listener para mudanças de prefers-color-scheme.
initTheme();

// Registra o adaptador Argon2 nativo (Rust via Tauri) na kdbxweb.
initKdbxweb();

// Dispara o smoke test do pipeline cripto. Fire-and-forget para não atrasar
// o render.
//
// - Em DEV (`tauri dev`): sempre roda. Resultados aparecem no console do
//   webview e no stdout do `tauri dev`.
// - Em release: roda apenas se a env var `VITE_RUN_SMOKE=1` foi passada
//   no build. Útil pra benchmark de Argon2 em release sem precisar de
//   código de bench dedicado. Resultados aparecem no console do DevTools
//   (se habilitado) e no arquivo `%TEMP%/sec-basis-bench.log` (gravado
//   pelo comando Tauri `log_smoke_result`).
const SHOULD_RUN_SMOKE =
  import.meta.env.DEV || import.meta.env.VITE_RUN_SMOKE === "1";
if (SHOULD_RUN_SMOKE) {
  void import("./lib/__tests__/kdbx-smoke").then(({ runKdbxSmokeTest }) =>
    runKdbxSmokeTest(),
  );
}

// =============================================================================
// TODO REMOVER NA TAREFA 6 — smoke test manual do saveVault
// =============================================================================
// Expõe `window.__testSaveVault()` para teste manual via DevTools console
// enquanto o botão Salvar do EntryEditor ainda não está conectado. NÃO
// dispara automaticamente — o usuário humano chama no console quando
// quiser validar o round-trip de save com backup atômico.
//
// Quando a Tarefa 6 conectar o save real ao botão "Salvar" do
// EntryEditor, este bloco INTEIRO deve ser removido.
if (import.meta.env.DEV) {
  (
    window as unknown as { __testSaveVault: () => Promise<void> }
  ).__testSaveVault = async () => {
    const { useVaultStore } = await import("./stores/vault");
    const state = useVaultStore.getState();
    if (!state.kdbx || !state.lastFilePath) {
      console.error(
        "[__testSaveVault] Nenhum cofre aberto. Abra um cofre primeiro.",
      );
      return;
    }
    const { saveVault } = await import("./lib/kdbx");
    console.log(
      `[__testSaveVault] Salvando "${state.kdbx.meta.name ?? "(sem nome)"}" → ${state.lastFilePath}`,
    );
    const result = await saveVault(state.lastFilePath, state.kdbx);
    if (result.ok) {
      console.log(
        `[__testSaveVault] ✅ Save bem-sucedido em ${result.durationMs}ms`,
      );
      console.log(
        "[__testSaveVault] Próximo passo: abrir o .kdbx e .kdbx.bak fora do app pra validar manualmente",
      );
    } else {
      console.error(`[__testSaveVault] ❌ Falhou: ${result.error}`);
    }
  };
  console.log("[DEV] Smoke test disponível: window.__testSaveVault()");
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
