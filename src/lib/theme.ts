// Sistema de tema do Sec.Basis.
//
// Resolve a preferência efetiva (light/dark) a partir de:
//   1. Override manual do usuário (localStorage `sec-basis-theme`)
//   2. Caso contrário, segue `prefers-color-scheme` do SO
//
// A preferência efetiva é aplicada como classe `.dark` no <html> (convenção
// do shadcn/ui, que será adicionado na próxima tarefa).

const STORAGE_KEY = "sec-basis-theme";

export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

function readStoredPreference(): ThemePreference {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === "light" || raw === "dark" || raw === "system") return raw;
  } catch {
    // localStorage pode falhar em modos privados restritos — degrada para system.
  }
  return "system";
}

function systemPrefersDark(): boolean {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

function resolveTheme(pref: ThemePreference): ResolvedTheme {
  if (pref === "system") return systemPrefersDark() ? "dark" : "light";
  return pref;
}

function applyTheme(theme: ResolvedTheme): void {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  // Atributo extra para CSS condicional eventual (ex.: tooltips de meta tags).
  root.setAttribute("data-theme", theme);
}

let mediaQuery: MediaQueryList | null = null;
let mediaQueryListener: ((e: MediaQueryListEvent) => void) | null = null;

function setupSystemListener(pref: ThemePreference): void {
  if (mediaQuery && mediaQueryListener) {
    mediaQuery.removeEventListener("change", mediaQueryListener);
    mediaQueryListener = null;
  }
  if (pref !== "system") return;

  mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  mediaQueryListener = (e: MediaQueryListEvent) => {
    applyTheme(e.matches ? "dark" : "light");
  };
  mediaQuery.addEventListener("change", mediaQueryListener);
}

/**
 * Inicializa o tema. Deve ser chamada UMA vez antes do React montar.
 *
 * Para evitar flash of incorrect theme (FOUT/FOIT do tema), há também um
 * script inline no `index.html` que aplica `.dark` antes do JS principal
 * carregar.
 */
export function initTheme(): void {
  const pref = readStoredPreference();
  applyTheme(resolveTheme(pref));
  setupSystemListener(pref);
}

/** Persiste e aplica nova preferência de tema. */
export function setTheme(pref: ThemePreference): void {
  try {
    if (pref === "system") {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, pref);
    }
  } catch {
    // Falha de persistência não impede aplicação no run atual.
  }
  applyTheme(resolveTheme(pref));
  setupSystemListener(pref);
}

/** Lê a preferência atual (sem resolver). */
export function getThemePreference(): ThemePreference {
  return readStoredPreference();
}

/** Lê o tema efetivamente aplicado (light ou dark). */
export function getResolvedTheme(): ResolvedTheme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}
