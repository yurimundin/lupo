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

**Identifier do app (Tauri / Microsoft Store):** `app.basis.sec`
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
- [ ] Sidebar de grupos com hierarquia recursiva, ordenação alfabética,
      Lixeira sempre no fim, e personalização visual por ícone/cor.
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
  Ctrl+L / Ctrl+F / Ctrl+C (entry sel.) / Esc.
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
| `Ctrl+F` | Focar input de busca no header |
| `Ctrl+C` | Copiar senha da entry selecionada com auto-clear (ignora se há texto selecionado ou foco em input) |
| `Ctrl+E` | Entrar em modo edit na entry selecionada (em modo view, fora da Lixeira) |
| `Ctrl+S` | Salvar (em modo edit/create — wire-up em [src/hooks/useCommitEdit.ts](src/hooks/useCommitEdit.ts)) |
| `Delete` | Mover entry selecionada para a Lixeira (com confirmação). Ignorado se foco está em campo editável (input/textarea/contenteditable) |
| `↑` / `↓` | Navegar grupos (sidebar focada) ou entradas (lista focada) |
| `Esc` | Desfocar elemento atual (em modo view); cancelar edição com confirmação se dirty (em modo edit/create) |

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

| Hash | Tipo | Descrição |
|---|---|---|
| `7e538e9` | chore+refactor | bump typescript 5.8 → 6.0 + remove deprecated baseUrl + fix 2 strictness regressions (S28a) |
| `7b5d7ef` | chore+refactor | bump eslint 9 → 10, react-hooks 5 → 7 + fix 6 set-state-in-effect + 3 preserve-caught-error (S28b) |
| `32a9685` | chore(deps-dev) | bump vite 7.0.4 → 8.0.14 + @vitejs/plugin-react 4.6 → 6.0.2 (S28c) |
| `55d72b9` | chore(deps-dev) | bump globals 15 → 17, eslint-plugin-react-refresh 0.4 → 0.5, typescript-eslint patch (S28d) |
| `fb953ae` | feat(vault) | restore group from Recycle Bin via right-click context menu (S29) |
| `0cafce8` | docs | correct S23 entry in §14 — alpha release delivered, not deferred (S28) |
| `8a20528` | chore(deps) | bump lucide-react from 1.14.0 to 1.16.0 (#15) |
| `2d07074` | chore(deps) | bump tauri from 2.11.1 to 2.11.2 (#13) |
| `a6edbd2` | chore(deps) | bump tauri-build from 2.6.1 to 2.6.2 (#12) |
| `176e4a7` | chore(deps) | bump qs from 6.15.1 to 6.15.2 (#16) |
| `288f702` | chore(deps) | bump brace-expansion from 5.0.5 to 5.0.6 (#11) |
| `766607c` | docs+chore | align §14 + remove next-themes + cherry-pick patches (S27) |
| `038b4fa` | chore(deps) | bump @tailwindcss/vite from 4.2.4 to 4.3.0 (#9) |
| `22a4ba6` | chore(deps) | bump tailwindcss from 4.2.4 to 4.3.0 (#7) |
| `3c85a22` | chore(deps) | bump react from 19.2.5 to 19.2.6 (#8) |
| `1b26389` | chore(deps) | bump tailwind-merge from 3.5.0 to 3.6.0 (#10) |
| `70e1e23` | feat(vault) | add right-click context menu for groups (S26) |
| `24246fa` | feat(vault) | add groundwork for group rename/delete (S25 partial) |
| `ad8e79e` | feat(vault) | add "Criar pasta nova" via "+" button in sidebar header (S24) |
| `0f46473` | docs | align CLAUDE.md §14 + §28 reinforce through Session 22 (S22 hk) |
| `5a117de` | chore | bump tauri from 2.11.0 to 2.11.1 in /src-tauri (S22 Bloco 3) |
| `bdad9f7` | chore | bump hono from 4.12.16 to 4.12.18 (S22 Bloco 2) |
| `87929b3` | chore | bump fast-uri from 3.1.1 to 3.1.2 (S22 Bloco 1) |
| `062b4c1` | feat(ui) | add "Powered by BasisApp" footer in sidebar + extract openExternalSafe (S21 Bloco 2) |
| `8e23aac` | docs | align CLAUDE.md §14 with project state through Session 20 (S21 Bloco 1) |
| `69def18` | feat | adopt hi-fi mockup design — theme toggle, semantic selected tokens, header polish (S20) |
| `6286099` | build | configure tauri for alpha .exe-only distribution (S19 Bloco 4) |
| `f905e8b` | fix | implement in-memory rollback in trash operations — move + restore (S19 Bloco 3) |
| `1e95381` | perf | code-split bundle into vendor chunks via manualChunks (S19 Bloco 2) |
| `9725abc` | docs | align CLAUDE.md §14 with project state through Session 18 (S19 Bloco 1) |
| `15b30d4` | chore | add ESLint with flat config + audit existing eslint-disable comments (S18) |
| `fc0e708` | docs | align README and CLAUDE.md §14 with project state through Session 17 (S17.5) |
| `77e5712` | feat | real-time search across all entries (S17) |
| `ba813a0` | docs | document Windows packaging strategic plan (CLAUDE.md §32) (S16) |
| `6a363df` | docs | document Smart App Control / MOTW gotcha for Tauri (CLAUDE.md §31) (S15) |
| `6c75758` | docs | align CLAUDE.md §14 with project state through Session 14 (S14.5) |
| `2575be6` | docs | document devDependency vulnerability process (CLAUDE.md §30) (S14) |
| `a61cb31` | chore | add basic CI workflow (GitHub Actions with tsc + cargo check) (S13) |
| `3831767` | docs | document Dependabot stale PR lesson (CLAUDE.md §28) (S12) |
| `48d084e` | feat | expandable subgroups in sidebar with persistent state (S11) |
| `7d7ba75` | docs | align CLAUDE.md §14 and README with project state through Session 10 (S10.5) |
| `d2cc329` | docs | document smoke test gating strategy (CLAUDE.md §26) (S10 Tarefa C) |
| `8d79212` | chore | update zustand and shadcn to latest patch/minor (S10 Tarefa B) |
| `f9aedcc` | chore | sync Cargo.toml version with project manifests (0.1.0-alpha) (S9 hk) |
| `3082075` | chore | sync package-lock.json version with package.json (0.1.0-alpha) (S9 hk) |
| `2800448` | docs | document Linux-only transitive vulnerability analysis (CLAUDE.md §25) (S9) |
| `a08f14f` | feat | redesign unlock screen + auto-open last vault (S8) |
| `05e6ef1` | feat | add SemVer versioning and About dialog (S7) |
| `47a82fb` | docs | close Session 5 deliverables (stale text, history, roadmap) (S6) |
| `a762eb3` | feat | polish recycle bin UX (i18n + empty state) (Tarefa 3 da S5) |
| `e36c275` | feat | empty recycle bin (hard-delete all trashed entries) (Tarefa 2) |
| `8e741ae` | feat | restore entries from recycle bin (Tarefa 1 da S5) |
| `caffd14` | chore | add dependabot config for npm, cargo and github-actions (S4.5 B3) |
| `8147e45` | docs | change distribution strategy from Microsoft Store to direct download (S4.5 B2-final) |
| `2282553` | docs | fix broken clone instructions in README |
| `954e330` | feat | soft-delete entries via KDBX recycle bin (Tarefa 7) |
| `dafbb53` | feat | wire commitEdit to Save button with dirty-state guards (Tarefa 6) |
| `9450100` | feat | atomic save with backup for existing vault files (Tarefa 5) |
| `129d8be` | feat | cryptographic password generator with popover UI (Tarefa 4) |
| `124e065` | feat | entry editor with edit/create modes and confirmation dialog (T1-3) |
| `92097a1` | fix | prevent infinite loop in vault selectors and broken grid layout |
| `ad2e926` | revert | temporarily remove security.txt reference until file is uploaded |
| `16afd0a` | security | replace email placeholder and reference security.txt |
| `837f281` | security | replace email placeholder with security@basis.app.br |
| `5464c01` | docs | reference commits and milestones in CLAUDE.md |
| `e5a3c02` | chore | add app icon, security policy and contribution guide |
| `995428a` | feat | argon2, key file support, vault layout and security tooling |
| `8de660f` | chore | initial scaffolding — tauri v2 + react + tailwind + kdbxweb |

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
- ✅ **Sessão 3.5** (`837f281`): e-mail oficial de segurança configurado
  em `security@basis.app.br`
- ✅ **Sessão 3.6** (`ad2e926`): referência ao security.txt removida
  temporariamente (arquivo não está hospedado)
- ✅ **Sessão 4 — MVP funcional do CRUD completo:**
  - Tarefas 1-3 (`124e065`): editor de entradas com modo view/edit/create
    + confirm dialog
  - Bug fix (`92097a1`): loop infinito em vault selectors + grid layout
    do Tailwind 4
  - Tarefa 4 (`129d8be`): gerador criptográfico de senhas em popover
  - Tarefa 5 (`9450100`): save atômico com backup `.kdbx.bak` (validado
    fim-a-fim com KeePassXC)
  - Tarefa 6 (`dafbb53`): wire-up do save no botão Salvar + dirty guards
    em 4 cenários
  - Tarefa 7 (`954e330`): soft-delete via Recycle Bin compatível com
    KeePassXC
- ✅ **Sessão 4.5 Bloco 1** (`2282553`): correção de instruções de clone
  no README
- ✅ **Sessão 4.5 Bloco 2** (`32701da` + `8147e45`): atualização ampla
  da documentação (README, CLAUDE.md §14, CONTRIBUTING.md L22) e
  decisão de estratégia de distribuição (KeePass-style direct download
  via site oficial, sem Microsoft Store).
- ✅ **Sessão 4.5 Bloco 3** (`caffd14` + GitHub UI): governança do
  repositório configurada — Dependabot (versionado em `caffd14`),
  branch protection rule, secret scanning + push protection, topics +
  description, workflow permissions read-only (essas últimas via
  GitHub UI, não-versionadas).
- ✅ **Sessão 5 — Ciclo de vida completo da Lixeira:**
  - Tarefa 1 (`8e741ae`): restaurar entry da Lixeira para grupo raiz
  - Tarefa 2 (`e36c275`): esvaziar Lixeira com confirmação + lembrete
    de backup. Bug do `kdbx.remove()` documentado em §21 (não é
    hard-delete quando `recycleBinEnabled=true`; correto é
    `kdbx.move(entry, undefined)`)
  - Tarefa 3 (`a762eb3`): polimento UX (i18n "Recycle Bin" → "Lixeira"
    em renderização, estado vazio educativo)
- ✅ **Sessão 6 — Encerramento** (`47a82fb`): limpeza de dívidas
  documentais (texto stale em `useDeleteEntry.ts`, atualização do §14
  com marcos das Sessões 4.5 e 5, atualização do Roadmap Fase 1 do
  README com ciclo de vida da Lixeira).
- ✅ **Sessão 7 — Versionamento e tela About** (`05e6ef1`):
  - SemVer adotado: `MAJOR.MINOR.PATCH[-pre-release]`, versão atual
    `0.1.0-alpha`. Source of truth: `tauri.conf.json`.
  - Tela About acessível via botão Info no header (logo + título +
    versão + descrição + 3 links + Fechar).
  - Hook `useAppVersion()` lê via Tauri API.
  - Documentação em §23.
- ✅ **Sessão 8 — Redesign tela de unlock + auto-open último cofre**
  (`a08f14f`):
  - Logo Sec.Basis 96px substitui ícone de cadeado pequeno.
  - Hierarquia visual: logo → título → tagline → card → footer.
  - Sistema de espaçamento Tailwind (`gap-2/4/6/8`, `p-8`).
  - Auto-open: pré-preenche path do último cofre via
    `lastOpenedVaultPath` em `useSettingsStore` (localStorage). Senha
    mestra SEMPRE exigida (segurança).
  - Fallback silencioso: se arquivo sumiu, cai em OpenCreateScreen.
  - Documentação em §24.
- ✅ **Sessão 9 — Análise + dispensa de Dependabot alert** (`2800448`):
  - Vulnerability moderada em `glib < 0.20.0` (memory safety,
    NULL pointer dereference em `VariantStrIter::impl_get`).
  - Investigação via `cargo tree --target x86_64-pc-windows-msvc`
    confirmou que glib é dependência Linux-only (gtk + webkit2gtk +
    wry stack) e NÃO está no binário Windows.
  - Alerta dispensado no GitHub como "Risk tolerable" com referência
    a §25 do CLAUDE.md (que estabelece processo para vulnerabilidades
    transitivas Linux-only).
  - Setup de máquina nova Windows (Build Tools + Rust + Tauri) também
    foi parte desta sessão.
- ✅ **Sessão 9.5 — Housekeeping pós-Sessão 9** (`3082075` + `f9aedcc`):
  - Sync `package-lock.json` para `0.1.0-alpha` (capturado por
    `npm install` em máquina nova; Sessão 7 deixou inconsistência).
  - Sync `Cargo.toml` para `0.1.0-alpha` (TODO flagged na Sessão 7).
  - Convenção de commit cravada: SEM trailer `Co-Authored-By`.
- ✅ **Sessão 10 — Updates de dependências + documentação smoke test**
  (`8d79212` + `d2cc329`):
  - zustand 5.0.12 → 5.0.13 (patch — bug fixes).
  - shadcn 4.6.0 → 4.7.0 (CLI tool minor; componentes vendorizados
    em `src/components/ui/` inalterados).
  - Migração do projeto de `Downloads/` para `C:\dev\secbasis` (Smart
    App Control bloqueava error 4551 em pastas com Mark-of-the-Web).
  - Documentação do smoke test em §26 (gating strategy via
    `import.meta.env.DEV` + dynamic import para tree-shaking).
  - Lição operacional registrada: investigar antes de marcar dívida
    técnica (Sessão 9 tinha flagged smoke test como "cleanup TODO"
    sem investigar; Sessão 10 confirmou que arquitetura estava sólida).
- ✅ **Sessão 10.5 — Housekeeping documental** (`7d7ba75`):
  - §14 atualizado com 8 commits acumulados (Sessões 6-10) e 6 marcos
    correspondentes — encerrou drift de 4 sessões desde `47a82fb` (S6).
  - Notação dos headings padronizada: §25 e §26 reformatados de
    `## §N — Título` para `## N. Título` (alinhamento com §1-§24).
  - README Fase 1: adicionados como ✅ Auto-open (S8) e Tela Sobre (S7).
- ✅ **Sessão 11 — Subgrupos expansíveis na sidebar** (`48d084e`):
  - Sidebar renderiza hierarquia KDBX recursivamente (antes só
    mostrava filhos diretos do grupo raiz).
  - Hook `useGroupTree()` em `vault.ts` com `useMemo` + selectors
    atômicos (padrão §15 — sem loops de re-render).
  - Componente `<GroupTreeItem />` recursivo com 2 botões separados
    (chevron + nome) — sem `stopPropagation`, mais acessível.
  - Persistência: `expandedGroupsByVault` em `useSettingsStore`
    (localStorage por vaultPath).
  - Indentação: 12px por nível, satura em 96px após nível 8 (estilo
    VS Code).
  - Root sempre expandido sem chevron (`forceExpanded` baseado em
    `parentUuid === null`).
  - Keyboard nav recursiva: setas ↑↓ navegam visíveis, → expande,
    ← colapsa ou sobe pro pai (estilo VS Code Explorer).
  - Documentação em §27.
- ✅ **Sessão 12 — PR stale do Dependabot + lição §28** (`3831767`):
  - Investigação revelou que PR `dev-dependencies-2f25c8d3ab` estava
    baseado em commit `caffd14` (Sessão 4.5), 15 commits behind main.
  - Mergear via "Squash and merge" do GitHub UI teria silenciosamente
    deletado ~25 arquivos das Sessões 5-11.
  - PR fechado no GitHub para Dependabot reabrir em base limpa.
  - §28 documenta processo de verificação de PRs stale + decisão de
    "fechar PR stale" como caminho padrão.
- ✅ **Sessão 13 — CI básico GitHub Actions** (`a61cb31`):
  - `.github/workflows/ci.yml` com 2 jobs paralelos: TypeScript
    (`tsc --noEmit`) e Rust (`cargo check --all-targets`).
  - Trigger: push em `main` + pull_request em `main`.
  - Ubuntu runner com Linux deps de Tauri (`libwebkit2gtk-4.1-dev`,
    `libayatana-appindicator3-dev`, `librsvg2-dev`, `libxdo-dev`,
    `libssl-dev`, `patchelf`).
  - Cache: npm built-in via `setup-node` + cargo via
    `Swatinem/rust-cache@v2`.
  - Branch protection NÃO ativada inicialmente (validar 1-2 semanas
    primeiro, depois ativar).
  - Documentação em §29.
- ✅ **Sessão 14 — DevDep vulnerability + lição §30** (`2575be6`):
  - Erro do Dependabot npm job investigado: GHSA em
    `ip-address < 10.1.1` (XSS em `Address6.group/link/parseMessage`).
  - Cadeia: `shadcn` (devDep) → `express-rate-limit` → `ip-address`.
  - Vulnerability não é alcançável em runtime do Sec.Basis (devDep,
    CLI scaffolding, código vulnerável é dead code per upstream).
  - Alerta dispensado no GitHub como "Risk tolerable".
  - §30 estabelece framework de 4 critérios para avaliação de
    vulnerabilidades em devDependencies — distinto do critério §25
    (Linux-only, target de build) por ser fase de ciclo de vida (dev).
- ✅ **Sessão 15 — Smart App Control gotcha + housekeeping documental
  + lição §31** (`6a363df` + `6c75758`):
  - Erro `os error 4551` em `tauri dev` rastreado até Smart App Control
    (SAC) bloqueando build-scripts e o próprio `secbasis.exe` quando
    pasta do projeto está em `Downloads/` (Mark-of-the-Web).
  - Workaround: mover projeto para `C:\dev\` ou path equivalente fora
    de pastas com MOTW; alternativa é exclusão de Defender + aprovação
    via Explorer do `.exe` final (SmartScreen).
  - `6c75758` alinhou §14 com S14 (drift de 4 commits acumulado).
  - §31 documenta o gotcha completo + caminhos de mitigação.
- ✅ **Sessão 16 — Empacotamento Windows planejamento estratégico**
  (`ba813a0`):
  - §32 documenta plano estratégico para empacotamento + distribuição
    Windows (instalador .msi/.exe via site oficial), incluindo escopo
    de assinatura digital e SmartScreen reputation.
  - Sessão de planejamento — implementação fica para sessão futura
    dedicada (item 🚧 ainda no Roadmap Fase 1).
- ✅ **Sessão 17 — Busca em tempo real cross-group + revogação
  consciente de §11** (`77e5712`):
  - Busca em tempo real implementada no `VaultHeader` (input antes
    placeholder desde S3): substring case-insensitive em Title +
    UserName + URL + Notes, cross-group excluindo Lixeira.
  - `searchQuery` no Zustand store (siblings VaultHeader↔EntryList
    precisam compartilhar). Reset em lock/unlock/setVault/reset.
  - Novos helpers em `entry-helpers.ts`: `getGroupPath`,
    `matchesSearch`, `highlightMatch`. Novo selector `useAllEntries`
    em `vault.ts`. Novos componentes `SearchInput.tsx` e
    `EmptySearchResults.tsx`.
  - Atalho `Ctrl+K` (documentado em §11) **revogado conscientemente**
    em favor de `Ctrl+F` — alinhamento com KeePassXC e
    browsers/editors. ID `vault-search-input` preservado como contrato
    estável; §8 e §11 atualizados nesta mesma sessão.
  - Implementação em 4 fases (S17 inicial: input local na EntryList +
    Ctrl+F local) refatorada em 3 fases (R1: state pro store; R2:
    input pro VaultHeader; R3: shortcut centralizado em
    `useGlobalShortcuts`) após smoke test revelar input morto
    paralelo no header. 1 commit consolidado.
- ✅ **Sessão 18 — ESLint setup com flat config + audit de
  eslint-disable comments** (`15b30d4`):
  - ESLint 9.x configurado com flat config (typescript-eslint +
    react-hooks + react-refresh)
  - 3º job paralelo no CI (typescript + lint + rust)
  - Strict mode (`--max-warnings=0`) — qualquer warning falha o lint
  - Override shadcn para `src/components/ui/**` (cva variants
    exportadas com componente são padrão upstream)
  - 6 supressões documentadas em §33 (5 em `vault.ts` para
    `vaultVersion` cache-buster §15 + 1 em `CreateVaultTab.tsx`
    para sanitização de filename)
  - Auditoria descobriu 4 disables órfãos pré-existentes (sem
    ESLint instalado, sem efeito real) — 2 removidos como
    "Unused eslint-disable directive", 2 mantidos (suprimiam
    regras reais)
  - Convenção de supressão cravada: comentário explicativo acima
    + disable nu (sintaxe `rule -- reason` inline não funciona no
    ESLint vanilla — texto após disable é parsed como nome de regra)
- ✅ **Sessão 19 — Quality + alpha distribution prep** (4 commits):
  - **Bloco 1** (`9725abc`) — housekeeping documental: §14 atualizada
    com S18 + S17.5; Defender exclusion removida (SAC + Kaspersky
    aprenderam reputation, proteção máxima restaurada)
  - **Bloco 2** (`1e95381`) — code-splitting via `manualChunks`:
    bundle dividido em 4 chunks (crypto/react/ui-vendor/index),
    maior chunk reduzido de 658 KB → 203 KB (-69%), warning Vite
    "chunks > 500 KB" resolvido. Estratégia: função em vez de objeto
    para pegar `radix-ui` meta-package + `@radix-ui/*` transitivos.
    Trade-off Tauri offline-first documentado (ganho marginal vs web
    pública, mas reduz parse time no boot e melhora build observability)
  - **Bloco 3** (`f905e8b`) — rollback in-memory em operações de
    Lixeira (TODO Sessão 6 fechado parcialmente): `moveEntryToRecycleBin`
    e `restoreEntryFromRecycleBin` agora revertem a mutação in-place
    quando `saveVault` falha. Padrão: snapshot `entry.parentGroup`
    antes do `kdbx.move`, revert no caminho de erro com defesa
    `if (originalParent)`. Edge case Lixeira recém-criada documentado
    como aceito (kdbxweb sem `destroyRecycleBin`, estado válido KDBX).
    `emptyRecycleBin` permanece sem rollback (kdbxweb tombstone API
    requer pesquisa, sessão futura)
  - **Bloco 4** (`6286099`) — alpha .exe-only Windows distribution:
    `identifier` mudou de `com.secbasis.app` (placeholder) para
    `app.basis.sec` (reverse-DNS de `basis.app.br`); `bundle.targets`
    cravado em `["msi"]` para uso futuro; `bundle.active: false`
    desativa bundling MSI (que rejeita pre-release SemVer `-alpha`),
    `tauri build` agora produz só `secbasis.exe` 12 MB. Para reativar
    bundling no 1.0+: bump SemVer para versão numérica e flip
    `active: true`
- ✅ **Sessão 20 — Adoção visual completa do mockup hi-fi** (`69def18`):
  - `ThemeToggle` novo: toggle light/dark via `lib/theme.ts` próprio
    + `MutationObserver` (sistema standalone, não usa `next-themes`)
  - Tokens semânticos S20 em `App.css`: `--selected-bg`, `--selected-fg`,
    `--brand-primary/accent/tertiary/soft`, com overrides em `.dark`
  - `VaultLayout` grid: 220px / 300px / 1fr (era 200/280)
  - `VaultHeader` polish: posição do `ThemeToggle`, AutoLockIndicator pill
  - `GroupTreeItem` adotou tokens selected (`bg-selected`, `text-selected-foreground`)
  - 7 arquivos, +131/-27
  - Pendência limpável identificada: `next-themes` é dead dep
    (importado em zero arquivos TS, presente em deps por scaffolding shadcn antigo)
- ✅ **Sessão 21 — Powered by BasisApp + housekeeping S20** (2 commits):
  - **Bloco 1** (`8e23aac`) — housekeeping documental (drift completo,
    opção b): §14 atualizada com S19 (4 sub-bullets) + S20 (6 sub-bullets);
    pointer "Próximo" atualizado para S21 com plano explícito;
    `next-themes` flagged como dead dep limpável
  - **Bloco 2** (`062b4c1`) — Powered by BasisApp + refactor
    `openExternalSafe`: footer de branding na sidebar (`text-xs
    text-muted-foreground` linkando `sec.basis.app.br`); helper
    `openExternalSafe` extraído de AboutDialog (S7) + EntryDetail
    (S4) + componente novo S21 para `src/lib/external.ts`
    (eliminou 3-way duplication); GroupSidebar restruturado para
    flex column com footer fixo (PoweredByBasis como último filho,
    pushed to bottom by flex-1 wrapper)
  - Decisões UX: sidebar bottom (não window footer ou About);
    text-muted-foreground (não badge); click abre browser (não
    dialog interno); URL `sec.basis.app.br` (não basis.app.br raiz)
- ✅ **Sessão 22 — Dependabot maintenance + cleanup**:
  - Alert #3 (ip-address) dispensado via UI (mesma cadeia §30,
    GHSA-v2v4-37r5-5v8g re-fired após GHSA range update)
  - 3 PRs Dependabot mergeados:
    - **fast-uri 3.1.2** (`87929b3`) — high severity resolved.
      PR fresh em base atualizada, merge cirúrgico via squash.
      Cadeia transitiva: shadcn → @modelcontextprotocol/sdk →
      ajv → fast-uri (devDep dev-time only, §30 framework aplica)
    - **hono 4.12.18** (`bdad9f7`) — 3 GHSAs moderate resolved.
      PR stale 1 commit (iria reverter fast-uri 3.1.2 acabado de
      mergear — catch crítico). Resolvido via `@dependabot rebase`
      + merge pós-rebase
    - **tauri 2.11.1** (`5a117de`) — Cargo patch bump.
      PR stale 4 commits (iria deletar PoweredByBasis, external.ts,
      marcos S19+S20+S21, e reverter fast-uri+hono — catch crítico).
      Resolvido via `@dependabot rebase` + merge pós-rebase.
      Cleanup natural Cargo: phf 0.11 → 0.13 unificada
  - 1 PR fechado: `dev-dependencies-2f25c8d3ab` (stale 33 commits
    behind, 3 majors perigosos: plugin-react 4→6, vite 7→8, ts 5→6.
    Mesma branch fechada em S12, agora pior. Major bumps são
    sessões dedicadas conforme §14 pointer)
  - 4 catches críticos consolidados em §28 (reforço S22)
  - Audit pós-S22: 2 moderate (ip-address + express-rate-limit,
    ambas §30 dispensadas conscientemente)
- ✅ **Sessão 23 — Alpha distributable for testers** (`v0.1.0-alpha`):
  - Build fresh do `secbasis.exe` (12 MB, compilado de `0f46473`).
    Build feito em Downloads/ no MundinLenovo (§31 trade-off aceito
    conscientemente — SAC reputation já estabelecida de builds
    anteriores, MOTW risco documentado).
  - ZIP profissional `Sec.Basis-0.1.0-alpha-windows-x64.zip` (3.85 MB,
    compressão 67%) com 4 arquivos: secbasis.exe + LEIAME.txt (89 linhas
    PT-BR com instruções SmartScreen) + LICENSE MIT + checksum.sha256.
  - Tag git anotada `v0.1.0-alpha` apontando `0f46473` (S22 fechamento).
    Tag é objeto separado (`60992f7`) — comportamento normal para
    annotated tags.
  - GitHub Release com pre-release flag marcada (alpha não aparece como
    "latest"). Release notes em PT-BR: audiência, instalação, SmartScreen
    warning, hashes SHA256, limitações, feedback channels.
  - Hashes para verificação:
    ZIP: `ab7d4992ca0e692ce2cee1f018dff6ddd8e931f3d21d09b24990801e94df8606`
    .exe: `563771dcc26cc86fd780d3fabe2f792d44f7ece244b081dcd93ca3b1f58a38c8`
  - Smoke flow 10 fases como tester real (download incógnita + extract +
    run + SmartScreen + criar cofre teste) — passou todas as fases.
  - Release URL: https://github.com/yurimundin/secbasis/releases/tag/v0.1.0-alpha
  - Audiência: 1-3 testers conhecidos. Distribuição mais ampla aguarda
    versão 1.0+ com assinatura digital (§32).
- ✅ **Sessão 24 — Criar pasta nova via botão "+" no header** (`ad8e79e`):
  - Header novo no GroupSidebar com label "Grupos" + botão "+"
    (variant ghost, size icon, ícone Plus do lucide-react)
  - `NewGroupDialog.tsx` componente novo: validações em tempo real
    (não-vazio após trim, max 64 chars, sem duplicata case-insensitive
    entre siblings); Enter submete; Esc cancela; reset on open;
    `parentIsRoot` controla se exibe "Subgrupo de:"
  - `useCreateGroup.ts` hook novo seguindo padrão §15: selectors
    atômicos + useCallback; toast verde/vermelho; incrementVaultVersion;
    selectGroup(newUuid) para feedback visual
  - `createGroupInVault` em `lib/kdbx.ts`: rollback in-memory padrão
    §19 Bloco 3 (remove o grupo recém-criado de parent.groups se save
    falhar); `kdbx.createGroup(parent, name)` mutação in-place
  - "+" disabled quando grupo selecionado é (ou descende de) Lixeira
    via walk-up `parentGroup.uuid.id === recycleBinUuidId`
  - Auto-expand do parent após sucesso (UX: usuário precisa ver o
    filho recém-criado)
  - Fecha Bloco 3 da S21 — pendência aberta há 3 sessões.
- ✅ **Sessão 25 — Groundwork rename/delete de grupos** (`24246fa`):
  - Foundation para context menu (UI vem na S26). 4 arquivos novos +
    1 modificado, +601 linhas.
  - `src/components/ui/context-menu.tsx` — shadcn ContextMenu
    scaffoldado via `npx shadcn add context-menu` (15 exports, sem
    dep direta — usa `radix-ui` meta-package transitivo)
  - `useRenameGroup.ts` — espelha padrão useCreateGroup mas SEM
    confirmDialog (rename é benigno) e SEM selectGroup (mesmo uuid)
  - `useDeleteGroup.ts` — espelha useDeleteEntry com confirmDialog
    variante "danger"; mensagem inclui contagem de entradas afetadas
    (`countEntriesInSubtree` inline walk recursivo); selectGroup
    sobe pro parent após sucesso
  - `renameGroupInVault` em `lib/kdbx.ts`: snapshot do oldName +
    `group.times.update()`; rollback do nome no save fail (times
    update é rollback parcial aceito — file persistido mantém times
    antigo, UX irrelevante)
  - `moveGroupToRecycleBin` em `lib/kdbx.ts`: clone funcional de
    `moveEntryToRecycleBin` com `kdbx.move<T extends KdbxEntry |
    KdbxGroup>()`; cascade automático (kdbxweb move subtree inteiro)
  - Catch de TSC strict: `kdbx.getGroup(meta.recycleBinUuid)` exige
    guard `!existingUuid.empty` para narrowing `KdbxUuid | undefined
    → KdbxUuid` (lição: replicar template existente quando padrão
    está cravado)
  - Catch de lint: `KdbxEntry` importado mas não usado removido
    durante review pré-validação
  - Catch de tipo: `selectGroup` exige `string` (não `string | null`),
    diferente de `selectEntry` que aceita null — conditional call
    `if (parentUuidId)` garante narrowing
- ✅ **Sessão 26 — Context menu completo de grupos** (`70e1e23`):
  - UI integration completa do groundwork S25. 4 arquivos +422/-54.
  - `RenameGroupDialog.tsx` — espelha NewGroupDialog mas pré-popula
    com nome atual; nova validação isUnchanged (botão disabled +
    hint suave `text-muted-foreground` sem `role="alert"`); duplicate
    check exclui o próprio grupo via `.filter(g => g !== group)`
  - `GroupContextMenu.tsx` — wrapper com 3 estados de visibilidade:
    Lixeira/descendente sem menu (retorna children direto); root
    apenas "Novo subgrupo"; normal 3 itens (Novo subgrupo / Renomear /
    separator / Mover para Lixeira em vermelho)
  - `GroupTreeItem.tsx` ganha 5 props novas (`recycleBinUuidId`,
    `getGroupByUuid`, 3 callbacks); refatora row para `rowContent`
    variável + wrap condicional com `GroupContextMenu` se group
    resolver; recursão propaga props
  - `GroupSidebar.tsx` wiring completo: 4 handlers novos
    (`handleCreateSubgroup`, `handleRename`, `handleDelete`,
    `handleConfirmRename`); state `ctxCreateTarget` override do
    `targetParent` para "Novo subgrupo" via menu não mudar seleção;
    `getGroupByUuid` useCallback memoizado; renderiza
    `RenameGroupDialog` condicional
  - Padrão `onDelete={(group) => void handleDelete(group)}` evita
    `@typescript-eslint/no-misused-promises` (mesmo wrap que `onSelect`)
  - Smoke flow manual: 8 cenários validados (menu por estado,
    create-subgroup com auto-expand, rename com isUnchanged/duplicate,
    delete com confirmDialog/parent-selection, cascade, persistência)
  - Fecha pendência "context menu para grupos com operações
    completas" do "Próximo:" da S22.
- ✅ **Sessão 27 — Housekeeping S22-S26 + Dependabot triagem** (`766607c`):
  - Alinhamento documental do §14 com narrativas S24/S25/S26 (drift
    de 3 sessões) e estabelecimento do Roadmap S28a-d originário.
  - Remoção do `next-themes` como dead dep (flagged em S20 quando
    `ThemeToggle` foi implementado com sistema próprio em
    `lib/theme.ts` + `MutationObserver`).
  - Triagem cirúrgica de 5 PRs Dependabot na fila — 4 mergeadas após
    grep preventivo + análise de coupling:
    - `1b26389` PR #10 tailwind-merge 3.5.0 → 3.6.0 (npm patch)
    - `3c85a22` PR #8 react 19.2.5 → 19.2.6 + sync react-dom (npm
      patch coupled)
    - `22a4ba6` PR #7 tailwindcss 4.2.4 → 4.3.0 (npm minor) seguida
      de `@dependabot rebase` no PR #9 acoplado
    - `038b4fa` PR #9 @tailwindcss/vite 4.2.4 → 4.3.0 (npm minor —
      acoplado ao #7 via mesma versão pinned, mergeado após rebase
      automático eliminar nested `node_modules/@tailwindcss/{node,
      vite}/node_modules/tailwindcss@4.2.4`)
  - 1 PR fechada conscientemente: `dev-dependencies-2f25c8d3ab`
    (PR #6) com 6 majors agrupados em single PR — eslint 9→10,
    vite 7→8, typescript 5→6, plugin-react 4→6, react-hooks 5→7,
    @eslint/js 9→10. Framework §28: major bumps são sessões
    dedicadas, agrupados não. Comment técnico preservado em
    PR #6 (closed). 2 patches dev seguros cherry-picked
    manualmente (`@tauri-apps/cli` 2.11.0 → 2.11.1 e
    `typescript-eslint` 8.59.2 → 8.59.3).
  - Roadmap S28a-d documentado em §14 (subitens S28a/b/c/d com
    análise de blast radius prévia, depois executado em sessões
    consecutivas).
  - `gh` CLI instalado via `winget install --id GitHub.cli`
    durante triagem — primeira sessão sistematizando uso de `gh`
    como tool primário para operações GitHub (vs MCP GitHub que
    não estava disponível).
- ✅ **Sessão 28 — Correção da entrada S23 em §14** (`0cafce8`):
  - Entrada S23 estava registrada incorretamente como 🚧 deferida
    no housekeeping da S27 quando havia sido executada na sessão
    real S23 (release `v0.1.0-alpha` ativo desde então).
  - 3 EDITs aplicados: (1) substituir stub 🚧 por entrada ✅
    completa (build, ZIP, tag annotated, GitHub Release pre-release,
    hashes SHA256, smoke flow 10 fases, release URL); (2) remover
    "Alpha distributable for testers (S23 deferida)" do "Próximo:"
    candidate list; (3) tabela inalterada — `0f46473` (S22 hk) já
    presente e a tag annotated `v0.1.0-alpha` (`60992f7`) aponta
    para esse commit.
  - Lição operacional: housekeeping documental tipo S27 (drift
    grande de várias sessões) tem risco de imprecisão em entradas
    históricas. Verificar com `git tag` antes de marcar item como
    deferido.
- ✅ **Sessão 29 — Restore group from Recycle Bin** (`fb953ae`):
  - Hook `useRestoreGroup` + helper `restoreGroupFromRecycleBin`
    em `lib/kdbx.ts` + item "Restaurar" no `GroupContextMenu`.
    5 arquivos, +192/-6.
  - Fecha ciclo CRUD completo de grupos: criar (S24) → renomear/
    deletar (S25/S26) → restaurar (S29). Simetria visual com o
    ciclo de entries (Lixeira de entry tinha restore desde S5).
  - `restoreGroupFromRecycleBin`: valida grupo é filho DIRETO da
    Lixeira (não subgrupo aninhado), `kdbx.move(group, root)`
    com rollback in-memory padrão S19 Bloco 3 se save falhar.
  - `useRestoreGroup`: espelha `useRestoreEntry` (sem
    `confirmDialog` — ação benigna; toast "Grupo X restaurado
    (Nms)"; `selectGroup(uuid)` pós-sucesso navega para o grupo
    no novo parent).
  - `GroupContextMenu` ganha 4º estado: filho direto da Lixeira
    mostra apenas "Restaurar para o grupo raiz" (lógica inversa
    do hide-when-recycle das ações destrutivas Renomear/Mover
    para Lixeira). Subgrupos aninhados na Lixeira e a Lixeira em
    si continuam sem menu.
  - `GroupTreeItem` + `GroupSidebar`: prop `onRestore` propagada
    e wired ao hook. Padrão `void handleRestore(group)` consistente
    com S26 (no-misused-promises).
- ✅ **Sessão 28d — Bumps devDeps seguros do PR #14**
  (`55d72b9`):
  - Cherry-pick dos 3 pacotes seguros do PR #14 (fechado
    conscientemente por conter 6 majors agrupados — eslint 10,
    vite 8, typescript 6, plugin-react 6, react-hooks 7,
    @eslint/js 10): `globals` 15 → 17 (devDep, usado apenas como
    `globals.browser` em `eslint.config.js`), `eslint-plugin-
    react-refresh` 0.4 → 0.5 (devDep, regra única
    `only-export-components` com `allowConstantExport: true`),
    `typescript-eslint` 8.59.3 → 8.59.4 (patch).
  - Menor dos 4 majors do Roadmap S28a-d. Triple sanity validado.
  - Sequência: feito ANTES de S28c/b/a (que carregam coupling
    via peerDep ESLint 10).
- ✅ **Sessão 28c — Vite 7 → 8 + plugin-react 4 → 6** (`32a9685`):
  - Maior migração do Roadmap S28a-d — `vite` ^7.0.4 → ^8.0.14
    e `@vitejs/plugin-react` ^4.6.0 → ^6.0.2. Plugin-react pulou
    major 5 (Babel-related).
  - Vite 8 usa **rolldown** (bundler Rust) internamente em vez de
    rollup. Build output mostra `rolldown-runtime` (0.56 KB) +
    plugin `rolldown:vite-resolve`. @vitejs/plugin-react 6 remove
    Babel, usa **Oxc** para JSX transform e Fast Refresh —
    significativamente mais rápido + menor footprint
    (package-lock.json: +260/-804 linhas, Babel deps eliminadas).
  - Zero mudança em `vite.config.ts` — `defineConfig`, `react()`
    sem args, `manualChunks` da S19, server config Tauri tudo
    compatível. Node 24 satisfaz engines (^20.19.0 || >=22.12.0).
  - Validação: vite build 2.86s, 4 chunks íntegros (crypto 197 KB,
    react 189 KB, ui-vendor 142 KB, index 146 KB) — manualChunks
    da S19 preservado. Vite dev: ready em 353ms, HTTP 200.
- ✅ **Sessão 28b — ESLint 9 → 10 + react-hooks 5 → 7 + 9
  violações** (`7b5d7ef`):
  - `eslint` ^9.39.4 → ^10.4.0, `@eslint/js` ^9.39.4 → ^10.0.1,
    `eslint-plugin-react-hooks` ^5.2.0 → ^7.1.1.
  - 2 novas regras detectadas e fixadas (decisão: refatorar em
    vez de suprimir — alinha com padrão React docs):
  - **`react-hooks/set-state-in-effect`**: 6 violações (5 mapeadas
    no roadmap S28b + 1 nova em `RenameGroupDialog` post-S26).
    Padrão "setState durante render" do
    react.dev/learn/you-might-not-need-an-effect aplicado:
    `EntryDetail` (entry change), `EntryEditor` (composite key
    editMode|groupUuid), `NewGroupDialog` (prevOpen),
    `RenameGroupDialog` (composite key open|uuid),
    `PasswordGenerator` (refactor maior: 2 useEffects → useMemo
    + `regenCounter` cache buster, com supressão exhaustive-deps
    §33 justificada).
  - **`preserve-caught-error`**: 3 violações em `lib/kdbx.ts`
    `openVault` — `new Error(msg, { cause: e })`. Mudança no
    `tsconfig.json` lib += `"ES2022.Error"` (options bag é
    ES2022). Target ES2020 preservado.
  - 3 imports `useEffect` removidos (NewGroupDialog,
    RenameGroupDialog, PasswordGenerator).
- ✅ **Sessão 28a — TypeScript 5.8 → 6.0** (`7e538e9`):
  - Fecha Roadmap S28a-d. `typescript` ~5.8.3 → ~6.0.3.
  - **`baseUrl` deprecated removido** (TS5101, vai parar de
    funcionar em TS 7) do `tsconfig.json`. `paths` agora resolve
    relativo ao diretório do próprio tsconfig por padrão (TS
    5.0+). Alias `"@/*"` → `["./src/*"]` continua idêntico ao
    alias do Vite.
  - 2 strictness regressions expostas pelo TS 6:
    (1) `lib/kdbx.ts` `toArrayBuffer` (TS2322) — `bytes.buffer.slice()`
    agora retorna `ArrayBuffer | SharedArrayBuffer` (union de
    `ArrayBufferLike`), não atribuível a `ArrayBuffer` puro;
    refactor para `new ArrayBuffer + set` (mesmo padrão de
    `initKdbxweb`).
    (2) `main.tsx` side-effect import `@fontsource-variable/geologica`
    (TS2882) — pacote só publica CSS, sem tipos JS; resolvido
    com ambient declaration em `src/vite-env.d.ts`.

**Próximo:** Sessão 30 — pendências em aberto após fechamento do
Roadmap S28a-d e do ciclo CRUD de grupos. Candidatos:
`emptyRecycleBin` rollback (kdbxweb tombstone API, sessão dedicada
restante do S19 Bloco 3), VM validation do `.exe` alpha gerado em
S19 (validar fluxo completo de instalação como tester real),
empacotamento Windows real para 1.0+ (cert via vendor — ver §32,
bloqueado por decisão de entidade jurídica), ou nova rodada de
triagem Dependabot (5 PRs abertas no momento da escrita: #11
brace-expansion security, #12 tauri-build cargo patch, #13 tauri
cargo patch, #15 lucide-react minor, #16 qs patch). Validação
diferida: ativar branch protection com 3 jobs obrigatórios após
1-2 semanas (decisão da Sessão 13).

**Roadmap S28a-d — CONCLUÍDO em S30:** os 4 majors do PR #14
(fechado conscientemente por §28 framework — 6 majors agrupados em
single PR não-mergeável) foram executados em sessões dedicadas
consecutivas:

- ✅ **S28d** (`55d72b9`) — globals 15 → 17 + plugin-react-refresh
  0.4 → 0.5 + typescript-eslint patch. Menor dos 4, feito
  primeiro por ordem de coupling.
- ✅ **S28c** (`32a9685`) — vite 7 → 8 + plugin-react 4 → 6.
  Babel → Oxc transforms (rolldown bundler).
- ✅ **S28b** (`7b5d7ef`) — eslint 9 → 10 + react-hooks 5 → 7 +
  9 violações refatoradas (set-state-in-effect +
  preserve-caught-error).
- ✅ **S28a** (`7e538e9`) — typescript 5.8 → 6.0 + baseUrl
  removido + 2 strictness fixes. Foundation TypeScript do
  projeto inteira no major mais recente.

Padrão consolidado: **PR Dependabot multi-major → close +
cherry-pick por sessão dedicada**. Aplicável a próximos PRs
agrupados (futuro).

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

---

## 17. Persistência atômica do `.kdbx` (Tarefa 5 da Sessão 4)

### Sequência de save com backup atômico

Implementada no backend Rust via comando `save_vault_with_backup` em
[src-tauri/src/lib.rs](src-tauri/src/lib.rs):

1. Valida path (não-vazio, extensão `.kdbx`, `vault_bytes` ≥ 200 bytes).
2. Valida que o `.kdbx` atual existe, é arquivo, está em pasta acessível.
3. Lê arquivo `.kdbx` atual e valida magic bytes
   (`0x03 0xD9 0xA2 0x9A 0x67 0xFB 0x4B 0xB5`).
4. Escreve `.kdbx.bak` com `fsync` (sobrescreve `.bak` antigo).
5. Escreve `.kdbx.tmp` com novo conteúdo + `fsync`.
6. Re-valida magic bytes do `.tmp` escrito.
7. Renomeia `.tmp → .kdbx` (operação atômica do filesystem; no Windows,
   `MoveFileExW` com `REPLACE_EXISTING`).

### Garantias

- Em qualquer falha de passos 1–6, o `.kdbx` original permanece intacto
  (rename só acontece no passo 7, depois de validação completa).
- Em qualquer falha após criar o `.tmp`, cleanup explícito remove o
  arquivo temporário (`let _ = std::fs::remove_file(&tmp_path);` em todos
  os caminhos de erro).
- O `.kdbx.bak` sempre representa "o estado anterior à última save
  bem-sucedida" — útil para recuperação manual se algum bug futuro
  comprometer o `.kdbx`.
- Mensagens de erro em PT-BR via helper `io_error_to_pt`. Usa apenas o
  basename do path (não o caminho completo) para evitar vazar estrutura
  de pastas internas. `to_string_lossy` preserva nome mesmo com chars
  não-UTF8.

### Estratégia do `.bak`: Opção A (sobrescreve a cada save)

Decidida na Sessão 4: o `.bak` é **sempre** o estado imediatamente
anterior à última save bem-sucedida — não há rotação de N versões
históricas. Justificativas:

- Espaço em disco previsível (sempre 1× tamanho do cofre).
- Comportamento idêntico ao do KeePassXC.
- Recuperação histórica de longo prazo é responsabilidade de backups
  externos do usuário (OneDrive/Drive/Time Machine, etc.), não do app.

### Frontend

Função `saveVault(filePath, kdbx) → SaveResult` em
[src/lib/kdbx.ts](src/lib/kdbx.ts) serializa o `Kdbx` e invoca o comando
Rust. Retorna `{ ok: true, durationMs }` ou `{ ok: false, error }` —
não lança, chamadores tratam via discriminated union.

### `writeNewVaultFile` vs `saveVault`

Convivem 2 funções de escrita em `kdbx.ts` por restrição inerente:

- `writeNewVaultFile(filePath, db)` — usada APENAS em "Criar cofre" (o
  arquivo ainda não existe no FS). Internamente usa o comando antigo
  `write_file_with_backup`.
- `saveVault(filePath, kdbx)` — usada em qualquer save SUBSEQUENTE
  (cofre já existente). Usa `save_vault_with_backup` com magic-check +
  backup atômico.

Tarefa 6 conecta `saveVault` ao botão "Salvar" do `EntryEditor`.
Tarefa 7 usa para persistir o move-to-trash.

### Smoke test temporário (REMOVIDO na Tarefa 6)

Durante a Tarefa 5 (Bloco B), o [main.tsx](src/main.tsx) expunha
`window.__testSaveVault()` em DEV para teste manual via DevTools
console. **Bloco removido na Tarefa 6** — o save real agora vive no
botão "Salvar" do `EntryEditor` (ver §18).

---

## 18. Wire-up do save (Tarefa 6 da Sessão 4)

### Hook `useCommitEdit`

[src/hooks/useCommitEdit.ts](src/hooks/useCommitEdit.ts) — função `()
→ Promise<boolean>` que:

1. Valida estado (cofre aberto, draft não-vazio, título não-vazio).
2. Snapshot dos campos atuais (modo `edit`) ou referência da entry
   recém-criada (modo `create`) para rollback.
3. Mutação in-place do `Kdbx`: aplica `draftEntry` em `entry.fields`
   (senha como `ProtectedValue.fromString`), chama `entry.times.update()`.
4. `saveVault(filePath, kdbx)` (§17) — backup atômico no disco.
5. Em sucesso: `incrementVaultVersion`, `selectEntry(entryUuid)`,
   `exitToViewMode`, toast `"Salvo (Xms)"`.
6. Em falha de save: **rollback in-memory** (restaura fields ou remove
   entry recém-criada do grupo), toast vermelho com `error` do
   backend, mantém edit mode + dirty para usuário tentar de novo.

### Atalhos novos

| Atalho | Quando | Ação |
|---|---|---|
| `Ctrl+E` | modo `view`, entry selecionada (não-lixeira) | entra em `edit` |
| `Ctrl+S` | modo `edit`/`create` | dispara `commitEdit` |
| `Esc` | modo `edit`/`create` | cancela (com `ConfirmDialog` se dirty) |

`Ctrl+E` registrado em `EntryDetail` antes do early return (Rules of
Hooks). `Ctrl+S` e `Esc` registrados em `EntryEditor` quando montado
em modo edit/create.

### Confirmações pra ações arriscadas com draft pendente

`ConfirmDialog` programático via Promise — `confirmDialog(opts) →
Promise<boolean>` em [src/lib/confirm.ts](src/lib/confirm.ts). Store
interno (Zustand) acumula requests; `ConfirmDialogHost` renderiza-as
na árvore React (`App.tsx`).

Cobertura dos 4 cenários:

| Cenário | Onde | Implementação |
|---|---|---|
| Click em outra entry com draft | `EntryList` | `confirmDiscardIfDirty` antes de `selectEntry` |
| Click em outro grupo | `GroupSidebar` | mesmo padrão |
| Lock manual (botão / Ctrl+L) | `requestLockWithGuard` em `lib/lock-flow.ts` | dialog se dirty; sem timeout (espera resposta indefinidamente) |
| Auto-lock por inatividade | `useAutoLock` | `requestLockWithGuard({ autoConfirmAfterMs: 30_000 })` — dialog auto-resolve em 30s descartando e bloqueando (segurança > UX) |
| Fechar janela do app | `useCloseRequestGuard` em `App.tsx` | intercepta `getCurrentWindow().onCloseRequested`; `event.preventDefault()` + dialog; `await w.destroy()` no confirm (`close()` re-dispararia o evento em loop) |

### Higiene de memória das senhas em draft

[src/stores/vault.ts](src/stores/vault.ts) — `cancelEdit` e
`exitToViewMode` zeram `draftEntry.password` e
`originalDraft.password` (`= ""`) antes de descartar os objetos.

**Limitação:** strings em JS são imutáveis — a "zeragem" reatribui a
property pra string vazia e libera a referência da senha original pro
GC, mas NÃO sobrescreve a memória da string original. Defesa contra
leitura via outras referências de mesma string, NÃO contra memory dump
do processo. Defesa real continua sendo o `ProtectedValue` da kdbxweb
depois do commit.

### Rollback in-memory em falha de save

`useCommitEdit` cuida de manter o `Kdbx` em memória consistente com o
disco em caso de erro de I/O:
- Modo `edit`: `Map(entry.fields)` snapshot antes de mutar; em erro,
  `entry.fields.clear()` + restaura entries do snapshot.
- Modo `create`: `kdbx.createEntry(group)` é chamado antes do save;
  em erro, `group.entries.splice(idx, 1)` remove a entry órfã.

---

## 19. Delete e lixeira KDBX (Tarefa 7 da Sessão 4)

### Soft-delete via `kdbx.move(entry, recycleBin)`

Implementado em `moveEntryToRecycleBin` em [src/lib/kdbx.ts](src/lib/kdbx.ts).
Não removemos a entry do `Kdbx` — movemos pro grupo Lixeira (RecycleBin).
Razões:

1. **Compatibilidade total com KeePass/KeePassXC.** Cofre alterado pelo
   Sec.Basis abre no KeePassXC com a Lixeira no lugar certo, e vice-versa.
   O `kdbx.move(...)` da kdbxweb cuida de `parentGroup`, `LocationChanged`
   e demais campos de housekeeping esperados pelos outros leitores.
2. **UX padrão do KeePass há décadas.** Usuário pode restaurar entrada
   deletada por engano — funcionalidade esperada por quem migra de outros
   gerenciadores.
3. **MVP atual não precisa de hard-delete.** Restaurar/esvaziar a Lixeira
   ficou pra Sessão 5+; enquanto isso, qualquer entrada na Lixeira pode
   ser gerenciada via KeePassXC.

### `RecycleBin` criado on-demand

Se `meta.recycleBinUuid` está vazio quando o usuário deleta a primeira
entry, chamamos `kdbx.createRecycleBin()` antes do `move`. Mesmo
comportamento do KeePassXC. O grupo aparece automaticamente na sidebar na
próxima invalidação de `vaultVersion`.

### Persistência atômica reaproveitada

`moveEntryToRecycleBin` chama `saveVault` internamente — mesma sequência
da Tarefa 5 (backup `.bak` + magic check + `.tmp` + rename atômico, ver
§17). Em falha de save, a entry FICA movida em memória mas o disco mantém
o estado antigo. NÃO revertemos in-memory:

- Recarregar do disco exigiria re-derivar chave / re-abrir cofre, custo
  alto pra um caminho de erro raro.
- O hook chamador (`useDeleteEntry`) NÃO incrementa `vaultVersion` em
  falha, então a UI segue mostrando o estado pré-delete (consistência
  visual).
- Próximo `saveVault` bem-sucedido (qualquer mutação) vai persistir o
  move junto. Consistência eventual aceitável pra MVP.

### UI: botão Deletar + tecla Delete global

[src/components/vault/EntryDetail.tsx](src/components/vault/EntryDetail.tsx)
expõe ambos os caminhos:

- **Botão Trash2** ao lado do botão Editar. Tooltip muda quando a entry
  está na Lixeira (read-only no MVP).
- **Tecla Delete** registrada no mesmo `useEffect` que cuida do Ctrl+E.
  **Guard de foco em campo editável** (`tag === "INPUT" || "TEXTAREA"
  || isContentEditable`) — sem isso, apertar Delete enquanto digita no
  campo de busca do header iria deletar a entry selecionada. Cobre
  também o cenário do Bloco G da validação (deletar em modo edit, foco
  no form).

Ambos os caminhos disparam `useDeleteEntry()` em
[src/hooks/useDeleteEntry.ts](src/hooks/useDeleteEntry.ts), que abre o
ConfirmDialog programático "Mover para a lixeira?" antes de qualquer
mutação.

### Entries dentro da Lixeira são read-only no MVP

`useIsEntryInRecycleBin(entry)` (já existente da Sessão 3) desabilita
ambos os botões Editar e Deletar quando `true`. Tooltip explicativo:
"Esta entrada já está na Lixeira. No MVP atual, restaurar/esvaziar a
lixeira é feito pelo KeePassXC."

`useIsCurrentGroupRecycleBin()` (também da Sessão 3) desabilita o botão
"+" da lista quando o grupo Lixeira está selecionado. Já estava
implementado e segue válido.

### Sidebar diferencia o grupo Lixeira

Novo selector `useRecycleBinUuidId()` em [src/stores/vault.ts](src/stores/vault.ts)
retorna a string-id do RecycleBin (ou `null` se não há). A
`GroupSidebar` usa pra trocar o ícone Folder pelo Trash2 no item
correspondente. Nome do grupo NÃO é traduzido — exibimos o que vem do
header KDBX (geralmente "Recycle Bin"). Tradução pra "Lixeira" fica pra
um pass futuro de i18n consistente.

### Atalho Delete na seção §11

| Atalho | Ação |
|---|---|
| `Delete` | Mover entry selecionada para a Lixeira (com confirmação). Ignorado se foco está em campo editável. |

### TODO Sessão 5+

- ✅ Restaurar entry da Lixeira (Tarefa 1 da Sessão 5 — ver §20)
- Esvaziar Lixeira (hard-delete via `DeletedObjects`)
- Mover entry entre grupos manualmente
- Drag-and-drop na sidebar/lista

---

## 20. Restaurar entry da Lixeira (Tarefa 1 da Sessão 5)

### `restoreEntryFromRecycleBin` em `kdbx.ts`

Implementado em `src/lib/kdbx.ts` no mesmo padrão de `moveEntryToRecycleBin`.
Move a entry da Lixeira de volta para o grupo raiz via
`kdbx.move(entry, kdbx.getDefaultGroup())`.

**Decisão de UX: destino é sempre o grupo raiz.** O KDBX não armazena o
grupo de origem no momento do soft-delete, então não há como "restaurar
para onde estava". Comportamento idêntico ao KeePassXC. O usuário pode
mover a entry para outro grupo depois (Sessão 6+ vai expor mover entre
grupos manualmente).

Validações defensivas antes do move:
1. `kdbx.meta.recycleBinUuid` existe e não está vazio.
2. `kdbx.getGroup(recycleBinUuid)` retorna o grupo Lixeira.
3. `entry.parentGroup === recycleBin` — entry está realmente lá.
4. `kdbx.getDefaultGroup()` retorna o grupo raiz.

UI já desabilita o botão "Restaurar" fora desse contexto, mas defesa
programática evita corrupção silenciosa se algum bug futuro chamar a
função em estado inválido.

### Hook `useRestoreEntry`

[src/hooks/useRestoreEntry.ts](src/hooks/useRestoreEntry.ts) — padrão
similar ao `useDeleteEntry`, mas **sem `confirmDialog`**. Restaurar é
ação benigna (reverte uma deleção); confirmação seria fricção
desnecessária. Padrão alinhado com KeePassXC e Gmail (restaurar email
da lixeira é instantâneo, sem prompt).

Em sucesso: incrementa `vaultVersion`, limpa seleção
(`selectEntry(null)` — entry saiu da Lixeira, lista atual mudou), toast
verde `"Entrada restaurada para o grupo raiz (Xms)"`.

Em erro de save: toast vermelho, NÃO incrementa `vaultVersion`. Mesmo
trade-off do `moveEntryToRecycleBin`: kdbx em memória já mutado, próximo
save persiste junto. TODO Sessão 6: rollback in-memory.

### UI no `EntryDetail`

Quando `useIsEntryInRecycleBin(entry) === true`, os botões "Editar" e
"Deletar" são **substituídos** por um único botão "Restaurar" (ícone
`Undo2` do lucide-react, variant outline). Quando false, comportamento
original (Editar + Deletar) sem mudança.

Estado local `restoring: boolean` evita double-click disparar dois saves
em paralelo — botão fica disabled com texto "Restaurando..." durante o
I/O.

Tooltip antigo ("Esta entrada já está na Lixeira. No MVP atual,
restaurar/esvaziar a lixeira é feito pelo KeePassXC.") foi removido —
não faz mais sentido agora que existe caminho dentro do app.

### Atalhos de teclado

**Sem atalho para Restaurar.** Ctrl+R conflita com refresh do navegador
(comportamento padrão indesejado). Restaurar é ação rara comparada a
Editar/Deletar — clique do botão é suficiente.

Ctrl+E e Delete continuam com guard `!inRecycleBin` (já implementado na
Tarefa 7 da Sessão 4) — não disparam quando entry está na Lixeira.

### Navegação após restaurar

`selectEntry(null)` no sucesso. O `EntryList` (ou estado vazio) assume
naturalmente — usuário continua no grupo Lixeira (não muda
automaticamente para o raiz), permitindo restaurar múltiplas entries em
sequência sem trocar de contexto.

### Compatibilidade KeePass/KeePassXC

Como usa `kdbx.move(entry, root)` da kdbxweb (mesma API que KeePassXC
usa internamente), entries restauradas no Sec.Basis aparecem
corretamente no grupo raiz quando o cofre é aberto no KeePassXC, e
vice-versa. Validado fim-a-fim na validação manual da Tarefa 1.

---

## 21. Esvaziar Lixeira (Tarefa 2 da Sessão 5)

### `emptyRecycleBin` em `kdbx.ts`

Implementado em `src/lib/kdbx.ts`. Itera `kdbx.move(entry, undefined)`
em todas as entries do grupo Lixeira (RecycleBin). Esse é o uso correto
da API kdbxweb para hard-delete — `move(entry, undefined)` chama
`addDeletedObject()` automaticamente, populando `meta.deletedObjects`
com tombstone. A entry deixa de aparecer em qualquer grupo, mas o
tombstone permanece no formato (lista interna do KDBX usada para
reconciliação em cenários de sync entre múltiplos cofres). É o que
outros leitores do ecossistema KeePass esperam.

**Gotcha importante (custou a primeira tentativa da Tarefa 2):**
`kdbx.remove(entry)` NÃO é hard-delete quando
`meta.recycleBinEnabled === true` (default em todo cofre KDBX novo).
JSDoc literal da kdbxweb: *"Depending on settings, removes either to
trash, or completely"*. Em cofre com Lixeira habilitada, `remove()` é
sinônimo de `move(entry, recycleBin)` — se a entry já está na Lixeira,
o `move()` interno splica do `recycleBin.entries` e dá push de volta
no fim do mesmo array, sem tocar em `deletedObjects`. Save persiste
cofre idêntico ao anterior. Toast diz "esvaziada" e o usuário não
percebe o no-op até reabrir o cofre.

**Ponto técnico crítico:** snapshot do array (`[...recycleBin.entries]`)
ANTES de iterar. `kdbx.move` muta `recycleBin.entries` in-place; iterar
diretamente faria skip de elementos.

Validações defensivas:
1. `kdbx.meta.recycleBinUuid` existe e não está vazio.
2. `kdbx.getGroup(recycleBinUuid)` retorna o grupo Lixeira.
3. `recycleBin.entries.length > 0` (não persistir save no-op).

Persistência via `saveVault` (escrita atômica + backup `.bak`, ver §17).
Trade-off de erro de save igual a `moveEntryToRecycleBin` /
`restoreEntryFromRecycleBin`: kdbx mutado em memória, próximo save
persiste junto. TODO Sessão 6+: rollback in-memory.

### Hook `useEmptyRecycleBin`

[src/hooks/useEmptyRecycleBin.ts](src/hooks/useEmptyRecycleBin.ts) —
recebe `entryCount: number` como argumento (não re-deriva via selectors;
componente chamador já tem o número). `confirmDialog` OBRIGATÓRIO com:

- Título dinâmico: `Apagar permanentemente N entradas?` (com
  pluralização: `1 entrada` / `N entradas`)
- Descrição: lembra que **Sec.Basis não consegue desfazer** e sugere
  cópia externa do `.kdbx` antes de continuar
- `confirmLabel: "Apagar permanentemente"`, `variant: "danger"` (botão
  vermelho)

Em sucesso: incrementa `vaultVersion`, limpa seleção (entries
removidas não existem mais), toast verde
`Lixeira esvaziada (N entradas, Yms)` (também com pluralização).

### UI no `EntryList`

Header da lista renderiza condicionalmente:

| Estado do grupo | Botão renderizado |
|---|---|
| Grupo normal | `+` (criar entry) — comportamento original |
| Lixeira COM entries | `Esvaziar` (variant destructive, ícone Trash2) |
| Lixeira VAZIA | nenhum botão — padrão Gmail |

Esconder o botão quando vazio (em vez de desabilitar) é decisão de UX
deliberada — botão desabilitado em estado "natural" (Lixeira vazia é
o ideal) é ruído visual desnecessário.

Estado local `emptying: boolean` evita double-click — botão fica
disabled com label "Esvaziando..." durante o I/O.

### Atalhos de teclado

**Sem atalho.** Esvaziar é ação rara + irreversível — atalho
aumentaria risco de invocação acidental sem benefício prático.

### Navegação após esvaziar

`selectEntry(null)` no sucesso. O `EntryList` mostra o estado vazio
educativo (`EmptyRecycleBinState`, ver §22). Sidebar continua exibindo
o grupo Lixeira — não desaparece, comportamento idêntico ao KeePassXC.

---

## 22. Polimento UX da Lixeira (Tarefa 3 da Sessão 5)

### Tradução "Recycle Bin" → "Lixeira" via helper

Helper puro `getGroupDisplayName(group, recycleBinUuidId)` em
[src/stores/vault.ts](src/stores/vault.ts) — retorna `"Lixeira"` quando
o grupo é o RecycleBin do cofre, ou `group.name || "(sem nome)"` caso
contrário.

**Decisão crítica: tradução é APENAS de renderização.** O
`group.name` interno do XML continua `"Recycle Bin"` (nome canônico que
o ecossistema KeePass internacionaliza no próprio cliente). Mexer no
nome interno quebraria interop com KeePassXC e demais leitores —
validado fim-a-fim na Tarefa 3.

Função pura (não-hook) porque a derivação é trivial e o componente
chamador já tem `useRecycleBinUuidId()` disponível. Combinar os dois é
mais legível que esconder atrás de um wrapper.

### Pontos de aplicação (auditoria)

- [GroupSidebar.tsx](src/components/vault/GroupSidebar.tsx) — span do
  item da sidebar (era `g.name || "(sem nome)"`).
- [EntryList.tsx](src/components/vault/EntryList.tsx) — header da lista
  agora mostra `<NomeDoGrupo> · N entradas` (antes só contador). Nome
  passa pelo helper.
- [EntryDetail.tsx](src/components/vault/EntryDetail.tsx) — variável
  `groupName` no breadcrumb metadata da entry (antes era
  `entry.parentGroup?.name ?? ""`).

**Pontos não-aplicáveis (já em PT-BR hardcoded):** descrições do
`confirmDialog` em `useDeleteEntry`, toasts em `useDeleteEntry` /
`useRestoreEntry` / `useEmptyRecycleBin`, mensagens de erro em
`kdbx.ts`. Não há instância de "Recycle Bin" exposta ao usuário fora
das três renderizações acima.

**Dívida técnica latente flagada na auditoria:** descrição do
`confirmDialog` em `useDeleteEntry.ts:45` ainda menciona "(No MVP atual,
restaurar/esvaziar a lixeira ainda não está implementado — use o
KeePassXC se precisar.)" — texto stale após Tarefas 1 e 2. Limpar em
sessão futura.

### Estado vazio da Lixeira (`EmptyRecycleBinState`)

Componente em
[src/components/vault/EmptyRecycleBinState.tsx](src/components/vault/EmptyRecycleBinState.tsx).
Padrão Gmail/Notion: ícone Trash2 64px com opacidade `/30`, h3 "Lixeira
vazia", parágrafo educativo reforçando o ciclo de vida (entries movidas
podem ser restauradas; esvaziar é permanente).

Renderizado pelo `EntryList` quando `isCurrentGroupRecycleBin === true`
**E** `entries.length === 0`. Grupos normais mantêm o estado vazio
mínimo da Sessão 3 — polir os outros casos de estado vazio fica para
sessão futura de UX dedicada.

### Visual de entries individuais na Lixeira — sem diferenciação

Decisão de UX cravada: entries renderizadas dentro da Lixeira têm
**estilo idêntico** a entries em qualquer outro grupo (sem opacidade
reduzida, sem ícone extra ao lado, sem strike-through). O contexto
"esta entry está na Lixeira" já vem da sidebar (ícone Trash2 + nome
"Lixeira"), do breadcrumb da `EntryDetail`, e da troca dos botões
"Editar+Deletar" por "Restaurar".

Adicionar diferenciação visual seria redundante e poluiria a lista —
em uma sessão de bulk restore (caso de uso comum), o usuário precisa
ler título/username/URL com a mesma facilidade que em qualquer outro
grupo.

---

## 23. Versionamento e tela About (Sessão 7)

**Esquema:** Semantic Versioning (SemVer) —
`MAJOR.MINOR.PATCH[-pre-release]`.

**Versão atual:** `0.1.3`. Release Windows de validação controlada, ainda sem
assinatura de código e sem auto-update.
Convenção de bumps:

- `0.1.x` → fixes e melhorias incrementais durante validação controlada
- `0.2.0` → features novas de produto antes do 1.0
- `0.x.y-beta` → quando virar beta público, se o canal beta for retomado
- `1.0.0` → primeira release estável (Roadmap Fase 1 100% completo)

**Source of truth:** `src-tauri/tauri.conf.json` campo `version`
(estrutura flat no Tauri v2 — NÃO há `package.version` aninhado).
`package.json` mantém versão sincronizada manualmente. Bumps futuros
exigem atualizar AMBOS os arquivos.

### Tela About

Componente
[src/components/AboutDialog.tsx](src/components/AboutDialog.tsx).
Conteúdo estático: logo (128×128 servido de `public/secbasis-logo.png`,
exibido a 64px), nome do app, versão (via `useAppVersion`), descrição
curta, 3 linhas de info (site oficial, código-fonte, licença), botão
Fechar.

**Sem chamadas de rede** — alinhado com princípio offline-first. Links
externos abrem no navegador padrão via `@tauri-apps/plugin-shell`
(mesmo padrão de `EntryDetail` para abrir URLs de entries —
capability `shell:allow-open` já existe desde a Sessão 3).

**Acesso:** botão `Info` (ícone Lucide) no
[VaultHeader](src/components/layout/VaultHeader.tsx), entre o
indicador "● não salvo" e o `AutoLockIndicator`. Tooltip
"Sobre o Sec.Basis". `aria-label` espelha o tooltip.

**Hook:** [useAppVersion](src/hooks/useAppVersion.ts) carrega a versão
assíncrona via `@tauri-apps/api/app.getVersion()`. Estado inicial é
string vazia — o modal renderiza "Versão ..." enquanto resolve. Em
erro de IPC (cenário improvável), loga e mantém vazio.

### Logo do app no `public/`

`public/secbasis-logo.png` é cópia direta de
`src-tauri/icons/128x128.png`. Quando o ícone fonte for atualizado
(via `npx @tauri-apps/cli icon assets/secbasis-icon-1024.png`,
descrito na §13), **lembrar de re-copiar** para `public/` ou o logo do
About fica desincronizado. TODO Sessão futura: script de build que
faça essa cópia automaticamente.

### Decisões deliberadamente fora do MVP

- **Sem build hash, sem build date.** Adicionar quando a dor real for
  identificada (ex.: usuário reporta bug e precisamos saber qual
  build). Princípio: instrumentação sob demanda, não preventiva.
- **Sem "verificar atualizações".** Conflitaria com o princípio
  offline-first. Distribuição é via download direto (.msi/.exe) do
  site oficial — usuário gerencia atualização manualmente.
- **Sem atalho de teclado.** Tela About é consultada raramente; botão
  visível no header é suficiente.
- **Sem créditos pessoais ("criado por Yuri").** Decisão UX — modal
  About do MVP foca em produto, não em autoria.
- **Sem tag git `v0.1.0-alpha`** ainda. Tag será criada na Sessão de
  release (quando houver MSI/EXE empacotado distribuído publicamente).

---

## 24. Tela de unlock — redesign + auto-open último cofre (Sessão 8)

### Logo + hierarquia visual unificada

Tanto [OpenCreateScreen](src/components/vault/OpenCreateScreen.tsx)
quanto [UnlockScreen](src/components/vault/UnlockScreen.tsx) compartilham
agora a mesma estrutura visual:

```
┌─ container ─────────────────────┐
│  [Logo 96×96]                   │  gap-4
│  Sec.Basis (text-3xl bold)      │
│  Tagline (text-sm muted)        │
│                                 │  gap-8
│  ┌─ Card (max-w-460) ──────┐    │
│  │  p-8 (32px padding)      │    │  conteúdo do card
│  └──────────────────────────┘    │
│                                 │  gap-8
│  Footer (text-xs muted)         │
└─────────────────────────────────┘
```

**Logo:** `<img src="/secbasis-logo.png" />` 96×96px (`h-24 w-24`)
substitui o ícone `<Lock />` pequeno usado até a Sessão 7. Fonte
servida do `public/secbasis-logo.png` (cópia de
`src-tauri/icons/128x128.png`, ver §23).

**Sistema de espaçamento Tailwind cravado:**
- `gap-2` (8px) — label → input
- `gap-4` (16px) — entre subitens (logo → título)
- `space-y-6` (24px) — entre seções dentro do form (file picker /
  senha / key file / botão)
- `gap-8` (32px) — header → card → footer
- `p-8` (32px) — padding interno do card

### Diferença OpenCreateScreen vs UnlockScreen

- **OpenCreateScreen:** card COM tabs ("Abrir cofre" / "Criar cofre").
  Renderizado quando NÃO há cofre persistido nem path em RAM. Tagline
  "Gerenciador de senhas offline".
- **UnlockScreen:** card SEM tabs (foco único: desbloquear AQUELE
  cofre). Renderizado quando há `lastFilePath` em RAM (auto-lock /
  Ctrl+L) OU quando o boot hidratou o caminho do `lastOpenedVaultPath`
  persistido (ver auto-open abaixo). Tagline "Cofre bloqueado". Link
  discreto "Voltar para a tela inicial" como escape hatch.

### Auto-open do último cofre

**Persistência via `useSettingsStore`** (não Rust + JSON). Campo
`lastOpenedVaultPath: string | null` em
[src/stores/settings.ts](src/stores/settings.ts), persistido via
Zustand `persist` middleware → `localStorage` chave
`sec-basis-settings`.

**Mesma natureza de "metadata operacional"** documentada em §6 do
CLAUDE.md (path do key file por cofre): caminho de arquivo NÃO é
segredo, ACL do APPDATA é o limite de segurança real. Criptografar
seria security theater.

**Trade-off avaliado (e rejeitado):** spec original sugeria
`preferences.rs` Rust + arquivo JSON em `appData()/preferences.json`.
Funcionalmente idêntico, mas ~80% mais código (Rust + comando Tauri +
capability nova + plugin-fs novo) sem benefício real. Recomendação A
escolhida: localStorage via padrão já estabelecido.

### Fluxo de boot

1. App boota. Vault store: `kdbx=null`, `lastFilePath=null` (zerados
   no construtor — sem persist).
2. Settings store hidrata sincronicamente do localStorage. Se
   `lastOpenedVaultPath` existe, está disponível imediatamente.
3. `useEffect` em [App.tsx](src/App.tsx) (uma vez no mount):
   - Lê `lastOpenedVaultPath` do settings.
   - Verifica `fileExists(path)` via comando Tauri
     [file_exists](src-tauri/src/lib.rs).
   - Se existe: chama `useVaultStore.hydrateLastVault(path, keyFile)`
     que popula `lastFilePath` (e `lastKeyFilePath` se houver memória
     de key file pra esse cofre).
   - Se não existe: limpa `lastOpenedVaultPath` em silêncio (cofre
     foi movido/deletado fora do app).
4. Re-render. App.tsx switch detecta `lastFilePath !== null` →
   renderiza `<UnlockScreen />` com path já fixado e foco no campo
   senha.

**Resultado para o usuário:** abre o app, digita só a senha mestra,
desbloqueia. Sem ter que selecionar o arquivo de novo a cada vez.

### Pontos onde `setLastOpenedVaultPath` é chamado

- [OpenVaultTab](src/components/vault/OpenVaultTab.tsx) após
  `setVaultInStore` (sucesso de abertura)
- [CreateVaultTab](src/components/vault/CreateVaultTab.tsx) após
  `setVaultInStore` (sucesso de criação)
- [UnlockScreen](src/components/vault/UnlockScreen.tsx) após `unlock`
  (re-afirma invariante; em teoria já está setado pelo passo anterior
  na sessão, mas redundância barata)

E é **limpado** quando o usuário clica em "Voltar para a tela inicial"
no UnlockScreen — intent explícito de abandonar o auto-load atual.

### Novo action `hydrateLastVault` no vault store

[vault.ts](src/stores/vault.ts) ganhou
`hydrateLastVault(filePath, keyFilePath)` — popula `lastFilePath` e
`lastKeyFilePath` SEM exigir uma instância de Kdbx. Usado APENAS no
boot, a partir do path persistido. Outros caminhos continuam usando
`setVault` (cria) e `unlock` (desbloqueia) que já tratam corretamente
quando há um Kdbx ativo.

### Fora de escopo (Sessão futura)

- Lista de N cofres recentes (apenas o último é persistido)
- "Esquecer este cofre" sem ter que abrir e clicar voltar
- Persistir auto-lock state entre boots (intencionalmente NÃO — o
  auto-lock é um evento de sessão, não estado durável)

## 25. Vulnerabilidades transitivas Linux-only (Sessão 9)

**Contexto:** Dependabot pode reportar vulnerabilidades em crates Rust
que são dependências transitivas do `tauri-runtime-wry` mas que
**só são compiladas em build Linux**. Sec.Basis hoje só faz build para
Windows (target `x86_64-pc-windows-msvc`), usando WebView2.

**Crates afetadas (Linux-only):**
- `glib`, `glib-sys`, `glib-macros`
- `gtk`, `gdk`, `gdk-pixbuf`, `gdkx11`, `atk`, `pango`, `cairo-rs`
- `webkit2gtk`, `javascriptcore-rs`, `soup3`
- `tao` (apenas no path GTK)

**Como verificar se uma vulnerability é Linux-only:**

```bash
cd src-tauri
cargo tree --target x86_64-pc-windows-msvc | grep -i <crate-name>
```

Se retornar vazio, a crate não está no binário Windows e o alerta
pode ser dispensado como "Risk tolerable" no GitHub Dependabot.

**Comparar com Linux para confirmar:**

```bash
cargo tree --target x86_64-unknown-linux-gnu | grep -i <crate-name>
```

Se aparecer no Linux mas não no Windows, é definitivamente Linux-only.

**Decisão de processo:**

- Vulnerabilidades em crates Linux-only podem ser dispensadas no
  Dependabot com comentário citando a análise via `cargo tree --target`
- Quando suporte Linux for adicionado (Roadmap Fase 1/2), TODAS essas
  dispensas precisam ser revisitadas
- Mantém mitigation registrada em commit message + dismiss reason no
  GitHub para auditabilidade

**Histórico:**

- **Alert #1 (Sessão 9):** `glib < 0.20.0` — `VariantStrIter::impl_get`
  unsoundness. Dispensado como "Risk tolerable — vulnerable code not
  compiled into Windows binary".

## 26. Smoke test do pipeline cripto (boot do app)

**Contexto:** Sec.Basis valida no boot que o pipeline cripto (Argon2id
nativo + kdbxweb round-trip) está funcional. Útil para detectar
regressões em mudanças de toolchain (Rust upgrade, kdbxweb update,
WebView2 atualização) e para benchmarks de performance.

**Localização:**
- Lógica: `src/lib/__tests__/kdbx-smoke.ts`
- Disparador: `src/main.tsx` (dynamic import condicional)
- Endpoint Rust: `log_smoke_result` em `src-tauri/src/lib.rs` (logger
  genérico, reusável para outros benchmarks futuros)

**Gating strategy:**

```typescript
// src/main.tsx
const SHOULD_RUN_SMOKE =
  import.meta.env.DEV || import.meta.env.VITE_RUN_SMOKE === "1";

if (SHOULD_RUN_SMOKE) {
  void import("./lib/__tests__/kdbx-smoke").then(({ runKdbxSmokeTest }) =>
    runKdbxSmokeTest(),
  );
}
```

**Comportamento por modo de build:**

| Modo | `import.meta.env.DEV` | `VITE_RUN_SMOKE` | Smoke roda? |
|---|---|---|---|
| `npm run tauri dev` | `true` | qualquer | ✅ sim |
| `tauri build` (release default) | `false` | unset | ❌ não |
| `tauri build` com `VITE_RUN_SMOKE=1` | `false` | `"1"` | ✅ sim (intencional, para benchmarks) |

**Por que essa estratégia funciona:**

1. **Dynamic import:** Vite faz tree-shaking real — em release default,
   o arquivo `kdbx-smoke.ts` nem entra no bundle (chunk separado,
   carregado apenas quando a condição é verdadeira).
2. **DEV automático:** detecta ambiente de desenvolvimento sem requerer
   variável de ambiente manual.
3. **Override controlado:** `VITE_RUN_SMOKE=1` permite disparar em
   release builds intencionalmente (ex: validar performance pós-build,
   benchmarks comparativos).
4. **Endpoint Rust separado:** `log_smoke_result` é genérico — não
   contém lógica de teste, apenas roteia mensagens para `println!` +
   arquivo de log. Pode ser reusado por outros benchmarks futuros sem
   acoplar ao smoke test específico.

**Senhas dummy:** o smoke test usa senhas placeholder (`test123`,
`super-secret`, `benchmark-password`) que estão explicitamente marcadas
no código como falsos positivos para scanners de credenciais. Não
substituir por senhas "fortes" — o objetivo é justamente serem
identificáveis como dummy.

**Output em log:** mesmo em DEV, o `log_smoke_result` escreve em
`%TEMP%/sec-basis-bench.log` (silencioso se falhar). Esse arquivo
preserva histórico de benchmarks entre execuções, útil para analisar
regressões de performance ao longo do tempo.

**Decisão arquitetural:** smoke test não é pollutant — é instrumento.
Não remover. Não tornar mais restritivo (já está bem gated). Documentar
para futuros contributors entenderem o design.

**Lição operacional:** Sessão 9 inicialmente marcou smoke test como
"TODO de cleanup" sem investigar o código. Sessão 10 investigou e
descobriu que arquitetura era sólida. Princípio: antes de marcar
algo como dívida técnica, investigar se realmente é problema.

---

## 27. Subgrupos expansíveis na sidebar (Sessão 11)

**Contexto:** KDBX permite hierarquia arbitrária de grupos, mas a
sidebar do Sec.Basis até a Sessão 10 só renderizava filhos diretos
do grupo raiz. Cofres importados de KeePassXC com hierarquia
profunda (típico em uso real) ficavam mal representados.

**Implementação:**

- **Selector `useGroupTree()`** em
  [vault.ts](src/stores/vault.ts) — retorna a árvore inteira (sempre
  array de length 1: o nó raiz com `children` recursivos). Memoizado
  por `[kdbx, vaultVersion, recycleBinUuidId]` (ver §15 — sem isso,
  loop infinito do `useSyncExternalStore`). Cada nó tem
  `{ uuid, name, depth, children, parentUuid, isRecycleBin, entryCount }`.
  `name` já passa por `getGroupDisplayName` (Lixeira i18n).

- **Componente recursivo
  [`<GroupTreeItem />`](src/components/vault/GroupTreeItem.tsx)** —
  renderiza um nó e chama a si mesmo para cada filho expandido.
  Indentação `Math.min(depth * 12, 96) + 8px` (estilo VS Code:
  satura em nível 8, texto sempre legível).

- **DOIS `<button>` separados** (chevron + nome do grupo). Click no
  nome seleciona; click no chevron alterna expand/collapse. Sem
  `stopPropagation` — semântica HTML correta com elementos clicáveis
  distintos.

- **Persistência:** `expandedGroupsByVault: { [vaultPath]: string[] }`
  em [`useSettingsStore`](src/stores/settings.ts) → localStorage.
  Mesmo padrão de `keyFilePathByVault` (§6). Estado por cofre, sobre-
  vive entre sessões.

- **Nó raiz:** `forceExpanded={true}` — sem chevron, sempre mostra
  filhos. Faz sentido pro "container do cofre" (evita confusão "por
  que não posso colapsar o cofre?"). Lixeira respeita a hierarquia
  como qualquer outro grupo (com chevron quando tem subgrupos).

- **Ordenação visual:** `buildGroupTreeNode()` ordena os filhos por nome
  com `localeCompare("pt-BR", { sensitivity: "base" })`. Essa ordenação
  é apenas de apresentação: a ordem física dos grupos dentro do `.kdbx`
  não é regravada. O grupo Lixeira configurado em `meta.recycleBinUuid`
  sempre é renderizado por último em seu nível, independentemente do nome.

- **Ícones e cores de grupos:** cada nó também carrega `iconId` e
  `iconColorId`, lidos de `customData` com chaves próprias do Sec.Basis
  (`sec.basis.groupIcon` e `sec.basis.groupIconColor`). A UI usa ícones
  Lucide, incluindo `Scale` para a opção "Jurídico", e uma paleta pequena
  de cores nomeadas. Isso não altera o `IconID` nativo do KeePass; outros
  clientes ignoram esses metadados e continuam abrindo o cofre.

**Keyboard nav recursiva:** flatten visível (`flattenVisible(tree,
predicate)` em GroupSidebar) gera lista linear dos nós atualmente
exibidos. ↑/↓ navega; → expande grupo focado (se folha pode receber
focus mas não faz nada); ← colapsa OU sobe pro pai se já colapsado
(estilo VS Code Explorer / KeePassXC). Nó raiz é âncora — ← sobre o
raiz não faz nada.

**`confirmDiscardIfDirty`** continua sendo aplicado APENAS na
mudança de seleção (não no toggle de chevron) — alternar visual de
um grupo não descarta draft.

**Decisão de não-feature:** sem cache do flatten visível além do
`useMemo` natural — re-derivação é O(n) e aciona só quando o set
expandido ou a árvore muda. Cofres com >10k grupos podem precisar de
otimização futura, mas isso é hipotético.

**Estado inicial:** `expandedGroupsByVault[vaultPath]` ausente (sem
registro persistido) → conjunto vazio → todos os grupos colapsados.
A UX inicial sempre mostra o primeiro nível porque o nó raiz tem
`forceExpanded`.

---

## 28. PRs de Dependabot stale (Sessão 12)

**Contexto:** Dependabot abre PRs em branches separadas para atualizações
de dependências. Se um PR ficar aberto sem ser mergeado por várias
sessões, a branch fica "stale" — baseada em commit antigo do `main`,
sem as features adicionadas depois. Mergear um PR stale via "Squash and
merge" do GitHub UI **pode silenciosamente reverter** trabalho recente
quando os arquivos divergem demais.

**Como verificar se PR é seguro de mergear:**

```bash
git fetch origin
git diff main origin/dependabot/<branch-name> -- package.json
git diff --stat main origin/dependabot/<branch-name>
git log main..origin/dependabot/<branch-name> --oneline
git log origin/dependabot/<branch-name>..main --oneline | wc -l
```

Sinais de PR stale:
- Diff stat com **deleções massivas** em arquivos não relacionados a
  dependências (ex: arquivos `.tsx`, `.rs`, docs)
- `git log main..PR_branch` mostra apenas 1 commit (`chore(deps)...`)
- `git log PR_branch..main` mostra **muitos commits** que o PR não tem

Se for PR stale, **NÃO mergear via GitHub UI**. Opções:

1. **Fechar PR** (mais seguro): Dependabot reabre em base limpa no
   próximo schedule. Atrasa update por ~1 semana mas zero risco.
2. **`@dependabot rebase`**: comentar no PR; Dependabot tenta rebase
   automático. Pode falhar com conflitos grandes.
3. **Aplicar manualmente**: cherry-pick das mudanças em branch nova
   baseada em main atual. Sessão dedicada.

**Decisão de processo Sec.Basis:** Caminho 1 (fechar). Atraso aceitável
para dev dependencies. Major bumps merecem sessão própria de qualquer
forma. Quando o PR reabrir limpo, avaliar deps individualmente.

**Histórico:**
- **PR fechado (Sessão 12):** `dependabot/npm_and_yarn/dev-dependencies-2f25c8d3ab`
  — branch baseada em `caffd14` (Sessão 4.5), 15 commits atrás de
  `58c0be9` (Sessão 11). Propunha 3 major bumps: vite 7→8,
  typescript 5→6, @vitejs/plugin-react 4→6. Mergear teria deletado
  ~25 arquivos das Sessões 5-11. Fechado para Dependabot reabrir em
  base limpa.

**Lição:** PRs de Dependabot precisam de `git diff` antes de qualquer
ação. UI do GitHub não protege contra stale merge se os arquivos
divergem entre branches.

### Reforço Sessão 22 — Padrões consolidados

A Sessão 22 trouxe 4 catches críticos que reforçam e expandem §28.

**Catch 1 — Auto-fechamento Dependabot existe**

PRs zustand 5.0.13 e dev-dependencies-2f25c8d3ab foram auto-fechados
pelo Dependabot entre S21 e S22 (descoberto via inspeção da página
de PRs do GitHub UI mostrando "✓ 2 Closed: 3-4 days ago"). Heurística
provável: Dependabot fecha PRs próprios quando versão proposta já está
instalada, ou quando branch base fica muito stale. Lição: auditar
`is:closed` periodicamente confirma estado real.

**Catch 2 — PR cirúrgico ≠ PR seguro**

PR hono 4.12.18 tinha diff de apenas 12 linhas em package-lock.json
(parecia patch trivial), mas estava 1 commit behind main. Mergear
via UI sem rebase reverteria fast-uri 3.1.2 (vulnerability high) que
tinha sido mergeado minutos antes na mesma sessão. Lição: sempre
confirmar `git diff origin/main origin/<branch>` modifica APENAS a
dependency esperada — não confiar em "diff é pequeno?".

**Catch 3 — PRs Dependabot stale podem deletar trabalho recente**

PR tauri 2.11.1 tinha base em S20 (4 commits behind main). Mergear
via UI sem rebase deletaria PoweredByBasis.tsx, external.ts, marcos
S19+S20+S21 do CLAUDE.md, e reverteria fast-uri + hono da S22.
Lição: pattern §28 (S12) re-aplica — diff stat é primeira validação,
mas diff conteúdo (`git diff` completo) é a segunda.

**Catch 4 — Branches stale ressuscitam**

Branch `dev-dependencies-2f25c8d3ab` foi fechada em S12 (15 commits
behind), reapareceu em S22 (33 commits behind), re-fechada em S22.
Não é bug: GitHub mantém branches mesmo após PR fechado (configurável
em Settings → "Automatically delete head branches", off por default).
Major bumps perigosos (plugin-react 4→6, vite 7→8, ts 5→6) são
trabalho dedicado por sessão, não merge automático.

### Padrão consolidado de processamento Dependabot

Toda PR Dependabot exige:

1. Investigação via `git diff origin/main origin/<branch> --stat`
2. Verificar merge base é `origin/main` atual:
   `git merge-base origin/main origin/<branch>`
3. Se stale + patch bump: `@dependabot rebase` no PR via comment,
   aguardar 5-15 min, re-investigar diff pós-rebase, mergear via
   "Squash and merge"
4. Se stale + major bump: fechar PR via UI com comment técnico
   citando §28
5. Se cirúrgico: confirmar diff modifica APENAS dependency esperada
   (nada mais)
6. Após merge: sync local (`git pull`) + validação completa
   (TSC + Lint + npm audit / cargo check conforme caso)
7. Documentar em commit message as decisões e validações

Sessões 12 e 22 estabeleceram este padrão. Próxima sessão de
Dependabot (S25? quando alerts/PRs novos aparecerem) deve seguir
este checklist.

---

## 29. CI básico GitHub Actions (Sessões 13, 18)

**Contexto:** projeto adota quality gate via GitHub Actions a partir
da Sessão 13. Roda em todo push em `main` e em todo pull request
visando `main`.

**Workflow:** `.github/workflows/ci.yml`. Três jobs paralelos:

1. **TypeScript check:** `npx tsc --noEmit` — pega erros de tipo sem
   gerar artefatos.
2. **Rust check:** `cargo check --all-targets` em `src-tauri/` — pega
   erros de compilação Rust sem gerar binário.
3. **ESLint check** (`npm run lint` → `eslint . --max-warnings=0` em
   flat config v9). Falha em qualquer warning. Convenções de
   supressão documentadas em §33.

**Decisões arquiteturais:**

- **Ubuntu runner** (não Windows): mais rápido, mais barato em minutos
  GitHub. Suficiente porque CI é **checagem de código**, não build de
  release. Empacotamento Windows acontece em pipeline separado quando
  for ativado.
- **Linux deps de Tauri instaladas no job Rust:** `libwebkit2gtk-4.1-dev`,
  `libayatana-appindicator3-dev`, `librsvg2-dev`, `libxdo-dev`,
  `libssl-dev`, `patchelf`. Sem essas libs, `cargo check` falha porque
  `tauri-runtime-wry` puxa `glib`/`gtk`/`webkit2gtk` no Linux (vide §25).
  Ubuntu 24.04 renomeou `libappindicator3-dev` para
  `libayatana-appindicator3-dev`.
- **`npm ci` em vez de `npm install`:** respeita `package-lock.json`
  exatamente, falha se lock divergir do manifest (proteção contra
  inconsistências commitadas).
- **Cache:** `actions/setup-node@v4` com `cache: 'npm'` (built-in) +
  `Swatinem/rust-cache@v2` (cache de cargo registry + target/). Runs
  subsequentes ~30s vs ~3 min from-scratch.
- **`cargo check --all-targets`:** inclui tests/examples/benches no
  type check (mais coverage que `cargo check` default).

**Branch protection:** **NÃO ativada inicialmente.** Validar
funcionamento por 1-2 semanas antes de tornar CI obrigatório para
merge no `main`. Quando ativar, ir em GitHub Settings → Branches →
Branch protection rules → Require status checks to pass.

**Versões pinadas:**
- Node 22 (current LTS aligned with project)
- Rust stable (latest at run time, refreshed by toolchain action)
- Actions: pinned ao major (`@v4`, `@v2`) — Dependabot atualiza minor/patch

**Lição:** CI básico desde alpha protege qualidade sem custo de
desenvolvimento. Não over-engineer com smoke tests headless ou audits
preventivamente — adicionar quando dor real for identificada.

---

## 30. Vulnerabilidades em devDependencies (Sessão 14)

**Contexto:** Dependabot reporta vulnerabilidades também em
devDependencies (ferramentas de build, CLI tools, scaffolding) e em
suas transitivas. Para devDependencies que não executam no runtime do
app e não vão para o binário entregue ao usuário, o impacto real para
end-users é tipicamente zero.

Esse padrão é **conceitualmente distinto** da §25 (vulnerabilidades
Linux-only): ali o critério é arquitetura de target (Windows-only
binary não inclui código Linux); aqui o critério é fase do ciclo de
vida (devDep nunca compila no bundle de produção).

**Critério de avaliação:**

Antes de dispensar, validar todas as condições:

1. **A dep está em devDependencies?** Verificar `package.json` (não
   `dependencies`).
2. **A dep tem caminho de execução no app?** Buscar imports/requires:
   `grep -r "from.*<package>" src/ src-tauri/`. Esperado: zero matches.
3. **O código vulnerável é alcançável?** Ler advisory upstream — alguns
   advisories declaram explicitamente que código vulnerável é dead code
   (ex: GHSA do ip-address: "zero consumers across 425 dependent npm
   packages").
4. **A dep entra no bundle de produção?** Para Tauri+Vite, validar que
   a dep não é importada por código que vai para `dist/`. devDeps
   típicas (CLI scaffolding, linters, type-checkers, test runners)
   não entram.

Se todas as 4 condições indicam "não exposto", dispensar como
"Risk tolerable" no GitHub UI com justificativa documentada referenciando
esta seção.

**Diferença prática para §25:**

| Critério | §25 (Linux-only) | §30 (devDep não-runtime) |
|---|---|---|
| Tipo de exclusão | Build target (Windows) | Fase de ciclo (dev) |
| Comando de validação | `cargo tree --target ...` | `grep -r imports + package.json` |
| Risco residual | Código transitivo nunca compilado | Código nunca executado |
| Auto-resolução | Quando upstream patch | Quando devDep upstream atualiza |

**Histórico:**

- **Alerta dispensado (Sessão 14):** GHSA em `ip-address < 10.1.1`
  (XSS em `Address6.group/link/parseMessage`). Cadeia:
  `shadcn@4.7.0` (devDep) → `express-rate-limit@8.5.0` →
  `ip-address@10.1.0`. Sec.Basis não importa `ip-address` em runtime;
  shadcn é CLI tool de scaffolding executada apenas durante
  desenvolvimento. Upstream advisory documenta zero consumers dos
  métodos vulneráveis. Dispensado como "Risk tolerable — vulnerable
  code not reachable from Sec.Basis runtime, devDep does not ship in
  binary".

**Lição operacional:** Dependabot updates job pode falhar quando uma
vulnerability transitiva não tem patch disponível na versão fixada por
um pacote pai. Esse erro **não bloqueia** desenvolvimento — apenas
indica que Dependabot não consegue propor PR de fix. Auto-resolve
quando o pacote pai atualiza sua dep direta.

---

## 31. Smart App Control e Mark-of-the-Web em projetos Tauri (Sessão 15)

**Contexto:** Windows 11 (a partir do build 22H2) inclui Smart App
Control — proteção de segurança que bloqueia execução de binários não
assinados quando esses binários estão em pastas com Mark-of-the-Web
(MOTW). MOTW é flag aplicada automaticamente a:

- Pastas `Downloads/` (qualquer arquivo baixado por navegador)
- Pastas sincronizadas pelo OneDrive
- Pastas sincronizadas pelo Dropbox
- Arquivos extraídos de ZIPs baixados

**Sintoma específico em Tauri:**

Ao rodar `npm run tauri dev` em pasta com MOTW, o build falha com:

```
error 4551 (ERROR_WHC_PUBLISHER_DENIED)
```

apontando para `target\debug\build\<crate>-<hash>\build-script-build`.
A mensagem completa indica que o `.exe` produzido pelo Cargo
(build-script intermediário, não o app final) não pode ser executado.

**Causa raiz:** Cargo gera build scripts compilados como `.exe` que
precisam executar durante o build. Esses `.exe` não são assinados.
Smart App Control bloqueia execução em pastas com MOTW. Resultado:
Cargo não consegue completar o build.

**Disparador específico de quando aparece:**

O `error 4551` não aparece em todo build — aparece quando o `.exe` do
build-script muda de hash. Isso acontece quando:

- Versão do projeto muda (ex: bump em `Cargo.toml`)
- Dependências mudam (após `cargo update`)
- Compilação from-scratch (após `cargo clean`)

Builds incrementais sem mudança de hash funcionam (Smart App Control
parece ter cache de "este hash já foi visto e bloqueado", mas se o
hash já existia antes do bloqueio, executa).

**Mitigação:** mover projeto para pasta SEM MOTW. Sugestão:
`C:\dev\<projeto>\`. Pastas em `C:\Users\<user>\` que NÃO sejam
`Downloads`, `OneDrive\<algo>`, ou similar não têm MOTW por default.

**Histórico:**

- **Sessão 9.5/10 (máquina nova Windows 11):** primeiro encontro com
  `error 4551` ao bumpar versão para `0.1.0-alpha`. Build script gerou
  novo `.exe` com hash novo, Smart App Control bloqueou. Solução:
  mover de `Downloads/03 - Projetos/Code_Playground/sec.basis` para
  `C:\dev\secbasis`. Build voltou a funcionar.
- **Sessão 11+ (máquina original):** projeto continuou em
  `Downloads/...`. Sem `error 4551` porque builds anteriores já tinham
  populado cache "OK" do Smart App Control para os hashes em uso.
  Provável que próximo bump de versão ou `cargo clean` reproduza o
  problema.

**Recomendação:** projetos Tauri devem viver em pasta sem MOTW desde
o início. Para repos clonados em `Downloads/`, mover para `C:\dev\`
preventivamente. Comando:

```powershell
# Da raiz do projeto, em PowerShell:
$source = (Get-Location).Path
$dest = "C:\dev\$(Split-Path -Leaf $source)"
Move-Item -Path $source -Destination $dest
cd $dest
```

Após mover, rodar `cargo clean && npm run tauri dev` para confirmar
que Smart App Control não bloqueia mais.

**Lição operacional:** problemas de "binário não consegue executar
durante build" em Windows 11 são frequentemente Smart App Control,
não bug de código. Investigar variável de ambiente `MOTW` antes de
debug profundo de Cargo/Tauri/PATH/permissions.

---

## 32. Empacotamento Windows — planejamento estratégico (Sessão 16)

**Status:** planejamento documentado. Implementação será feita em
sessão dedicada quando os pré-requisitos estiverem resolvidos.

### Contexto

Sec.Basis é o primeiro produto sob o domínio `basis.app.br` (família
de aplicações). Decisões de empacotamento são tomadas considerando
que:

- Sec.Basis é e permanecerá 100% FOSS gratuito, sem versão paga,
  licenciamento comercial, ou freemium.
- O projeto opera atualmente sem entidade jurídica registrada, com
  possível registro futuro sujeito a análise individual.
- Sem entidade jurídica, code signing fica limitado a Standard Code
  Signing como pessoa física — EV Code Signing é inviável (exige
  CNPJ na maioria dos fornecedores).

### Decisões cravadas

**Formato:**

- **Instalador: MSI** (não NSIS). Padrão corporativo, formal,
  alinhado com posicionamento profissional do produto. Tauri suporta
  MSI nativamente via WiX (`bundle.windows.wix` em `tauri.conf.json`).
- **Identificador do bundle:** a definir em sessão de empacotamento
  real (`bundle.identifier` em formato reverse-DNS, provavelmente
  `app.basis.sec` ou similar).

**Code signing — estratégia de adiamento:**

- **Alpha:** sai SEM code signing. Público técnico (developers, early
  adopters) tolera warnings de "publisher unknown" via Windows
  Defender SmartScreen ("More info → Run anyway").
- **Beta:** também SEM code signing. Decisão consciente de adiar
  investimento em certificado até resolver questões de entidade. Beta
  sem signing é prática comum em projetos FOSS pequenos; KeePass
  histórico operou anos sem signing perfeito.
- **1.0 release:** COM code signing. Tipo de cert e Publisher name
  dependem do estado da entidade no momento — decisão final adiada
  para quando 1.0 estiver no horizonte.
- **Custo evitado:** ~US$ 200-400/ano em Standard cert, multiplicado
  por anos de espera = US$ 200-1.200+ que ficam disponíveis para o
  projeto crescer organicamente sem pressão de cerimônia.

**Distribuição:**

- **Canais primários:** GitHub Releases + `sec.basis.app.br`.
- **GitHub Releases:** gratuito, integrado, padrão FOSS. Tag
  versionada (`v0.1.0-alpha`, `v0.2.0-alpha`, etc.).
- **Site oficial:** link direto para asset do GitHub Release (não
  duplicar hosting). Reduz manutenção.
- **Sem outros canais inicialmente:** sem Microsoft Store, Chocolatey,
  Scoop, winget. Avaliar pós-1.0 se demanda surgir.

### Decisões diferidas (resolver em sessões futuras)

**Antes do 1.0 release (pré-requisitos):**

1. **Decisão sobre entidade jurídica.** Se entidade for confirmada
   como viável, registrar antes do 1.0. Se mantida pessoa física,
   seguir com Standard cert PF.

2. **Fornecedor de certificado.** Candidatos a investigar quando
   momento chegar:
   - Sectigo (~US$ 200/ano, vários resellers)
   - SSL.com (~US$ 250/ano)
   - DigiCert (~US$ 400/ano, premium)

   Critérios: custo total, processo KYC, jurisdição, suporte ao
   Brasil, reviews recentes, compatibilidade com `signtool.exe` ou
   `osslsigncode`.

3. **Workflow de release no GitHub Actions.** Provavelmente:
   - Trigger: push de tag `v*`
   - Build em runner Windows (não Ubuntu — release real precisa
     Windows)
   - `tauri build` produz MSI
   - Code signing via `signtool.exe` (após cert disponível)
   - Upload de assets para GitHub Release
   - Atualização do site oficial (link direto para asset)

4. **Publisher name no certificado.** Decisão depende do estado da
   entidade quando o cert for adquirido. Variantes (sigla, iniciais)
   dependem de aceitação do fornecedor — alguns só emitem com nome
   exato do documento.

5. **Auto-update mechanism (opcional).** Tauri suporta auto-update
   via `tauri-plugin-updater`. Decidir entre:
   - Manter manual (usuário re-baixa) — mais simples, padrão FOSS
     pequeno
   - Auto-update (mais complexo, requer endpoint próprio para
     metadata, hosting de releases assinadas)

6. **Smart App Control e build de release.** §31 documenta
   `error 4551` em pasta com MOTW. Build de release pode bater no
   mesmo problema. Pré-requisito: mover projeto para `C:\dev\secbasis`
   antes do primeiro `tauri build` de release.

### Roteiro estimado para sessão de empacotamento real

Quando os pré-requisitos estiverem resolvidos (entidade decidida,
fornecedor de cert escolhido, cert adquirido), a sessão dedicada
provavelmente terá:

1. Mover projeto para `C:\dev\secbasis` (se ainda em `Downloads/`)
2. Configurar `tauri.conf.json` para release (`bundle.windows.wix`,
   `bundle.identifier`, ícones, metadata)
3. Criar workflow `.github/workflows/release.yml` com trigger em
   push de tag
4. Importar certificado no runner (via secret + decode em base64)
5. Configurar `signCommand` ou `signtool` no Tauri config
6. Validar build local (`tauri build` → MSI no
   `src-tauri/target/release/bundle/msi/`)
7. Validar instalação em VM Windows limpa (UAC prompt, Add/Remove
   Programs, atalhos, desinstalação)
8. Push de tag de teste (`v0.0.0-test`) para validar workflow
9. Documentar processo final em §32 atualizada e novo §33 (workflow
   de release)

Tempo estimado dessa sessão real: 4-6 horas + período de validação
em VM. Não cabe em sessão "rápida".

### Riscos identificados

- **Smart App Control bloqueando build de release** (vide §31).
  Mitigação: mover para `C:\dev\` antes.
- **`tauri build` quebrando funcionalidades que `tauri dev` não pega.**
  MSI carrega assets de forma diferente. Validar em VM limpa, não em
  máquina de desenvolvimento.
- **Cert sendo invalidado se chave privada vazar.** Hardware token
  (não usado em Standard) protege contra isso. Standard exige guarda
  cuidadosa do `.pfx` + senha. Preferência: armazenar como GitHub
  Secret encrypted, nunca em disco local.
- **Custo do cert renovando anualmente.** Sec.Basis sem monetização
  → renovação sai do bolso pessoal. Decisão de seguir ou não pode
  ser revisitada anualmente.
- **Microsoft SmartScreen reputation.** Cert standard começa com
  reputação zero. Primeiros downloads ainda mostram warning até
  reputação acumular (~50-100 downloads). Documentar para usuários
  quando momento chegar.

### Lição operacional

Empacotamento profissional não é só `tauri build`. É decisão
estratégica que envolve:

- Identidade jurídica (pessoa física vs entidade)
- Investimento financeiro recorrente (cert anual)
- Processo de release reproduzível (workflow CI/CD)
- Validação em ambiente isolado (VM, não dev machine)
- Comunicação com usuários (warnings esperados, processo de
  instalação)

Adiar empacotamento até que decisões estratégicas estejam resolvidas
é prudência, não procrastinação. Sec.Basis em alpha/beta pode rodar
como `npm run tauri dev` para early adopters técnicos, ou via build
não-assinado para usuários FOSS-friendly, sem prejuízo. Empacotamento
assinado entra quando a foundation legal/financeira estiver
estabelecida.

---

## 33. ESLint setup e convenções de supressão (Sessão 18)

### Setup

ESLint 9.x configurado com flat config (`eslint.config.js`). Plugins
ativos:

- `typescript-eslint` — parser + regras recommended para TypeScript
- `eslint-plugin-react-hooks` — `react-hooks/recommended`
- `eslint-plugin-react-refresh` — para Vite HMR

**Strict mode:** o script `npm run lint` roda
`eslint . --max-warnings=0` — qualquer warning falha o lint. CI
integrado como 3º job paralelo (vide §29).

### Override shadcn

Componentes em `src/components/ui/**` desabilitam
`react-refresh/only-export-components`. Justificativa: shadcn
vendored exporta `cva` variants e helpers junto com o componente
React (padrão upstream do projeto), o que viola a regra. Refatorar
para extrair non-component exports divergiria da convenção shadcn
sem ganho prático.

### Convenções de supressão

Padrão para qualquer `eslint-disable-next-line`:

1. Linha(s) de comentário explicando o porquê acima
2. `eslint-disable-next-line <regra>` nu (sem `-- reason` inline) na
   linha imediatamente antes do código

**Razão técnica:** ESLint trata texto após `eslint-disable-next-line`
como **lista de regras separadas por vírgula**. Sintaxe
`rule -- reason` vira nome de regra inválido (`rule --`), não
delimitador de comentário. Padrão alternativo (comentários antes +
disable nu) é equivalente em legibilidade e funciona.

Exemplo:

```typescript
// vaultVersion é cache-buster intencional (§15): incrementa a cada
// mutação in-place do kdbx; força re-execução sem ser referenciado.
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [kdbx, vaultVersion, recycleBinUuidId]);
```

### Supressões documentadas (Sessão 18)

**`src/stores/vault.ts` — 5 ocorrências de `react-hooks/exhaustive-deps`:**

`vaultVersion` é listado em deps array de cinco `useMemo` sem ser
referenciado no callback. Padrão intencional do §15:
`vaultVersion` é incrementado a cada mutação in-place do `kdbx`
(que é referência estável). ESLint não tem como inferir essa
relação. Hooks afetados:

- `useEntriesOfCurrentGroup`
- `useAllEntries` (S17)
- `useTopLevelGroups` (legacy)
- `useGroupTree` (S11)
- `useRecycleBinUuidId`

**`src/components/vault/CreateVaultTab.tsx:464` — `no-control-regex`:**

Regex de sanitização de filename usa range `\x00-\x1F` (caracteres
de controle ASCII) intencionalmente — esses caracteres são inválidos
em filenames de Windows/Linux/macOS, e a regex substitui-os por `_`
antes de criar o arquivo `.kdbx`.

**`src/components/vault/PasswordGenerator.tsx:81` —
`react-hooks/exhaustive-deps`:**

Pré-existente desde sessão anterior. `useEffect` dispara apenas
quando `open` muda, não quando `options` muda — decisão intencional
(toda abertura mostra senha fresca, não a última gerada). Mantido
como está; comentário explicativo pode ser adicionado em sessão
futura de cleanup.

### Lição operacional

ESLint sem instalação é **decoração**. Comentários `eslint-disable`
em código sem o linter instalado não suprimem nada — funcionam
apenas como sinalização ao desenvolvedor. Quando ESLint finalmente
entrou no projeto (Sessão 18), descoberta concreta: 4 disables
pré-existentes eram **órfãos** (em `OpenVaultTab.tsx`,
`UnlockScreen.tsx` e 2 no `vault.ts` que tinham comportamento
diferente). ESLint moderno reportou-os como `Unused eslint-disable
directive`.

**Princípio:** adicionar `eslint-disable` apenas quando há regra
real a suprimir, com comentário explicativo. Adições preventivas
viram dívida documental.
