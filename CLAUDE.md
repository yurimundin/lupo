# Sec.Basis — Contexto para o Claude

> Este arquivo é carregado automaticamente em toda sessão do Claude Code dentro
> deste repositório. Mantenha-o atualizado: ele é a memória persistente do
> projeto.

---

## 1. Produto

**Sec.Basis** é um gerenciador de senhas desktop para Windows, **open source
(MIT)**, leve, moderno, **offline-first** e totalmente compatível com o
formato `.kdbx` do KeePass. Será publicado na **Microsoft Store**.

### Tese

Os gerenciadores existentes têm trade-offs ruins:

- **KeePass clássico:** seguro e auditado, mas UI parada em 2003.
- **1Password / Bitwarden:** UX boa, mas pesados e online-first (dependem de
  conta na nuvem para a maior parte do valor).

**Sec.Basis preenche o espaço** entregando, no mesmo produto:
segurança auditada do KeePass + UX moderna + leveza + offline-first +
open source.

### Público-alvo

- Profissionais que querem controle local dos próprios dados.
- Usuários atuais de KeePass/KeePassXC que sentem falta de UI moderna.
- Empresas pequenas/médias e profissionais regulados (advogados, contadores,
  médicos, DPOs) que precisam de uma solução que rode 100% offline.

---

## 2. Stack obrigatório

| Camada           | Tecnologia                                  |
| ---------------- | ------------------------------------------- |
| Shell desktop    | **Tauri v2** (Rust backend + WebView nativa)|
| UI framework     | **React 19** + **TypeScript** (strict mode) |
| Bundler          | **Vite**                                    |
| Estilização      | **Tailwind CSS 4**                          |
| Componentes UI   | **shadcn/ui**                               |
| Formato de cofre | **kdbxweb** (leitura/escrita de .kdbx)      |
| Estado global    | **Zustand**                                 |
| Ícones           | **lucide-react**                            |

**Identifier do app (Tauri / Microsoft Store):** `com.secbasis.app`
**Janela inicial:** 1100×720, mínimo 800×600.

---

## 3. Princípios INEGOCIÁVEIS

Toda decisão de código ou produto deve respeitá-los. Em caso de conflito,
**parar e perguntar** ao Yuri.

1. **NUNCA implementar criptografia própria.** Usar exclusivamente kdbxweb. Se
   precisar de algo cripto que a kdbxweb não cubra, perguntar antes.
2. **Offline-first absoluto.** Zero requisições de rede, zero telemetria, zero
   coleta de dados. Nem mesmo "verificar atualização" faz parte do MVP.
3. **Compatibilidade total com .kdbx.** Um arquivo gerado pelo Sec.Basis
   precisa abrir sem erros no KeePass/KeePassXC, e vice-versa.
4. **Memória segura.** Senhas em RAM exclusivamente via `ProtectedValue` do
   kdbxweb. Buffers limpos após uso. Nada de logar senha, nem em dev.
5. **Auto-lock e auto-clear.** Cofre bloqueia por inatividade configurável;
   clipboard com senha é limpo após N segundos.
6. **TypeScript strict.** Sem `any`, sem `@ts-ignore`. Tipos explícitos em
   props e funções públicas.
7. **Idiomas:** comentários em português, código (variáveis, funções,
   arquivos) em inglês, UI em português brasileiro.
8. **Backup automático antes de salvar.** Renomear arquivo atual para
   `.kdbx.bak` antes de gravar nova versão.
9. **Zero dependências desnecessárias.** Cada nova lib precisa ser justificada
   em PR/commit.
10. **Conservadorismo.** Se um comando falha, parar e perguntar. Nunca
    "consertar criativamente" em projeto de segurança.

---

## 4. Estrutura de pastas

```
src/
├── components/
│   ├── ui/          # shadcn/ui (a instalar na próxima sessão)
│   ├── vault/       # Componentes do cofre (lista, sidebar, busca)
│   ├── entry/       # Componentes de entrada (form, view, generator)
│   └── layout/      # Sidebar, topbar, lockscreen
├── lib/
│   ├── kdbx.ts      # Wrapper do kdbxweb (única porta para o formato .kdbx)
│   ├── crypto.ts    # Gerador de senhas (NÃO criptografia)
│   └── utils.ts     # Helpers genéricos (ex.: cn do shadcn)
├── stores/
│   ├── vault.ts     # Estado Zustand do cofre aberto
│   └── settings.ts  # Preferências do usuário
├── hooks/           # Custom hooks (useAutoLock, useClipboardClear...)
└── types/
    └── index.ts     # Tipos compartilhados
```

`src-tauri/` é o backend Rust (não tocar sem necessidade — o app é
deliberadamente "thin Rust", a maior parte da lógica vive no React).

---

## 5. Roadmap

### Fase 1 — MVP

Objetivo: substituir o KeePassXC para o uso pessoal do Yuri.

- [ ] Tela inicial: abrir cofre existente (`.kdbx`) ou criar novo.
- [ ] Desbloqueio com senha-mestra (suporte a key file fica para Fase 2).
- [ ] Layout principal: sidebar de grupos + lista de entradas + painel de
      detalhe.
- [ ] CRUD de entradas (título, usuário, senha, URL, notas).
- [ ] Visualizar/copiar senha com auto-clear de clipboard (configurável).
- [ ] Gerador de senhas (comprimento, conjuntos, exclusão de ambíguos).
- [ ] Busca textual nas entradas.
- [ ] Salvar com backup automático (`.kdbx.bak`).
- [ ] Auto-lock por inatividade (configurável).
- [ ] Tema claro/escuro (segue o sistema).
- [ ] Empacotamento Windows (instalador `.msi` + `.exe`).
- [ ] **Pré-requisito técnico:** integrar implementação de **Argon2** (KDF
      padrão do KDBX4). A `kdbxweb` exige `CryptoEngine.setArgon2Impl(...)`
      injetado pelo consumidor — a lib não embute Argon2. Avaliar opções:
      (a) `argon2-browser` via WASM no front, (b) expor função via comando
      Tauri/Rust usando o crate `argon2`. **Sem isso, criar/abrir cofres
      KDBX4 falha.**

### Fase 2 — Paridade com KeePassXC

Objetivo: virar uma alternativa real a KeePassXC.

- [ ] Suporte a key file + YubiKey (challenge-response) para desbloqueio.
- [ ] Campos personalizados e anexos em entradas.
- [ ] TOTP (geração de códigos 2FA, igual ao KeePassXC).
- [ ] Histórico de senhas por entrada.
- [ ] Lixeira interna (soft-delete) com restauração.
- [ ] Importação a partir de Bitwarden, 1Password, LastPass (CSV/JSON).
- [ ] Auditoria de senhas (fracas, repetidas, antigas).
- [ ] Atalhos de teclado completos.
- [ ] Localização: en-US e es-ES além de pt-BR.
- [ ] **Modo somente-leitura:** abrir cofre sem permissão de escrita, para
      casos de auditoria/consultoria (DPO revisando cofre de cliente, p.ex.).

### Fase 3 — Diferenciação

Objetivo: o que ninguém mais entrega bem.

- [ ] Auto-fill no navegador via extensão própria (Chromium/Firefox), com
      comunicação local segura (sem nuvem).
- [ ] Modo "compartilhado em equipe" via arquivo `.kdbx` em pasta
      sincronizada (OneDrive/Drive/Dropbox), com locking cooperativo.
- [ ] Verificação de vazamentos via HIBP **k-anonymity offline-first opcional**
      (usuário precisa habilitar explicitamente — quebra parcial do
      offline-first, deve ser opt-in claro).
- [ ] Painel de saúde do cofre (Compliance/LGPD-friendly): relatório
      exportável de práticas de senha para uso por DPOs.
- [ ] Modo "kiosk/visitante" (cofre somente-leitura, sem clipboard).

### Fase 4 — Avaliação futura (possível projeto separado)

- [ ] **Mobile (Android/iOS) via Tauri Mobile.** Exige reengenharia de UX
      para integração nativa com auto-fill do SO (Android Autofill Framework,
      iOS Password AutoFill) e biometria (Touch/Face ID, BiometricPrompt).
      Pode virar **projeto irmão** (`Sec.Basis Mobile`) em vez de feature
      do mesmo binário, dado o tamanho do esforço e a divergência de UX.

---

## 6. Decisões arquiteturais

### Argon2 implementado em Rust (via comando Tauri) — **NÃO em WASM**

**Decisão (sessão 2):** toda derivação de chave Argon2 do Sec.Basis roda no
backend Rust, exposta ao front via `#[tauri::command] argon2_derive_key` e
plugada na `kdbxweb` via `CryptoEngine.setArgon2Impl(...)` em
[src/lib/kdbx.ts](src/lib/kdbx.ts).

**Por quê:**
1. **Performance nativa.** Argon2 é CPU/RAM-intensivo por design; Rust roda
   2–4× mais rápido que WASM, importante para que o desbloqueio do cofre
   não pareça amador.
2. **Segurança de memória.** Buffers Rust podem ser zerados explicitamente
   com `zeroize`; WASM vive no heap JS, sujeito a GC e snapshots.
3. **Crate canônico.** `argon2` da RustCrypto é a implementação canônica e
   auditada da comunidade Rust.
4. **Custo marginal baixo.** Tauri v2 já tem o pattern `#[tauri::command]`
   pronto; não há atrito de integração.
5. **Desktop-only.** Sec.Basis não precisa rodar em browser, então perder
   portabilidade WASM é aceitável.

**Implicação:** **nunca** chamar uma implementação JS/WASM de Argon2.
Qualquer nova superfície que precise de KDF deve passar pelo mesmo comando
Tauri (extensível com novos parâmetros se outras KDFs entrarem no escopo).

### Sincronização própria via servidor self-hostable — **EXCLUÍDA**

**Decisão (2026-05-04):** o Sec.Basis NÃO terá servidor de sincronização
próprio (nem hospedado, nem self-hostable).

**Por quê:**
1. Viola o princípio "offline-first absoluto" — adicionar protocolo de sync
   significa rede, autenticação, conta, e tudo o que o produto promete não
   ter.
2. Exige infraestrutura (servidor de referência, atualizações, suporte) que
   destrói o modelo "binário leve, distribuído, audita você mesmo".
3. Mercado já atendido: quem quer self-host roda Bitwarden/Vaultwarden.
4. Caso de uso real do usuário (cofre acessível em mais de um dispositivo)
   já é resolvido por OneDrive/Drive/Dropbox + arquivo `.kdbx` na pasta
   sincronizada — comportamento padrão do KeePass há décadas. A Fase 3 trata
   isso explicitamente com locking cooperativo.

**Implicação:** propostas/issues pedindo "Sec.Basis Cloud" devem ser
fechadas com link para esta seção.

### Path do key file por cofre — **TEXTO PURO** (não criptografado)

**Decisão (sessão 3):** o mapa `keyFilePathByVault` em
[src/stores/settings.ts](src/stores/settings.ts) persiste em
`localStorage` (`sec-basis-settings`) sem criptografia. Trata o caminho
como **metadata operacional, não segredo**.

**Por quê:**
1. **KeePass e KeePassXC tratam igual** — path do último key file vai pra
   config do app em texto puro. Não inventar fricção que o ecossistema
   estabelecido já avaliou e descartou.
2. **DPAPI seria security theater.** No Windows, `localStorage` do nosso
   bundle vive em `%APPDATA%/...`. Quem consegue ler isso já tem credenciais
   do usuário logado — exatamente o mesmo limite de segurança que o DPAPI
   ofereceria (que usa a mesma chave de usuário). Criptografar não move a
   barra.
3. **Auditabilidade > ofuscação.** Texto puro deixa o comportamento óbvio
   pra qualquer auditor; criptografia esconde sem proteger.
4. **Princípio geral:** segurança real vem de mecanismos auditáveis e
   simples (Argon2, formato `.kdbx` cifrado, `ProtectedValue` em RAM).
   Ofuscação que parece segurança é dívida técnica disfarçada — quanto mais
   código "esperto", mais superfície de bug e menos confiança.

**Implicação:** ao avaliar futuras propostas de "criptografar o
`localStorage`", "ofuscar o caminho do cofre recente", etc., aplicar o
mesmo teste — se o atacante que importa já passou da barreira que o
mecanismo proposto resguardaria, é theater.

---

## 7. Histórico de decisões de segurança

> Trilha de auditoria. Toda decisão que afete superfície de ataque,
> dependências de cripto, ou tratamento de credenciais é registrada aqui
> com data, contexto e mitigação.

### 2026-05-04 — Override de `@xmldom/xmldom` para `^0.8.12` (resolveu 0.8.13)

**Contexto:** após `npm install` inicial, `npm audit` reportou **5
advisories high severity** em `@xmldom/xmldom@0.7.13`, dependência
transitiva via `kdbxweb@2.1.1`:

| Advisory | CWE | Severidade | Faixa afetada |
|----------|-----|------------|---------------|
| GHSA-2v35-w6hq-6mfw — DoS via recursão na serialização XML | CWE-674 | high | `<0.8.13` |
| GHSA-f6ww-3ggp-fr8h — XML injection via DocumentType serialization | CWE-91 | high | `<0.8.13` |
| GHSA-x6wf-f3px-wcqx — node injection via processing instruction serialization | CWE-91 | high | `<0.8.13` |
| GHSA-j759-j44w-7fr8 — node injection via comment serialization | CWE-91 | high | `<0.8.13` |
| GHSA-wh4c-j3r5-mjhp — XML injection via unsafe CDATA serialization (CVSS 7.5) | CWE-91 | high | `<0.8.12` |

**Vetor de ataque:** o `kdbxweb` usa `@xmldom/xmldom` para serializar o XML
interno do `.kdbx`. Mesmo que o vetor prático fique restrito a arquivos
`.kdbx` maliciosos abertos pelo próprio usuário, **manter dependência com
CVE alta em produto de segurança é inaceitável**.

**Mitigação:** override no `package.json` no nível raiz, forçando todas as
resoluções de `@xmldom/xmldom` (inclusive transitivas) para a faixa
patched:

```json
"overrides": {
  "@xmldom/xmldom": "^0.8.12"
}
```

**Verificações pós-mitigação:**
- `npm ls @xmldom/xmldom` resolveu para **0.8.13** (latest patched).
- `npm audit` retornou **`found 0 vulnerabilities`**.
- Smoke test manual da `kdbxweb` (criar cofre em memória, adicionar grupo
  e entrada com `ProtectedValue`, salvar para `ArrayBuffer`, recarregar e
  validar campos) **passou** com a versão override (KDF AES no teste para
  contornar dependência opcional de Argon2).

**Plano de manutenção:** revisar o override sempre que `kdbxweb` lançar
nova versão maior, para checar se podemos removê-lo (i.e., se a `kdbxweb`
passou a depender diretamente de `@xmldom/xmldom@^0.8.13` ou superior).

### 2026-05-04 (sessão 2) — Argon2 nativo em Rust + descoberta de defaults fracos da kdbxweb

**Contexto:** ao integrar Argon2 (necessário para criar/abrir cofres KDBX4),
optamos pela opção (b) — implementação Rust via comando Tauri — em vez de
`argon2-browser` WASM. Justificativa completa na §6.

**Implementação:**
- Crate `argon2 = "0.5"` (RustCrypto) + `zeroize = "1.8"`.
- [src-tauri/src/crypto.rs](src-tauri/src/crypto.rs): `derive_argon2_key` com
  `Zeroizing<Vec<u8>>` na senha; suporta variantes `Argon2d`/`Argon2id` e
  versões `0x10`/`0x13`. Retorna erros como string para serialização Tauri.
- [src-tauri/src/lib.rs](src-tauri/src/lib.rs): comando exposto roda em
  `tauri::async_runtime::spawn_blocking` para não travar o reactor (cada
  derivação leva ~1,4 s nos params padrão).
- [src/lib/argon2.ts](src/lib/argon2.ts): wrapper tipado.
- [src/lib/kdbx.ts](src/lib/kdbx.ts): `initKdbxweb()` registra o adaptador via
  `kdbxweb.CryptoEngine.setArgon2Impl(...)`, mapeando `type` (0/2) → variante
  e validando `version` (0x10/0x13).

**Smoke test (DEV-only, [src/lib/__tests__/kdbx-smoke.ts](src/lib/__tests__/kdbx-smoke.ts)):**
- Argon2 standalone, params KDBX4 padrão (64 MiB / 2 iter / 2 lanes /
  Argon2id / v0x13), 3 execuções: 1395, 1377, 1453 ms — **média ≈1,4 s**.
- KDBX4 round-trip de cofre vazio: save 33 ms, open 27 ms, 1493 bytes.

**Descoberta colateral importante (a tratar na Tarefa 4 / criação de cofre):**
A `kdbxweb.Kdbx.create` defaulta a Argon2 com **apenas 1 MiB de memória**
(`HeaderConst.DefaultKdfMemory = 1024 × 1024 bytes`), 2 iter, 1 lane. Isso
explica a velocidade do round-trip do smoke test mas é **dolorosamente fraco
para um cofre de produção**. KeePass 2.x default é 64 MiB / 2 iter / 2 lanes.

**Mitigação obrigatória — Tarefa 4 (criação de cofre):**

Criar uma constante exportada em [src/lib/kdbx.ts](src/lib/kdbx.ts):

```ts
/**
 * Parâmetros KDF de Argon2 alinhados ao padrão do KeePass 2.x para cofres
 * novos. NÃO confiar no default da kdbxweb (DefaultKdfMemory = 1 MiB), que
 * é dolorosamente fraco. Usar esta constante em TODOS os caminhos que
 * criem cofres novos (UI principal, importação de outros gerenciadores,
 * scripts de migração) — a centralização é proteção contra regressão se
 * surgirem fluxos secundários.
 *
 * Cofres ABERTOS herdam os parâmetros do header do arquivo original — não
 * tocar. Esta constante só vale ao criar.
 */
export const KDBX4_SECURE_KDF_PARAMS = {
  memory: 64 * 1024 * 1024, // 64 MiB
  iterations: 2,
  parallelism: 2,
  variant: "argon2id",      // Argon2id (default KeePassXC moderno)
  version: 0x13,            // Argon2 v1.3
} as const;
```

Aplicação ao criar (sintaxe a confirmar contra a API real da kdbxweb):
```ts
const params = db.header.kdfParameters!;
params.set("M", kdbxweb.VarDictionary.ValueType.UInt64,
  kdbxweb.Int64.from(KDBX4_SECURE_KDF_PARAMS.memory));
params.set("I", kdbxweb.VarDictionary.ValueType.UInt64,
  kdbxweb.Int64.from(KDBX4_SECURE_KDF_PARAMS.iterations));
params.set("P", kdbxweb.VarDictionary.ValueType.UInt32,
  KDBX4_SECURE_KDF_PARAMS.parallelism);
// UUID Argon2id já é o default do db.setKdf(...) ou via Consts.KdfId.
```

Cofres **abertos** (não criados) usam os parâmetros do header do arquivo
original — sem alteração.

### 2026-05-04 (sessão 2, adendo) — Correção da spec original do Argon2

A spec do prompt da Sessão 2 listava `version: u8 (0x10 = Argon2d, 0x13 =
Argon2id)`. Isso é **tecnicamente incorreto**: `0x10`/`0x13` são versões do
algoritmo Argon2 (v1.0 / v1.3), não variantes. `Argon2d`/`Argon2id` são
variantes selecionadas por outro parâmetro e por UUIDs distintos no header
KDBX4. A `kdbxweb.CryptoEngine.setArgon2Impl` passa **ambos** parâmetros
separadamente (`type: 0|2` e `version: 0x10|0x13`).

**Correção aplicada e aprovada:** a função `derive_argon2_key` recebe `version`
e `variant` como parâmetros distintos. Esta é a única forma de respeitar a
especificação real do Argon2 e a API da `kdbxweb`. Documentado em
[src-tauri/src/crypto.rs](src-tauri/src/crypto.rs:11-18).

### 2026-05-04 (sessão 2, observação) — Tempo Argon2 acima do ideal em DEV — **RESOLVIDO na 2.5**

Bench Argon2 standalone (64 MiB / 2 iter / 2 lanes) em DEV deu **~1,4 s**
por derivação. Referência KeePassXC: 0,5–0,8 s.

**Causa confirmada na sessão 2.5:** era o `tauri dev` compilando Rust em
modo **debug** (`unoptimized + debuginfo`). Em release (medição abaixo)
caiu para ~100 ms. Sem ação adicional necessária — DEV continua lento e
isso é aceitável; release entrega tempo excelente.

### 2026-05-04 (sessão 2.5) — Bench em release: 100 ms (Argon2 KDBX4 padrão)

**Contexto:** primeira execução de `npm run tauri build` (release) para
medir Argon2 real com `cargo --release`, decidir se os parâmetros KDF
(64 MiB / 2 iter / 2 lanes / Argon2id) precisam de ajuste.

**Mecânica do bench (mantido permanente como utilitário):**
- [src/main.tsx](src/main.tsx): smoke test também roda em release quando
  o build é feito com `VITE_RUN_SMOKE=1`.
- [src-tauri/src/lib.rs](src-tauri/src/lib.rs) → `log_smoke_result` agora
  também grava em `%TEMP%/sec-basis-bench.log` (em release o `println!`
  some por causa de `windows_subsystem = "windows"`).

**Resultados (Argon2 standalone, KDBX4 padrão 64 MiB / 2 iter / 2 lanes /
Argon2id / v0x13):**

| Métrica | DEV (debug) | Release (`tauri build`) | Speedup |
|---|---|---|---|
| Execução 1 | 1687 ms | **103 ms** | 16× |
| Execução 2 | 1489 ms | **87 ms** | 17× |
| Execução 3 | 1490 ms | **110 ms** | 14× |
| **Média** | **1555 ms** | **100 ms** | **15×** |

KDBX4 round-trip (com defaults fracos da `kdbxweb`, 1 MiB): save 14 ms,
open 7 ms, 1509 bytes.

**Decisão sobre parâmetros KDF — MANTER (64 MiB / 2 iter / 2 lanes /
Argon2id):** 100 ms está bem dentro do critério "PERFEITO" (≤ 800 ms) e
mais rápido que o KeePassXC de referência (0,5–0,8 s). Trocar parâmetros
agora seria abrir mão de segurança sem ganho perceptível de UX.

**Tamanhos de bundle do release:**
- `target/release/tauri-app.exe`: **9,85 MB**
- `target/release/bundle/msi/Sec.Basis_0.1.0_x64_en-US.msi`: **3,40 MB**
- `target/release/bundle/nsis/Sec.Basis_0.1.0_x64-setup.exe`: **2,26 MB**

(Comparação contextual: KeePassXC instalador ~30 MB; gerenciadores
comerciais (1Password/Bitwarden) instaladores na casa das centenas de
MB. O Sec.Basis empacota em <4 MB.)

**Build wall-time:** 3 min 27 s (Rust release puro: 2 min 57 s; resto:
patching MSI + NSIS, downloads de WIX/NSIS na primeira vez).

**Decisão de manter o bench gate:** `VITE_RUN_SMOKE=1` + escrita em
`%TEMP%/sec-basis-bench.log` ficam permanentes como utilidade de debug
em release. Falha silenciosa se o arquivo não puder ser escrito.

---

## 8. Sessão de inicialização (status atual)

Em **2026-05-04**, primeira sessão concluiu:

- Rust 1.95.0 stable instalado via `winget`.
- Projeto Tauri v2 scaffolded com template `react-ts`.
- Dependências instaladas: Tailwind 4, kdbxweb, zustand, lucide-react.
- Tailwind configurado em `vite.config.ts` e importado em `App.css`.
- `tauri.conf.json` com productName "Sec.Basis", janela 1100×720.
- Estrutura de pastas criada com placeholders (`TODO`).
- `CLAUDE.md`, `README.md`, `LICENSE` (MIT, Yuri Mundin Ferreira) e
  `.gitignore` criados.
- Override de segurança `@xmldom/xmldom` aplicado e validado (ver §7).
- MSVC C++ Build Tools 2022 instalado via `winget` (workload VCTools) —
  necessário para o linker `link.exe` do toolchain `x86_64-pc-windows-msvc`.
- `npm run tauri dev` validado: compilação Rust completa em ~2m20s na
  primeira vez, `target\debug\tauri-app.exe` executou e a janela do
  Sec.Basis abriu corretamente (validação visual pelo Yuri).

**Sessão 2 (2026-05-04) — Tarefas 1 a 5 concluídas:**

Tarefa 1 — Argon2 nativo (Rust via comando Tauri):
- Crates `argon2 = "0.5"` e `zeroize = "1.8"` adicionados.
- Backend: [src-tauri/src/crypto.rs](src-tauri/src/crypto.rs) +
  comandos `argon2_derive_key` e `log_smoke_result` em
  [src-tauri/src/lib.rs](src-tauri/src/lib.rs).
- Frontend: [src/lib/argon2.ts](src/lib/argon2.ts),
  [src/lib/kdbx.ts](src/lib/kdbx.ts) com `initKdbxweb()`,
  smoke test em [src/lib/__tests__/kdbx-smoke.ts](src/lib/__tests__/kdbx-smoke.ts).
- Smoke test PASS: Argon2 standalone média 1,4–1,5 s (debug build),
  round-trip KDBX4 com defaults fracos da lib em ~30 ms. Discrepância
  documentada na §7.

Tarefa 2 — Sistema de tema:
- `@fontsource-variable/geologica` instalado e importado em
  [src/main.tsx](src/main.tsx).
- Tokens cravados em [src/App.css](src/App.css) (light + dark, brand,
  semânticas).
- [src/lib/theme.ts](src/lib/theme.ts) com `initTheme/setTheme`, suporta
  preferência manual (`localStorage["sec-basis-theme"]`) ou
  `prefers-color-scheme`.
- Anti-flicker via script inline no [index.html](index.html).

Tarefa 3 — shadcn/ui:
- `npx shadcn@latest init` (template Vite, base Radix, preset Nova).
- 8 componentes adicionados: button, input, label, card, dialog, alert,
  tabs, progress (último ajustado para aceitar `indicatorClassName`).
- Tokens shadcn (`--background`/`--foreground`/`--primary`/...) mapeados
  em camadas no [src/App.css](src/App.css) para resolver na nossa paleta.
  Convenção de uso: classes shadcn padrão (`bg-background`,
  `text-foreground`, `bg-primary`, `bg-muted`) já apontam para os hex
  cravados; `bg-brand-accent`, `bg-success`, etc. ficam pra destaques
  específicos do Sec.Basis.
- Geist (que veio "de brinde" do shadcn) removido — Geologica é a fonte.

Tarefa 4 — Tela de abrir/criar cofre:
- Plugin `@tauri-apps/plugin-dialog` v2 + `tauri-plugin-dialog` crate
  registrados; capability `dialog:default` adicionada em
  [src-tauri/capabilities/default.json](src-tauri/capabilities/default.json).
- Comandos Rust `read_file_bytes` e `write_file_with_backup` (este último
  implementa `.kdbx → .kdbx.bak` antes de gravar nova versão).
- [src/lib/kdbx.ts](src/lib/kdbx.ts) ganhou `KDBX4_SECURE_KDF_PARAMS`
  (64 MiB / 2 iter / 2 lanes / Argon2id), `createVault`, `openVault`,
  `saveVault` (este chama o comando Rust com backup), e tradutor de
  erros da kdbxweb pra mensagens em PT-BR.
- [src/lib/password-strength.ts](src/lib/password-strength.ts): medidor
  simples 4 níveis (sem zxcvbn — mantém leve).
- Componentes em [src/components/vault/](src/components/vault/):
  `OpenCreateScreen` (header com cadeado + Tabs), `OpenVaultTab` (file
  picker + senha + Desbloquear), `CreateVaultTab` (nome + senha + confirmar
  + medidor + Criar). Toggle mostrar/ocultar senha em todos os inputs de
  senha. Auto-clear: `setPassword("")` após sucesso de open/create.

Tarefa 5 — Validação:
- `npm run tauri dev` rodou; janela abriu; smoke test passou (Argon2
  ~1,55 s média). Validação manual dos 3 fluxos pelo Yuri (criar/abrir/
  senha errada) ficou a critério dele — sem reporte explícito de bug,
  ele fechou a janela.

**Sessão 2.5 (2026-05-04) — bench em release:** Argon2 cai pra ~100 ms
com `cargo --release` (15× speedup vs DEV). Decisão: manter parâmetros
KDBX4 padrão. Bundle MSI 3,4 MB. Detalhes na §7.

**Sessão 3 (2026-05-04) — Tarefas 0 a 11 concluídas:**

Tarefa 0 — Renomear executável:
- `[package].name = "secbasis"`, `lib.name = "secbasis_lib"`,
  `main.rs` chama `secbasis_lib::run()`.

Tarefa 1 — Stores:
- [src/stores/vault.ts](src/stores/vault.ts): regra inegociável
  comentada em CAIXA ALTA (NUNCA usar `persist`). Estado: `kdbx`,
  `filePath`, `lastFilePath`, `lastKeyFilePath`, `selectedGroupUuid`,
  `selectedEntryUuid`. Hooks selectors: `useIsLocked`,
  `useCurrentGroup`, `useCurrentEntry`, `useEntriesOfCurrentGroup`,
  `useTopLevelGroups`. Helper `findEntryByUuidIdInDb`.
- [src/stores/settings.ts](src/stores/settings.ts) (com `persist`,
  chave `sec-basis-settings`): `autoLockMs` (default 5 min),
  `clipboardAutoClearMs` (default 20 s), `seenKeyFileBanner`,
  `keyFilePathByVault` (texto puro — ver §6 "Path do key file por
  cofre"). Tema continua em [src/lib/theme.ts](src/lib/theme.ts) por
  ora (decisão de não refatorar Sessão 2 sem necessidade).

Tarefa 2 — Key file na criação:
- [src/components/vault/CreateVaultTab.tsx](src/components/vault/CreateVaultTab.tsx)
  ganhou bloco opcional "Adicionar key file" com tabs Gerar/Existente.
- "Gerar novo" usa `kdbxweb.Credentials.createRandomKeyFile(2)` (formato
  `.keyx` v2 nativo do KeePassXC) → `generateKeyFile(path)` em
  [src/lib/kdbx.ts](src/lib/kdbx.ts).
- 3 checkboxes obrigatórios sobre responsabilidade do usuário.

Tarefa 3 + adendo — Key file na abertura + memória por cofre:
- Comando Tauri novo `file_exists` em
  [src-tauri/src/lib.rs](src-tauri/src/lib.rs); wrapper TS em
  [src/lib/fs.ts](src/lib/fs.ts).
- [src/components/vault/OpenVaultTab.tsx](src/components/vault/OpenVaultTab.tsx)
  com checkbox "Este cofre usa key file". Pré-marca + pré-seleciona se
  há entry em `settings.keyFilePathByVault[vaultPath]` que ainda existe
  no disco; se sumiu, mostra warning amarelo e abre picker
  automaticamente UMA vez (controle via `useRef`). Cancelar o picker
  não reabre em loop.
- Após desbloqueio: `setVault` no store + `rememberKeyFile`/
  `forgetKeyFile` em `settings`.
- Mensagem de erro unificada quando o cofre tem key file:
  "Senha mestra ou key file incorretos."

Tarefa 4 — Layout:
- [src/components/layout/VaultLayout.tsx](src/components/layout/VaultLayout.tsx)
  — header + banner key file + grid `200px 280px 1fr`.
- [src/components/layout/VaultHeader.tsx](src/components/layout/VaultHeader.tsx)
  — nome do arquivo, busca placeholder com id `vault-search-input`,
  AutoLockIndicator, botão Bloquear.
- [src/components/layout/AutoLockIndicator.tsx](src/components/layout/AutoLockIndicator.tsx)
  — "🔒 X:YY" com countdown a cada 1s.

Tarefas 5/6/7 — Painéis:
- [src/components/vault/GroupSidebar.tsx](src/components/vault/GroupSidebar.tsx)
  render flat (root + filhos diretos), ↑/↓ navega quando focada.
- [src/components/vault/EntryList.tsx](src/components/vault/EntryList.tsx)
  com avatar (iniciais + cor por hash), ordenação alfabética, ↑/↓.
- [src/components/vault/EntryDetail.tsx](src/components/vault/EntryDetail.tsx)
  read-only — Usuário, Senha (mascarada com `•`), URL, Notas. Botão
  copiar em cada campo. Botão olho na senha auto-oculta após **10s**.
  URL clicável via `@tauri-apps/plugin-shell` (`shell:allow-open`).
- Helpers em [src/lib/entry-helpers.ts](src/lib/entry-helpers.ts).

Tarefa 8 — Auto-lock + auto-clear:
- [src/lib/clipboard.ts](src/lib/clipboard.ts) `copyToClipboardWithAutoClear`:
  copia + toast + após `clipboardAutoClearMs` lê o clipboard, sobrescreve
  só se ainda for o mesmo texto. Se `readText` falhar por permissão,
  **fallback: limpa incondicionalmente** (preferir segurança a UX).
- [src/hooks/useAutoLock.ts](src/hooks/useAutoLock.ts):
  `useAutoLock()` registra mousemove (throttle 250 ms), keydown, click,
  scroll, touchstart no document; `useAutoLockRemainingMs()` para o
  indicador. NÃO reseta quando janela perde foco (continua contando se
  o usuário foi pra outro app).
- [src/hooks/useGlobalShortcuts.ts](src/hooks/useGlobalShortcuts.ts):
  Ctrl+L / Ctrl+K / Ctrl+C (entry sel.) / Esc.
- Toast: `sonner` (componente shadcn, adaptado pra usar nosso
  `theme.ts` em vez de `next-themes`).

Tarefa 9 — Banner key file:
- [src/components/vault/KeyFileBanner.tsx](src/components/vault/KeyFileBanner.tsx)
  aparece no topo do cofre se `lastKeyFilePath` está setado e
  `seenKeyFileBanner[filePath]` ainda não foi marcado. Dialog "Saber
  mais" tem 4 seções (o que é, onde guardar, backup, perdeu = perdeu).

Tarefa 10 — Conectado em [App.tsx](src/App.tsx):
- Switch baseado em `useVaultStore`:
  `kdbx ? VaultLayout : (lastFilePath ? UnlockScreen : OpenCreateScreen)`.
- [src/components/vault/UnlockScreen.tsx](src/components/vault/UnlockScreen.tsx):
  tela de desbloqueio simplificada com arquivo já fixado, key file
  pré-preenchido se memorizado, botão "Voltar para a tela inicial".
- Removidos os callbacks `onCreated`/`onOpened`/`onVaultReady` dos
  componentes — a fonte de verdade passou a ser o store.

Validações automáticas (pré-Tarefa 11):
- `tsc --noEmit`: 0 erros, 0 warnings.
- `cargo check`: 0 erros, 0 warnings (9.4 s incremental).
- `vite build`: 0 erros, CSS 46,84 KB, JS 564,72 KB (sonner+radix
  inflaram um pouco). Aviso sobre chunk > 500 KB que vamos tratar com
  code-splitting na Sessão 4+ se incomodar.

Tarefa 11 — validação manual: a critério do Yuri (Bloco A a F do prompt
da Sessão 3). Sem reporte explícito até o fechamento desta sessão.

---

## 9. Como rodar (dev)

```bash
npm install
npm run tauri dev
```

A primeira execução compila o backend Rust e leva alguns minutos (~3–10 min
dependendo da máquina). Execuções seguintes são rápidas (HMR no front,
recompilação incremental no Rust).

---

## 10. Convenções de commit / PR

A definir com o Yuri quando o repositório for ao GitHub. Decisão provisória
(sessão 2): Conventional Commits em **inglês** (`feat:`, `fix:`, `chore:`,
`docs:`, `refactor:`, `test:`).

---

## 11. Atalhos de teclado

Atalhos ativos quando o cofre está desbloqueado (registrados em
[src/hooks/useGlobalShortcuts.ts](src/hooks/useGlobalShortcuts.ts) e nos
componentes de painel).

| Atalho | Ação |
|---|---|
| `Ctrl+L` | Bloquear cofre (volta para a `UnlockScreen`) |
| `Ctrl+K` | Focar input de busca no header |
| `Ctrl+C` | Copiar senha da entry selecionada com auto-clear (ignora se há texto selecionado ou foco em input) |
| `↑` / `↓` | Navegar grupos (sidebar focada) ou entradas (lista focada) |
| `Esc` | Desfocar elemento atual |

Auto-comportamentos:
- **Auto-lock**: 5 min de inatividade (mousemove com throttle 250 ms,
  keydown, click, scroll, touchstart). Configurável em
  `settings.autoLockMs`. NÃO reseta quando a janela perde foco.
- **Auto-clear de clipboard**: 20 s após copiar senha/usuário/URL/notas.
  Configurável em `settings.clipboardAutoClearMs`. Se o usuário copiou
  outra coisa antes do timeout, mantemos o que ele copiou.
- **Auto-ocultar senha**: 10 s após clicar no olho na tela de detalhe.

---

## 12. Bug do scanner Tailwind 4 — arbitrary `grid-cols` não detectado

**Sintoma:** a classe `grid-cols-[200px_280px_1fr]` no JSX do
[VaultLayout.tsx](src/components/layout/VaultLayout.tsx) NÃO gerou a regra
`grid-template-columns` no CSS final compilado pelo Tailwind 4. Resultado:
o `<div>` continuava `display: grid` mas sem `grid-template-columns`
definido — colunas viraram `auto` e colapsaram para a largura mínima do
conteúdo. Visualmente: as três colunas (sidebar 200px, lista 280px,
detalhe 1fr) sumiram, restando apenas as marcas verticais coloridas dos
avatares (size-8 = 32px) da `EntryList` no canto esquerdo da janela.

**Causa raiz:** o scanner estático do Tailwind 4 falha em detectar
arbitrary values complexos com **múltiplos valores separados por
underscore-como-espaço** quando aparecem como classe direta (sem variant
prefixo). Em testes empíricos durante a investigação, classes mais
complexas dentro de variants compostos (`has-[...]:grid-cols-[auto_1fr]`)
parecem ser detectadas — mas a regra exata do parser não foi confirmada.

**Mitigação adotada (Opção A):** usar `style={{ gridTemplateColumns:
"..." }}` inline para garantir aplicação determinística.

```tsx
<div
  className="flex-1 grid overflow-hidden"
  style={{ gridTemplateColumns: "200px 280px 1fr" }}
>
```

Custo: 1 linha extra. Ganho: zero dependência do detector estático;
funciona deterministicamente em qualquer versão futura do Tailwind.

**Princípio derivado:**

> Para CSS estrutural crítico (layouts), preferir `style` inline sobre
> classes Tailwind arbitrárias. Para CSS de adorno (cores, padding,
> tipografia), classes Tailwind continuam sendo o padrão.

**Bug latente desde a Sessão 3** (quando o `VaultLayout` foi criado).
Descoberto na Sessão 4 quando o layout foi exercitado por usuário humano
pela primeira vez — Tarefa 11 da Sessão 3 ficou em "modo de espera" e o
Yuri fechou a janela sem testar criar/abrir cofre, então o `VaultLayout`
nunca tinha sido renderizado de fato.

**Ônus de manutenção futuro:** ao introduzir classes Tailwind arbitrárias
**estruturais** (que afetam layout principal, não adorno), validar que a
regra apareceu no CSS gerado:

```bash
npx vite build
grep -E "<sua-regra-esperada>" dist/assets/index-*.css
```

Se vazio, trocar por `style` inline.

**Auditoria de outros usos arbitrários (Sessão 4):**
- ✅ Sizing simples (`max-w-[440px]`, `h-[calc(...)]`, `ring-[3px]`,
  etc.): detectados sem problema.
- ⚠️ 3 ocorrências em componentes shadcn (`alert.tsx`, `card.tsx`) usam
  o padrão `has-...:grid-cols-[auto_1fr]` dentro de variants
  condicionais. Visualmente OK no estado atual (OpenCreateScreen
  renderiza Card sem regressão), mas marcado como dívida latente para
  investigação se algum bug visual aparecer nesses componentes no
  futuro.

---

## 13. Identidade visual (logo)

O logo do Sec.Basis foi escolhido fora desta sessão e versionado em
[assets/secbasis-icon-1024.png](assets/secbasis-icon-1024.png) como fonte
imutável (1024×1024, RGBA). Os ícones derivados (Windows `.ico`, macOS
`.icns`, PNGs Microsoft Store, mipmaps Android, AppIcons iOS) ficam em
[src-tauri/icons/](src-tauri/icons/) e são gerados automaticamente:

```bash
npx @tauri-apps/cli icon assets/secbasis-icon-1024.png
```

**Conceito visual:** três pontos brancos centralizados sobre gradiente
diagonal turquesa (`--brand-primary` `#4EB1D9`) → lavanda
(`--brand-tertiary` `#C9CBF2`), cantos arredondados estilo iOS. Usa a
paleta cravada da marca, sem cores estranhas ao sistema.

Para regerar (após alterar o PNG fonte): rodar o comando acima e
commitar `src-tauri/icons/` junto com o novo `assets/`. NÃO editar
arquivos individuais em `src-tauri/icons/` à mão.

---

## 14. Histórico Git e marcos

Repositório público: <https://github.com/yurimundin/secbasis>

| Hash | Tipo | Mensagem |
|---|---|---|
| `8de660f` | chore | initial scaffolding — tauri v2 + react + tailwind + kdbxweb |
| `995428a` | feat | argon2, key file support, vault layout and security tooling |
| `e5a3c02` | chore | add app icon, security policy and contribution guide |

Política de histórico: **NUNCA reescrever** (rebase/squash/force-push) o
ramo `main`. Se um commit precisar ser corrigido, criar um novo commit
de correção.

**Marcos atingidos:**

- ✅ Sessão 1: scaffold Tauri + React + dependências base
- ✅ Sessão 2: Argon2 nativo (Rust) + tema + UI de criar/abrir cofre
- ✅ Sessão 2.5: build de release validado (Argon2 ~100ms, MSI 3,4 MB)
- ✅ Sessão 3: tela de cofre aberto (3 painéis, auto-lock, auto-clear,
  atalhos, key file com memória por cofre, banner informativo)
- ✅ Sessão 3 adendo: ícone definitivo + arquivos meta (SECURITY,
  CONTRIBUTING, .gitattributes) + 3 commits no GitHub público

**Próximo:** Sessão 4 — CRUD de entradas (criar/editar/remover), busca
real (placeholder do Ctrl+K já existe), gerador de senhas standalone,
e drag-and-drop entre grupos.

---

## 15. Selectors do Zustand e mutações in-place do kdbxweb

**Regra fundamental:** selectors do Zustand devem retornar **primitivos
ou referências estáveis**. NUNCA criar `array`/`object` novo dentro do
selector.

### Por que

Zustand notifica re-render quando o resultado do selector muda
**comparado com `Object.is`**. Como `Object.is(a, b)` é `false` para
arrays/objetos diferentes (mesmo com conteúdo idêntico), criar `[]`/`{}`
inline no selector dispara loop infinito do `useSyncExternalStore`:

```
selector roda → cria array novo → Object.is === false →
  Zustand re-renderiza → selector roda → cria array novo → ... ∞
```

Sintoma típico: console mostra `"The result of getSnapshot should be
cached to avoid an infinite loop"` + `"Maximum update depth exceeded"`,
e o componente afetado renderiza tela vazia (React aborta árvore).

### Padrões corretos

**Opção A (preferida) — `useMemo` no consumidor (ou no hook wrapper):**
o selector retorna apenas o "raw state" (ref/primitivo); a derivação
acontece em `useMemo`.

```ts
export function useTopLevelGroups(): KdbxGroup[] {
  const kdbx = useVaultStore((s) => s.kdbx);
  const vaultVersion = useVaultStore((s) => s.vaultVersion);
  return useMemo(() => {
    if (!kdbx) return [];
    const root = kdbx.getDefaultGroup();
    return [root, ...root.groups];
  }, [kdbx, vaultVersion]);
}
```

**Opção B — `useShallow`** (de `zustand/shallow`): faz comparação
shallow no resultado do selector. Útil quando você precisa de um
objeto/array com várias chaves do state:

```ts
import { useShallow } from "zustand/shallow";
const { a, b, c } = useVaultStore(useShallow((s) => ({
  a: s.a, b: s.b, c: s.c
})));
```

**Opção C — retornar primitivo**: para hooks que são "consultas
booleanas" (`useIsLocked`, `useHasUnsavedChanges`), sempre derivar para
`boolean`/`string`/`number` e retornar isso. Comparação com `Object.is`
estabiliza naturalmente.

### `vaultVersion` — invalidação para mutações in-place

A `kdbxweb` muta o `Kdbx` **in-place** (`entry.fields.set(...)`,
`group.entries.push(...)`, `db.move(...)`, `db.createEntry(...)`). A
referência do objeto `kdbx` NÃO muda, então `useMemo([kdbx])` não
invalida e a UI não reflete a mutação.

**Solução:** contador `vaultVersion: number` no store, incrementado
após **cada mutação**. Selectors que derivam de dentro do kdbx dependem
de `[kdbx, vaultVersion]` no `useMemo`.

```ts
// Na mutação:
entry.fields.set("Title", "Novo título");
useVaultStore.getState().incrementVaultVersion();
```

**Princípio derivado:** APIs da `kdbxweb` são imperativas e mutáveis,
mas a UI do Sec.Basis é reativa via `vaultVersion`. Toda função que
mexe no kdbx deve responsabilizar-se por incrementar o contador antes
de retornar.

### Histórico do bug

- **Origem:** Sessão 3, criação do `vault.ts`. `useTopLevelGroups`
  retornava `[root, ...root.groups]` inline; `useEntriesOfCurrentGroup`
  retornava `group?.entries ?? []` (criava `[]` novo no fallback).
- **Latente:** todo o fluxo do `VaultLayout` na Sessão 3 — Tarefa 11
  ficou em "modo de espera" e a janela foi fechada sem o Yuri criar/
  abrir cofre real, então o `VaultLayout` nunca renderizou de verdade.
- **Descoberta:** Sessão 4, ao exercitar o `VaultLayout` fim-a-fim
  durante validação visual da Tarefa 3 — `GroupSidebar` lançou
  `Maximum update depth exceeded` e a árvore React abortou para tela
  vazia.
- **Mitigação:** refatoração descrita acima + introdução de
  `vaultVersion` como infra para Tarefas 6/7 da Sessão 4.

---

## 16. Regra de validação visual obrigatória

Toda sessão que cria ou altera componentes de UI **deve terminar com
validação visual humana** antes de fechar. Não é opcional, não é "fica
para depois", não é "valido na próxima sessão".

**Razões:**

- Bugs estruturais de layout não aparecem em `tsc --noEmit`,
  `cargo check`, ou `vite build`.
- Erros de runtime React só aparecem no DevTools do webview, não no
  stdout do `tauri dev`.
- Selectors mal-formados causam loops invisíveis para análise estática.

Se o usuário humano fechar a sessão sem validar visualmente, registrar
como "validação pendente" abaixo, e a próxima sessão DEVE começar
fazendo essa validação antes de qualquer trabalho novo.

### Histórico de validações pendentes

- **Sessão 3, Tarefa 11:** validação visual fechada sem completar. Yuri
  fechou a janela sem testar criar/abrir cofre real. Consequência: dois
  bugs estruturais ficaram latentes e só foram descobertos na Sessão 4
  ao exercitar o `VaultLayout` fim-a-fim:
  1. Bug do scanner Tailwind 4 com `grid-cols-[200px_280px_1fr]` —
     resolvido com `style` inline (ver §12).
  2. Loop infinito por selectors do Zustand retornando arrays novos —
     resolvido com `useMemo` + `vaultVersion` (ver §15).
