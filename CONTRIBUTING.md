# Contribuindo com o Lupo

Obrigado por considerar contribuir! Lupo é um projeto open source
MIT que se beneficia de contribuições da comunidade.

## Status do projeto

Lupo está em desenvolvimento ativo. Ainda não estamos abertos a
Pull Requests grandes — preferimos discutir mudanças via issue antes.
Pequenas correções (typos, bugs óbvios) são bem-vindas diretamente.

## Como rodar localmente

Veja o [README.md](./README.md) para instruções completas.

## Convenções de código

- TypeScript strict mode, zero `any`, zero `@ts-ignore`.
- Comentários em português brasileiro.
- Código (variáveis, funções, arquivos) em inglês.
- UI em português brasileiro (i18n no futuro).
- Tailwind CSS: prefira tokens da paleta Lupo. Arbitrary values
  (ex: `max-w-[440px]`) são aceitos quando o token não cobre o caso.
  Para layouts críticos (grid, flex), considerar inline `style={{ ... }}`
  por determinismo — ver CLAUDE.md §12 sobre o bug do scanner do Tailwind 4.
- Sem dependências novas sem justificativa em PR.

## Convenções de commits

Lupo usa [Conventional Commits](https://www.conventionalcommits.org/):

| Prefixo | Quando usar |
|---|---|
| `feat:` | nova funcionalidade |
| `fix:` | correção de bug |
| `chore:` | manutenção (deps, configuração) |
| `docs:` | documentação |
| `refactor:` | refatoração sem mudança de comportamento |
| `test:` | testes |
| `security:` | correções relacionadas à segurança |

## Mudanças críticas

Mudanças em qualquer código relacionado a:

- Criptografia (Argon2, kdbxweb, derivação de chave).
- Persistência (formato `.kdbx`, settings, key files).
- Auto-lock e auto-clear.
- Permissões do Tauri.

...exigem revisão extra detalhada. Se você for propor mudança nessas
áreas, abra issue antes para discutirmos.

## Reportando bugs

- Bug normal: [issues do GitHub](https://github.com/yurimundin/lupo/issues).
- Vulnerabilidade de segurança: ver [SECURITY.md](./SECURITY.md) — **NÃO** abra issue pública.

## Bench em release

Para rodar smoke test em build de release:

```bash
VITE_RUN_SMOKE=1 npm run tauri build
./src-tauri/target/release/lupo.exe
cat $USERPROFILE/AppData/Local/Temp/lupo-bench.log
```
