# Lupo — Contexto para o Codex

Este arquivo é o ponto de entrada curto para sessões do Codex neste repositório.
O histórico completo foi movido para
[`docs/architecture/project-memory.md`](docs/architecture/project-memory.md).

## Produto

Lupo é um gerenciador de senhas desktop para Windows, open source, leve,
offline-first e compatível com `.kdbx` do KeePass.

Site: <https://lupo.basis.app.br>
Repositório: <https://github.com/yurimundin/lupo>

## Stack

- Tauri v2
- React 19 + TypeScript strict
- Vite
- Tailwind CSS 4
- shadcn/ui
- kdbxweb
- Zustand
- lucide-react

Identifier do app: `br.app.basis.lupo`

## Regras inegociáveis

1. Nunca implementar criptografia própria; usar `kdbxweb`.
2. Offline-first absoluto: sem rede, sem telemetria e sem coleta.
3. Compatibilidade total com `.kdbx`.
4. Senhas em RAM devem usar `ProtectedValue` quando entram no modelo KDBX.
5. Auto-lock e auto-clear de clipboard são obrigatórios.
6. Backup automático antes de salvar.
7. TypeScript strict: sem `any`, sem `@ts-ignore`.
8. UI em português brasileiro; código em inglês; comentários em português.
9. Zero dependências desnecessárias.
10. Em caso de dúvida de segurança, parar e perguntar ao Yuri.

## Organização atual

- `src/components`: UI e telas.
- `src/hooks`: controllers de fluxo e hooks de interação.
- `src/lib`: domínio, KDBX e funções puras.
- `src/services`: Tauri, clipboard, URLs externas e ações sensíveis.
- `src/stores`: Zustand stores e seletores.
- `docs/architecture`: arquitetura e memória histórica.
- `docs/security`: decisões de segurança.
- `docs/release`: notas e processo de release.

## Referências

- Arquitetura: [`docs/architecture/overview.md`](docs/architecture/overview.md)
- Segurança: [`docs/security/decisions.md`](docs/security/decisions.md)
- Releases: [`docs/release`](docs/release)
- Memória completa: [`docs/architecture/project-memory.md`](docs/architecture/project-memory.md)

## Como rodar

```bash
npm install
npm run tauri dev
```
