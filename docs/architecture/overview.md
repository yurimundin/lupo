# Arquitetura do Lupo

## Produto

Lupo é um gerenciador de senhas desktop para Windows, open source, leve,
offline-first e compatível com o formato `.kdbx` do KeePass.

## Stack

| Camada | Tecnologia |
| --- | --- |
| Shell desktop | Tauri v2 |
| UI | React 19 + TypeScript strict |
| Bundler | Vite |
| Estilo | Tailwind CSS 4 |
| Componentes | shadcn/ui |
| Cofre | kdbxweb |
| Estado | Zustand |
| Ícones | lucide-react |

## Camadas de frontend

- `src/components`: componentes visuais e telas.
- `src/hooks`: controllers de fluxo e hooks de interação.
- `src/lib`: lógica de domínio, KDBX e funções puras.
- `src/services`: integrações com efeitos colaterais, Tauri, clipboard e ações sensíveis.
- `src/stores`: Zustand stores e seletores.

## Memória histórica

O histórico completo de decisões e sessões foi movido para
[`docs/architecture/project-memory.md`](project-memory.md). Ele é mantido como
arquivo de auditoria, não como ponto de entrada principal.
