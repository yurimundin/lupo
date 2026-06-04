# Lupo — Contexto para Agentes

Este arquivo espelha o contexto curto de `AGENTS.md`.
O histórico completo está em
[`docs/architecture/project-memory.md`](docs/architecture/project-memory.md).

## Produto

Lupo é um gerenciador de senhas desktop para Windows, open source, leve,
offline-first e compatível com `.kdbx` do KeePass.

Site: <https://lupo.basis.app.br>
Repositório: <https://github.com/yurimundin/lupo>

## Regras inegociáveis

1. Nunca implementar criptografia própria; usar `kdbxweb`.
2. Offline-first absoluto: sem rede, telemetria ou coleta.
3. Compatibilidade total com `.kdbx`.
4. Senhas em RAM devem usar `ProtectedValue` quando entram no modelo KDBX.
5. Auto-lock e auto-clear de clipboard são obrigatórios.
6. Backup automático antes de salvar.
7. TypeScript strict.

## Leitura principal

- [`docs/architecture/overview.md`](docs/architecture/overview.md)
- [`docs/security/decisions.md`](docs/security/decisions.md)
- [`docs/release`](docs/release)
- [`docs/architecture/project-memory.md`](docs/architecture/project-memory.md)
