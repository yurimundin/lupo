// Modal "Sobre o Lupo" — informações estáticas do produto.
//
// Acessível pelo botão Info no header do cofre. Conteúdo: logo, nome,
// versão (via Tauri), descrição curta, links externos para site/repo
// (com licença inline), botão Fechar.
//
// Sem chamadas de rede — alinhado com o princípio offline-first. Os
// links externos abrem no navegador padrão do sistema via
// `openExternalSafe` (`src/lib/external.ts`, S21 — antes era função
// local duplicada com EntryDetail.tsx).

import { ArrowUpRight } from "lucide-react";

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
import { openExternalSafe } from "@/lib/external";

interface AboutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SITE_URL = "https://lupo.basis.app.br";
const REPO_URL = "https://github.com/yurimundin/lupo";
const ARGO_URL = "https://argo.basis.app.br";

export function AboutDialog({ open, onOpenChange }: AboutDialogProps) {
  const version = useAppVersion();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader className="items-center text-center">
          <img
            src="/lupo-appicon-steel.svg"
            alt="Lupo logo"
            className="w-16 h-16 mb-2"
          />
          <DialogTitle className="text-2xl">Lupo</DialogTitle>
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
                lupo.basis.app.br
              </button>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Código-fonte</span>
              <button
                type="button"
                onClick={() => void openExternalSafe(REPO_URL)}
                className="text-primary hover:underline"
              >
                github.com/yurimundin/lupo
              </button>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Licença</span>
              <span>MIT</span>
            </div>
          </div>

          <div className="rounded-md border border-border bg-muted/40 px-3 py-2.5 text-sm">
            <p className="font-medium text-foreground">
              Precisa gerenciar senhas em equipe?
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Conheça o Argo. Trial de 30 dias sem cartão, cancele quando quiser.
            </p>
            <button
              type="button"
              onClick={() => void openExternalSafe(ARGO_URL)}
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              Conhecer Argo
              <ArrowUpRight className="size-3" />
            </button>
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
