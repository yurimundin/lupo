import { describe, expect, it } from "vitest";

import { computePasswordStrength } from "./password-strength";

describe("computePasswordStrength", () => {
  it("classifies empty passwords as weak with zero progress", () => {
    expect(computePasswordStrength("")).toMatchObject({
      level: 0,
      label: "Fraca",
      semantic: "destructive",
      percent: 0,
      score: 0,
      warnings: ["Senha vazia."],
    });
  });

  it("rewards length and character variety", () => {
    expect(computePasswordStrength("abc").level).toBe(0);
    expect(computePasswordStrength("r8Kp2mQz").level).toBe(1);
    expect(computePasswordStrength("V8y$kPz!42mQxR7@").level).toBe(3);
  });

  it("penalizes common patterns and sequences", () => {
    const repeated = computePasswordStrength("aaaaaaaaaaaa");
    const sequence = computePasswordStrength("abcdef123456");
    const common = computePasswordStrength("Password123!");

    expect(repeated.level).toBe(0);
    expect(repeated.warnings).toContain(
      "Contém repetição excessiva do mesmo caractere.",
    );
    expect(sequence.warnings).toContain("Contém sequência previsível.");
    expect(common.warnings).toContain("Contém palavra ou senha comum.");
  });

  it("penalizes passwords that include entry context", () => {
    const result = computePasswordStrength("GithubYuri2026!", {
      title: "GitHub",
      username: "yuri",
      url: "https://github.com",
    });

    expect(result.warnings).toContain("Contém parte de título, usuário, domínio.");
    expect(result.suggestions).toContain(
      "Não use nome do serviço, usuário ou domínio na senha.",
    );
  });
});
