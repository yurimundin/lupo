import { describe, expect, it } from "vitest";

import { DEFAULT_OPTIONS, generatePassword } from "./password-generator";

describe("generatePassword", () => {
  it("returns an empty string when no category is enabled", () => {
    expect(
      generatePassword({
        length: 20,
        useLowercase: false,
        useUppercase: false,
        useNumbers: false,
        useSymbols: false,
        avoidAmbiguous: true,
      }),
    ).toBe("");
  });

  it("honors the requested length and enabled categories", () => {
    const password = generatePassword(DEFAULT_OPTIONS);

    expect(password).toHaveLength(DEFAULT_OPTIONS.length);
    expect(password).toMatch(/[a-z]/);
    expect(password).toMatch(/[A-Z]/);
    expect(password).toMatch(/[0-9]/);
    expect(password).toMatch(/[^A-Za-z0-9]/);
  });

  it("excludes ambiguous characters by default", () => {
    const password = generatePassword({
      ...DEFAULT_OPTIONS,
      length: 64,
      useSymbols: false,
      avoidAmbiguous: true,
    });

    expect(password).not.toMatch(/[lI1O0]/);
  });
});
