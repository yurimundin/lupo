// Modal "Sobre o Sec.Basis" — informações estáticas do produto.
//
// Acessível pelo botão Info no header do cofre. Conteúdo: logo, nome,
// versão (via Tauri), descrição curta, links externos para site/repo
// (com licença inline), botão Fechar.
//
// Sem chamadas de rede — alinhado com o princípio offline-first. Os
// links externos abrem no navegador padrão do sistema via plugin-shell
// (mesmo padrão de EntryDetail.tsx para abrir URLs de entries).

import { open as openExternal } from "@tauri-apps/plugin-shell";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAppVersion } from "@/hooks/useAppVersion";

interface AboutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SITE_URL = "https://sec.basis.app.br";
const REPO_URL = "https://github.com/yurimundin/secbasis";

export function AboutDialog({ open, onOpenChange }: AboutDialogProps) {
  const version = useAppVersion();

  async function openExternalSafe(url: string) {
    try {
      await openExternal(url);
    } catch (err) {
      console.error("[shell.open] falhou:", err);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader className="items-center text-center">
          <img
            src="/secbasis-logo.png"
            alt="Sec.Basis logo"
            className="w-16 h-16 mb-2"
          />
          <DialogTitle className="text-2xl">Sec.Basis</DialogTitle>
          <DialogDescription className="text-sm">
            Versão {version || "..."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-sm text-center text-muted-foreground">
            Gerenciador de senhas open source compatível com KeePass.
          </p>

          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Site oficial</span>
              <button
                type="button"
                onClick={() => void openExternalSafe(SITE_URL)}
                className="text-primary hover:underline"
              >
                sec.basis.app.br
              </button>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Código-fonte</span>
              <button
                type="button"
                onClick={() => void openExternalSafe(REPO_URL)}
                className="text-primary hover:underline"
              >
                github.com/yurimundin/secbasis
              </button>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Licença</span>
              <span>MIT</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
