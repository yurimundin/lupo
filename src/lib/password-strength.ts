// Indicador de força de senha usado na criação de cofre, gerador e auditoria.
//
// Continua leve e offline-first: sem zxcvbn no MVP. A heurística abaixo não
// tenta medir entropia com precisão acadêmica; ela combina tamanho, variedade
// e penalidades para padrões que usuários realmente repetem.

export type StrengthLevel = 0 | 1 | 2 | 3;

export interface PasswordStrengthContext {
  title?: string;
  username?: string;
  url?: string;
}

export interface PasswordStrength {
  /** Nível 0..3 (Fraca / Razoável / Boa / Forte). */
  level: StrengthLevel;
  /** Rótulo em PT-BR pra exibição. */
  label: "Fraca" | "Razoável" | "Boa" | "Forte";
  /**
   * Token semântico do tema para colorir a barra: usar como
   * `bg-${semantic}` (`bg-destructive`, `bg-warning`, `bg-primary`,
   * `bg-success`).
   */
  semantic: "destructive" | "warning" | "primary" | "success";
  /** Percentual 0..100 para alimentar o componente Progress. */
  percent: number;
  /** Pontuação normalizada 0..100 para auditoria e ordenação. */
  score: number;
  /** Alertas objetivos sobre problemas encontrados. */
  warnings: string[];
  /** Sugestões curtas e acionáveis. */
  suggestions: string[];
}

const COMMON_TERMS = [
  "123456",
  "12345678",
  "123456789",
  "password",
  "passw0rd",
  "senha",
  "senhas",
  "admin",
  "administrator",
  "welcome",
  "qwerty",
  "abc123",
  "letmein",
  "iloveyou",
  "dragon",
  "monkey",
  "football",
  "baseball",
  "basis",
] as const;

const KEYBOARD_SEQUENCES = [
  "abcdefghijklmnopqrstuvwxyz",
  "qwertyuiop",
  "asdfghjkl",
  "zxcvbnm",
  "0123456789",
] as const;

/**
 * Pontua uma senha em 4 níveis com base em comprimento, variedade,
 * padrões previsíveis e contexto da entrada.
 */
export function computePasswordStrength(
  password: string,
  context: PasswordStrengthContext = {},
): PasswordStrength {
  const warnings: string[] = [];
  const suggestions = new Set<string>();

  if (password.length === 0) {
    return toStrength(0, ["Senha vazia."], ["Defina uma senha."]);
  }

  let score = 0;

  score += Math.min(password.length * 4, 48);
  if (password.length >= 12) score += 8;
  if (password.length >= 16) score += 10;
  if (password.length >= 20) score += 8;

  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);
  const variety = [hasLower, hasUpper, hasDigit, hasSymbol].filter(Boolean).length;
  score += variety * 7;

  if (password.length < 8) {
    score -= 35;
    warnings.push("Senha muito curta.");
    suggestions.add("Use pelo menos 12 caracteres.");
  } else if (password.length < 12) {
    score -= 15;
    warnings.push("Senha curta.");
    suggestions.add("Prefira 12 caracteres ou mais.");
  }

  if (variety <= 1) {
    score -= 20;
    warnings.push("Usa pouca variedade de caracteres.");
    suggestions.add("Misture letras, números e símbolos.");
  } else if (variety === 2) {
    score -= 8;
    suggestions.add("Adicionar mais tipos de caracteres ajuda.");
  }

  if (hasRepeatedSingleChar(password)) {
    score -= 35;
    warnings.push("Contém repetição excessiva do mesmo caractere.");
    suggestions.add("Evite repetições como aaaaaa ou 111111.");
  }

  if (hasRepeatedChunk(password)) {
    score -= 25;
    warnings.push("Contém bloco repetido.");
    suggestions.add("Evite padrões repetidos como abcabc.");
  }

  if (hasSequence(password)) {
    score -= 25;
    warnings.push("Contém sequência previsível.");
    suggestions.add("Evite sequências como 123456, abcdef ou qwerty.");
  }

  if (containsCommonTerm(password)) {
    score -= 30;
    warnings.push("Contém palavra ou senha comum.");
    suggestions.add("Evite palavras comuns e senhas populares.");
  }

  const contextHits = getContextHits(password, context);
  if (contextHits.length > 0) {
    score -= 25;
    warnings.push(`Contém parte de ${contextHits.join(", ")}.`);
    suggestions.add("Não use nome do serviço, usuário ou domínio na senha.");
  }

  return toStrength(score, warnings, [...suggestions]);
}

function toStrength(
  rawScore: number,
  warnings: string[],
  suggestions: string[],
): PasswordStrength {
  const score = clamp(Math.round(rawScore), 0, 100);
  let level: StrengthLevel;
  if (score < 35) level = 0;
  else if (score < 60) level = 1;
  else if (score < 80) level = 2;
  else level = 3;

  const labels: Record<StrengthLevel, PasswordStrength["label"]> = {
    0: "Fraca",
    1: "Razoável",
    2: "Boa",
    3: "Forte",
  };
  const semantics: Record<StrengthLevel, PasswordStrength["semantic"]> = {
    0: "destructive",
    1: "warning",
    2: "primary",
    3: "success",
  };
  const percents: Record<StrengthLevel, number> = {
    0: score === 0 ? 0 : 25,
    1: 50,
    2: 75,
    3: 100,
  };

  return {
    level,
    label: labels[level],
    semantic: semantics[level],
    percent: percents[level],
    score,
    warnings,
    suggestions,
  };
}

function hasRepeatedSingleChar(password: string): boolean {
  return /(.)\1{4,}/i.test(password);
}

function hasRepeatedChunk(password: string): boolean {
  const normalized = password.toLowerCase();
  for (let size = 2; size <= 4; size++) {
    for (let i = 0; i <= normalized.length - size * 3; i++) {
      const chunk = normalized.slice(i, i + size);
      if (chunk.repeat(3) === normalized.slice(i, i + size * 3)) {
        return true;
      }
    }
  }
  return false;
}

function hasSequence(password: string): boolean {
  const normalized = password.toLowerCase();
  for (const sequence of KEYBOARD_SEQUENCES) {
    if (containsSequence(normalized, sequence)) return true;
    if (containsSequence(normalized, reverse(sequence))) return true;
  }
  return false;
}

function containsSequence(value: string, sequence: string): boolean {
  for (let size = 4; size <= sequence.length; size++) {
    for (let i = 0; i <= sequence.length - size; i++) {
      if (value.includes(sequence.slice(i, i + size))) return true;
    }
  }
  return false;
}

function containsCommonTerm(password: string): boolean {
  const normalized = normalizeToken(password);
  return COMMON_TERMS.some((term) => normalized.includes(normalizeToken(term)));
}

function getContextHits(
  password: string,
  context: PasswordStrengthContext,
): string[] {
  const normalizedPassword = normalizeToken(password);
  const hits: string[] = [];
  const candidates: Array<[string, string | undefined]> = [
    ["título", context.title],
    ["usuário", context.username],
    ["domínio", extractDomain(context.url)],
  ];

  for (const [label, raw] of candidates) {
    const tokens = tokenizeContext(raw);
    if (tokens.some((token) => normalizedPassword.includes(token))) {
      hits.push(label);
    }
  }

  return hits;
}

function tokenizeContext(value: string | undefined): string[] {
  if (!value) return [];
  return normalizeToken(value)
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 4);
}

function extractDomain(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const withProtocol = /^[a-z][a-z0-9+.-]*:/i.test(value)
      ? value
      : `https://${value}`;
    const hostname = new URL(withProtocol).hostname.replace(/^www\./i, "");
    return hostname.split(".")[0];
  } catch {
    return value;
  }
}

function normalizeToken(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[@$!|]/g, (char) => {
      const replacements: Record<string, string> = {
        "@": "a",
        "$": "s",
        "!": "i",
        "|": "l",
      };
      return replacements[char] ?? char;
    });
}

function reverse(value: string): string {
  return [...value].reverse().join("");
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
