// Botão de toggle de tema (light ↔ dark) no `VaultHeader`. Persiste a
// preferência via `setTheme()` em `lib/theme.ts` (localStorage chave
// `lupo-theme`). Toggle binário: ignora a opção "system" — uma vez
// que o usuário clica, fica explicit (atende UX do mockup S20).
//
// Inicialização: lê o tema EFETIVAMENTE aplicado no `<html>` (resolved),
// não a preferência salva — assim mostra o ícone correto mesmo quando a
// preferência é "system" e o sistema está em dark.

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { getResolvedTheme, setTheme } from "@/lib/theme";

export function ThemeToggle() {
  const [isDark, setIsDark] = useState<boolean>(() => getResolvedTheme() === "dark");

  // Sync com mudanças externas (preferência "system" + listener
  // matchMedia em theme.ts pode mudar `.dark` sem este botão saber).
  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver(() => {
      setIsDark(root.classList.contains("dark"));
    });
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  function toggle() {
    const next = isDark ? "light" : "dark";
    setTheme(next);
    setIsDark(next === "dark");
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label={isDark ? "Mudar para tema claro" : "Mudar para tema escuro"}
      title={isDark ? "Tema claro" : "Tema escuro"}
    >
      {isDark ? <Sun /> : <Moon />}
    </Button>
  );
}
