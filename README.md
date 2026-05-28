# Sec.Basis

> Gerenciador de senhas desktop, leve e moderno, 100% offline e compatível
> com o formato `.kdbx` do KeePass.

[![Status](https://img.shields.io/badge/status-em%20desenvolvimento-orange)]()
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows-blue)]()

## Por que o Sec.Basis?

Os gerenciadores de senha atuais forçam um trade-off ruim:

- **KeePass / KeePassXC** são seguros e auditados, mas têm UI travada nos
  anos 2000.
- **1Password / Bitwarden** têm UX moderna, mas são pesados, dependem de
  conta na nuvem e cobram assinatura para os recursos relevantes.

O **Sec.Basis** preenche essa lacuna com:

- **Segurança auditada** do formato `.kdbx` (via [kdbxweb](https://github.com/keeweb/kdbxweb)).
- **Interface moderna** baseada em React + Tailwind + shadcn/ui.
- **Leveza** — bundle nativo via Tauri (alguns MB, não centenas).
- **Offline-first absoluto** — zero requisições de rede, zero telemetria.
- **Open source MIT** — código sob auditoria pública.
- **Compatibilidade total com KeePass/KeePassXC** — você pode abrir o mesmo
  cofre em qualquer um dos três.
- **Organização visual moderna** — grupos em árvore, ordenação alfabética,
  Lixeira sempre no fim e ícones Lucide com cores por pasta.
- **Auditoria local do cofre** — painel offline com senhas fracas,
  reutilizadas, antigas, duplicidades e metadados ausentes.
- **Anexos compatíveis com KeePass** — arquivos podem ser anexados a entradas
  e continuam gravados dentro do próprio `.kdbx`.
- **Recuperação guiada** — se uma gravação for interrompida, o app detecta
  arquivos `.tmp`/`.bak` e oferece restauração conservadora.

## Status

🚧 **Em desenvolvimento ativo.** O MVP funcional está implementado
(CRUD completo, gerador de senhas, persistência atômica com backup,
soft-delete via Recycle Bin compatível com KeePass). A release Windows já pode
ser empacotada manualmente para validação controlada; a distribuição pública
ampla ainda aguarda assinatura de código, auto-update e mais validação de campo.

## Site oficial

🌐 [sec.basis.app.br](https://sec.basis.app.br/)

Documentação de usuário, downloads (em breve) e conteúdo institucional
ficam no site. Este repositório é o código-fonte e documentação técnica.

## Stack

- [Tauri v2](https://tauri.app/) — shell desktop nativo
- [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) (strict)
- [Vite](https://vite.dev/) — bundler
- [Tailwind CSS 4](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/)
- [kdbxweb](https://github.com/keeweb/kdbxweb) — leitura/escrita do formato `.kdbx`
- [Zustand](https://zustand.docs.pmnd.rs/) — estado global
- [lucide-react](https://lucide.dev/) — ícones

## Rodando localmente

### Pré-requisitos

- [Node.js](https://nodejs.org/) 20+ (testado em 24)
- [Rust stable](https://www.rust-lang.org/tools/install) (instalado via `rustup`)
- Em Windows: [Microsoft C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
  (necessário para compilar o backend Rust)
- WebView2 (já vem com Windows 11)

### Instalação

```bash
git clone https://github.com/yurimundin/secbasis.git
cd secbasis
npm install
npm run tauri dev
```

A primeira compilação do backend Rust pode levar alguns minutos. Execuções
seguintes são rápidas.

### Verificação local

```bash
npm run lint
npm run test:run
npm run build
```

Para gerar instaladores Windows (`.msi` e `.exe` NSIS):

```bash
npm run dist:windows
```

## Princípios

Princípios de design que guiam o projeto:

- **Nunca implementar criptografia própria.** Toda criptografia vem da
  kdbxweb (que por sua vez segue o padrão KeePass).
- **Offline-first.** Zero rede, zero telemetria, zero coleta de dados.
- **Memória segura.** Senhas em RAM exclusivamente via `ProtectedValue`.
- **Auto-lock e auto-clear.** Cofre bloqueia por inatividade; clipboard com
  senha é limpo após poucos segundos.
- **Backup automático antes de salvar.** Arquivo atual vira `.kdbx.bak`.
- **Recuperação conservadora de crash.** `.bak` sozinho é normal após saves;
  o app só interrompe o fluxo quando encontra `.tmp` pendente ou um cofre
  atual inconsistente com backup válido.
- **Metadados visuais compatíveis.** Ícones e cores de pastas são salvos como
  metadados próprios do Sec.Basis; KeePass/KeePassXC ignoram esses dados e
  continuam abrindo o mesmo `.kdbx` normalmente.
- **Superfície Tauri mínima.** CSP restritiva, sem permissões Shell amplas;
  links externos passam pelo plugin Opener com protocolos permitidos.

## Roadmap

- **Fase 1 (MVP):**
  - ✅ Abrir/criar cofre KDBX4
  - ✅ Suporte a key file
  - ✅ CRUD completo de entradas
  - ✅ Gerador criptográfico de senhas
  - ✅ Auto-lock e auto-clear de clipboard
  - ✅ Persistência atômica com backup `.kdbx.bak`
  - ✅ Ciclo de vida completo da Lixeira (mover, restaurar, esvaziar — compatível com KeePass)
  - ✅ Mover entradas entre pastas por drag and drop e diálogo "Mover para pasta..."
  - ✅ Favoritos de entradas persistidos no `.kdbx` via metadados Sec.Basis
  - ✅ Auto-open do último cofre usado (estilo KeePass — pré-preenche path, senha sempre exigida)
  - ✅ Tela "Sobre" com versão e links (acessível pelo botão Info no header)
  - ✅ Subgrupos expansíveis na sidebar (hierarquia recursiva, persistência por cofre)
  - ✅ Ordenação alfabética dos grupos na sidebar, com Lixeira sempre por último
  - ✅ Ícones Lucide e cores por pasta, incluindo opção "Jurídico" com ícone de balança
  - ✅ Busca em tempo real (substring case-insensitive em Title/UserName/URL/Notes, cross-group excluindo Lixeira, atalho Ctrl+F)
  - ✅ Command palette (`Ctrl+K`) para buscar entradas e executar ações rápidas
  - ✅ Anexos em entradas KDBX, com adicionar, salvar como e remover
  - ✅ Empacotamento Windows manual (instaladores `.msi` e `.exe` via Tauri)
  - ✅ Suíte unitária inicial (Vitest + CI)
  - ✅ Motor offline de força/auditoria de senhas
  - ✅ UI de auditoria do cofre no header, com resumo por severidade, recomendações e ações guiadas
  - ✅ Recuperação guiada para `.tmp`/`.bak` após crash ou gravação interrompida

- **Fase 2:** YubiKey, TOTP e histórico amigável de alterações das entradas.

- **Fase 3:** Extensão de browser para auto-fill, aplicativo Android e painel
  de saúde do cofre (LGPD-friendly).

Detalhes em [`CLAUDE.md`](CLAUDE.md).

## Sobre a marca

**Sec.Basis** pertence à família de produtos sob o domínio `basis.app.br`.
Outros produtos da família estão em planejamento; o foco atual é estabilizar
o Sec.Basis primeiro.

## Contribuindo

O projeto está em fase inicial e ainda não recebe contribuições externas.
Issues e ideias são bem-vindas.

## Licença

[MIT](LICENSE) © 2026 Yuri Mundin Ferreira
