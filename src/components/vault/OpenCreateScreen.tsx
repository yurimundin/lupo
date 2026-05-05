// Tela inicial do Sec.Basis: tabs para abrir um cofre existente ou
// criar um novo. Substitui a UI temporária de validação de tema enquanto
// a Sessão 3 não constrói a tela de cofre aberto.

import { Lock } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { CreateVaultTab } from "./CreateVaultTab";
import { OpenVaultTab } from "./OpenVaultTab";

// Sem props: a navegação para `VaultLayout` é decidida em `App.tsx` a
// partir do estado de `useVaultStore` (que os tabs populam diretamente).
export function OpenCreateScreen() {
  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
      <div className="w-full max-w-[440px] space-y-6">
        <header className="flex items-center justify-center gap-2">
          <Lock className="text-primary" />
          <h1 className="text-2xl font-semibold tracking-tight">Sec.Basis</h1>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>Cofre de senhas</CardTitle>
            <CardDescription>
              Abra um cofre existente ou crie um novo. Tudo permanece
              localmente no seu computador.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="open" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4">
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

        <p className="text-center text-xs text-muted-foreground">
          Compatível com KeePass / KeePassXC · Offline-first
        </p>
      </div>
    </div>
  );
}
