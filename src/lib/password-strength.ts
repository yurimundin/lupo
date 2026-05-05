// Indicador simples de força de senha — usado na criação de cofre.
//
// Deliberadamente NÃO usa zxcvbn (mantém o bundle leve no MVP).
// Se a Fase 2 trouxer auditoria séria de senhas, trocaremos por zxcvbn aí.
// O cálculo aqui prioriza dar um sinal rápido ao usuário, não uma
// medição precisa de entropia.

export type StrengthLevel = 0 | 1 | 2 | 3;

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
}

/**
 * Pontua uma senha em 4 níveis com base em comprimento e variedade de
 * caracteres. Algoritmo intencionalmente simples — ver nota no topo do
 * arquivo.
 */
export function computePasswordStrength(password: string): PasswordStrength {
  if (password.length === 0) {
    return { level: 0, label: "Fraca", semantic: "destructive", percent: 0 };
  }

  let score = 0;

  // Comprimento — fonte principal de força em senhas reais.
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (password.length >= 16) score += 1;
  if (password.length >= 20) score += 1;

  // Diversidade de caracteres — bônus pequeno (variety theatre, mas ajuda).
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);
  const variety = [hasLower, hasUpper, hasDigit, hasSymbol].filter(Boolean).length;
  if (variety >= 2) score += 1;
  if (variety >= 3) score += 1;
  if (variety === 4) score += 1;

  // Mapeia score (0..7) para nível (0..3).
  let level: StrengthLevel;
  if (score <= 1) level = 0;
  else if (score <= 3) level = 1;
  else if (score <= 5) level = 2;
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
    0: 25,
    1: 50,
    2: 75,
    3: 100,
  };

  return {
    level,
    label: labels[level],
    semantic: semantics[level],
    percent: percents[level],
  };
}
