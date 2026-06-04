# Decisões de Segurança

## Invariantes

1. Nunca implementar criptografia própria; usar `kdbxweb`.
2. Offline-first absoluto: sem rede, telemetria ou coleta.
3. Compatibilidade total com `.kdbx`.
4. Senhas em RAM devem usar `ProtectedValue` quando entram no modelo KDBX.
5. Auto-lock e auto-clear de clipboard continuam obrigatórios.
6. Backup automático antes de salvar.
7. TypeScript strict, sem `any` e sem `@ts-ignore`.

## Decisões registradas

- Argon2 roda no backend Rust via comando Tauri.
- Paths de key file são metadata operacional e ficam em texto puro.
- Sincronização própria, cloud e modo equipe ficam fora do produto.
- Vulnerabilidades de dependências transitivas são tratadas com override
  explícito quando necessário.

O histórico detalhado dessas decisões está arquivado em
[`../architecture/project-memory.md`](../architecture/project-memory.md).
