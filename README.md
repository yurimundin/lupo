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

## Status

🚧 **Em desenvolvimento ativo.** Ainda não há build de produção. A primeira
versão pública (MVP) será publicada na Microsoft Store após estabilização.

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

## Princípios

Princípios de design que guiam o projeto:

- **Nunca implementar criptografia própria.** Toda criptografia vem da
  kdbxweb (que por sua vez segue o padrão KeePass).
- **Offline-first.** Zero rede, zero telemetria, zero coleta de dados.
- **Memória segura.** Senhas em RAM exclusivamente via `ProtectedValue`.
- **Auto-lock e auto-clear.** Cofre bloqueia por inatividade; clipboard com
  senha é limpo após poucos segundos.
- **Backup automático antes de salvar.** Arquivo atual vira `.kdbx.bak`.

## Roadmap (resumo)

- **Fase 1 (MVP):** abrir/criar cofre, CRUD de entradas, gerador de senhas,
  auto-lock, auto-clear, busca, empacotamento Windows.
- **Fase 2:** key file, YubiKey, TOTP, anexos, importação Bitwarden/1Password,
  auditoria de senhas.
- **Fase 3:** extensão de browser para auto-fill, modo equipe via pasta
  sincronizada, painel de saúde do cofre (LGPD-friendly).

Detalhes em [`CLAUDE.md`](CLAUDE.md).

## Contribuindo

O projeto está em fase inicial e ainda não recebe contribuições externas.
Issues e ideias são bem-vindas.

## Licença

[MIT](LICENSE) © 2026 Yuri Mundin Ferreira
