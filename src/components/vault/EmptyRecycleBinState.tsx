// Estado vazio renderizado na EntryList quando o grupo Lixeira está
// selecionado mas não tem entries.
//
// Padrão UX inspirado em Gmail/Notion: ilustração + mensagem educativa.
// Mensagem reforça que (a) entries movidas podem ser restauradas, e
// (b) esvaziar é permanente. Ajuda o usuário que abriu a Lixeira por
// curiosidade a entender o ciclo de vida sem ter que ir na documentação.

import { Trash2 } from "lucide-react";

export function EmptyRecycleBinState() {
  return (
    <div className="flex flex-col items-center justify-center h-full px-8 py-16 text-center">
      <Trash2
        className="text-muted-foreground/30 mb-4"
        size={64}
        strokeWidth={1.5}
        aria-hidden="true"
      />
      <h3 className="text-lg font-medium text-foreground mb-2">
        Lixeira vazia
      </h3>
      <p className="text-sm text-muted-foreground max-w-md">
        Entradas movidas para a Lixeira podem ser restauradas. Ao esvaziar
        a Lixeira, todas as entradas são apagadas permanentemente.
      </p>
    </div>
  );
}
