// Banner informativo que aparece UMA VEZ por cofre (com key file) na
// abertura. Persiste em `settings.seenKeyFileBanner` quando o usuário
// fecha. "Saber mais" abre Dialog com boas práticas detalhadas.

import { Key, X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSettingsStore } from "@/stores/settings";
import { useVaultStore } from "@/stores/vault";

export function KeyFileBanner() {
  const filePath = useVaultStore((s) => s.filePath);
  const lastKeyFilePath = useVaultStore((s) => s.lastKeyFilePath);
  const seenMap = useSettingsStore((s) => s.seenKeyFileBanner);
  const markSeen = useSettingsStore((s) => s.markKeyFileBannerSeen);
  const [openDialog, setOpenDialog] = useState(false);

  if (!filePath || !lastKeyFilePath) return null;
  if (seenMap[filePath]) return null;

  return (
    <>
      <div className="bg-brand-soft px-4 py-2.5 flex items-center gap-3 border-b border-border">
        <Key className="size-4 text-primary shrink-0" />
        <p className="flex-1 text-sm">
          🔑 Este cofre usa um key file. Ele é parte da chave de
          descriptografia — sem ele, ninguém abre o cofre, nem você.
          Mantenha-o em local seguro e com backup.
        </p>
        <Button
          variant="link"
          size="sm"
          className="h-auto p-0"
          onClick={() => setOpenDialog(true)}
        >
          Saber mais
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => markSeen(filePath)}
          title="Não mostrar mais para este cofre"
        >
          <X />
        </Button>
      </div>

      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Sobre key files</DialogTitle>
            <DialogDescription>
              Boas práticas para guardar e fazer backup do seu key file.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <section>
              <h3 className="font-semibold mb-1">O que é um key file</h3>
              <p className="text-muted-foreground">
                Um arquivo (geralmente <code>.keyx</code>) que contém bytes
                aleatórios usados junto com sua senha mestra para gerar a
                chave que descriptografa o cofre. É algo que você TEM,
                complementando algo que você SABE (a senha). Aumenta
                significativamente a segurança contra ataques de força bruta
                na senha.
              </p>
            </section>
            <section>
              <h3 className="font-semibold mb-1">Onde guardar</h3>
              <ul className="list-disc list-inside text-muted-foreground space-y-1">
                <li>
                  Em outro dispositivo (pen drive dedicado, cartão SD em
                  local seguro).
                </li>
                <li>
                  Em pasta sincronizada que você confia (OneDrive/Drive/
                  Dropbox), porém <strong>não na mesma pasta do cofre</strong>{" "}
                  — se um for vazado, o outro também é.
                </li>
                <li>
                  Em gerenciador de segredos corporativo (1Password Teams,
                  AWS Secrets, etc.) para uso profissional.
                </li>
              </ul>
            </section>
            <section>
              <h3 className="font-semibold mb-1">Como fazer backup</h3>
              <ul className="list-disc list-inside text-muted-foreground space-y-1">
                <li>
                  Pelo menos uma cópia em mídia física (pen drive em
                  gaveta).
                </li>
                <li>
                  Pelo menos uma cópia em local geograficamente diferente
                  (casa de família, cofre de banco, serviço de
                  armazenamento).
                </li>
                <li>
                  Teste seus backups: tente abrir o cofre usando o backup
                  uma vez por ano.
                </li>
              </ul>
            </section>
            <section>
              <h3 className="font-semibold mb-1">
                O que acontece se eu perder o key file
              </h3>
              <p className="text-muted-foreground">
                <strong>O cofre é perdido.</strong> Não temos como recuperá-lo
                — a Lupo não armazena nenhuma cópia do key file, e o
                conteúdo é cifrado de forma que mesmo nós não conseguiríamos
                descriptografar. Se este risco te assusta, considere usar o
                cofre apenas com senha (sem key file).
              </p>
            </section>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
