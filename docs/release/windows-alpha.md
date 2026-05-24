# Release alpha Windows

Este documento descreve o fluxo manual de distribuição alpha do Sec.Basis para
testers conhecidos.

## Escopo da alpha

- Distribuição manual via GitHub Releases ou site oficial.
- Instaladores Windows gerados pelo Tauri: `.msi` e `.exe` (NSIS).
- Sem auto-update nesta fase.
- Sem assinatura de código nesta fase; o SmartScreen pode exibir aviso.

## Gerar instaladores

Pré-requisitos locais:

- Node.js 20+.
- Rust stable.
- Microsoft C++ Build Tools.
- WebView2 Runtime.

Comandos:

```powershell
npm ci
npm run lint
npm run build
npm run dist:windows
```

Artefatos esperados:

- `src-tauri/target/release/bundle/msi/*.msi`
- `src-tauri/target/release/bundle/nsis/*-setup.exe`

## Checklist antes de publicar

- Conferir a versão publicada. Para MSI, `src-tauri/tauri.conf.json` deve usar
  versão Windows numérica, por exemplo `0.1.0`; o marcador `alpha` fica no nome
  da release/tag/notas, por exemplo `v0.1.0-alpha`.
- Rodar o fluxo real de tester em uma máquina Windows limpa ou perfil limpo:
  instalar, abrir, criar cofre, adicionar entrada, salvar, fechar e reabrir.
- Publicar hashes SHA-256 dos instaladores junto com a release.
- Incluir aviso de alpha: produto em teste, sem assinatura de código, manter
  backup externo do cofre.

## Fora do escopo desta alpha

- Auto-update.
- Assinatura de código.
- Microsoft Store.
- Distribuição para usuários desconhecidos em larga escala.
