// Footer de branding na sidebar do vault. Texto discreto que linka
// para o site oficial do Lupo (parte da família BasisApp).
//
// Sessão 21: posicionado no fundo da `<aside>` da `GroupSidebar`.
// O posicionamento é responsabilidade do `GroupSidebar`: o `<aside>`
// usa `flex flex-col h-full`, o wrapper que envolve a árvore de
// grupos é `flex-1` (consome o espaço disponível), e este componente
// fica como último filho — naturalmente empurrado para o fundo.
// Renderiza apenas quando o vault está aberto (tree não-vazio).

import { openExternalSafe } from "@/services/external";

export function PoweredByBasis() {
  return (
    <button
      type="button"
      onClick={() => void openExternalSafe("https://lupo.basis.app.br")}
      className="w-full px-3 py-2 text-left text-xs text-muted-foreground hover:text-foreground transition-colors"
      aria-label="Visitar lupo.basis.app.br"
    >
      Powered by <span className="font-medium">BasisApp</span>
    </button>
  );
}
