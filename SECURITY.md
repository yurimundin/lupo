# Política de Segurança

## ⚠️ Status do projeto

Sec.Basis está em desenvolvimento ativo e ainda **não passou por auditoria
de segurança independente**. NÃO use Sec.Basis para armazenar senhas reais
até o primeiro release estável e auditado. Para uso em produção,
recomendamos [KeePassXC](https://keepassxc.org/).

## Reportando vulnerabilidades

Se você descobriu uma vulnerabilidade de segurança no Sec.Basis,
**NÃO abra uma issue pública**. Reporte de forma responsável:

- **E-mail:** `[PLACEHOLDER — substituir após criação manual de e-mail dedicado]`
- **Tempo de resposta esperado:** confirmação de recebimento em até **48 horas**, primeira análise em até **7 dias**.
- **PGP key:** _TODO — adicionar quando o e-mail dedicado for configurado._

## Escopo

### Conta como vulnerabilidade

- Exposição da senha mestra ou de qualquer entrada do cofre.
- Vazamento do conteúdo do cofre (descriptografado em memória ou em disco).
- Falhas na implementação criptográfica (Argon2, AES, ChaCha20, derivação de chave).
- Bypass do mecanismo de auto-lock.
- Bypass do auto-clear de clipboard.
- Vulnerabilidades em dependências que afetam o produto.
- Escalation de privilégios local.

### NÃO conta como vulnerabilidade

- Usuário escolher senha mestra fraca (responsabilidade do usuário).
- Usuário perder o key file (comportamento documentado — sem key file, sem cofre).
- Comprometimento do sistema operacional do usuário (fora do escopo do Sec.Basis).
- Vulnerabilidades teóricas em algoritmos sem prova de exploração.

## Reconhecimento

Pesquisadores que reportarem vulnerabilidades serão reconhecidos no
hall of fame (em breve), salvo solicitação explícita de anonimato.

---

# Security Policy (English)

## ⚠️ Project status

Sec.Basis is under active development and **has not yet undergone an
independent security audit**. DO NOT use Sec.Basis to store real
passwords until the first stable, audited release. For production use,
we recommend [KeePassXC](https://keepassxc.org/).

## Reporting vulnerabilities

If you discovered a security vulnerability in Sec.Basis, **DO NOT open a
public issue**. Report it responsibly:

- **Email:** `[PLACEHOLDER — to be replaced once the dedicated mailbox is set up]`
- **Expected response time:** acknowledgement within **48 hours**, initial analysis within **7 days**.
- **PGP key:** _TODO — to be added once the dedicated email is configured._

## Scope

### Counts as a vulnerability

- Exposure of the master password or any vault entry.
- Leakage of vault contents (decrypted in memory or on disk).
- Flaws in the cryptographic implementation (Argon2, AES, ChaCha20, key derivation).
- Bypass of the auto-lock mechanism.
- Bypass of the clipboard auto-clear.
- Vulnerabilities in dependencies that affect the product.
- Local privilege escalation.

### Does NOT count as a vulnerability

- User choosing a weak master password (user responsibility).
- User losing the key file (documented behavior — no key file, no vault).
- Compromise of the user's operating system (out of scope for Sec.Basis).
- Theoretical algorithm vulnerabilities without proof of exploitation.

## Recognition

Researchers reporting vulnerabilities will be acknowledged in the hall of
fame (coming soon), unless they explicitly request anonymity.
