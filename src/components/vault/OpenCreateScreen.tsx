// Tela inicial do Sec.Basis — abrir cofre existente OU criar novo.
// Renderizada quando NÃO há cofre carregado e NÃO há `lastFilePath`
// lembrado (ver switch em App.tsx).
//
// Sessão 8: redesign visual com logo Sec.Basis 96px no header e
// sistema de espaçamento explícito (gap-4/6/8). Estrutura lógica
// (Card + Tabs + dois sub-componentes OpenVaultTab/CreateVaultTab)
// preservada — só o wrapper foi reorganizado.

import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { CreateVaultTab } from "./CreateVaultTab";
import { OpenVaultTab } from "./OpenVaultTab";

export function OpenCreateScreen() {
  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
      <div className="w-full max-w-[460px] flex flex-col items-center gap-8">
        <header className="flex flex-col items-center gap-4">
          <img
            src="/secbasis-logo.png"
            alt="Sec.Basis logo"
            className="h-24 w-24"
          />
          <div className="text-center">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Sec.Basis
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Gerenciador de senhas offline
            </p>
          </div>
        </header>

        <Card className="w-full">
          <CardContent className="p-8">
            <Tabs defaultValue="open" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="open">Abrir cofre</TabsTrigger>
                <TabsTrigger value="create">Criar cofre</TabsTrigger>
              </TabsList>
              <TabsContent value="open">
                <OpenVaultTab />
              </TabsContent>
              <TabsContent value="create">
                <CreateVaultTab />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground text-center">
          Compatível com KeePass / KeePassXC · Offline-first
        </p>
      </div>
    </div>
  );
}
