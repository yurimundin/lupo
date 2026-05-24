import { describe, expect, it, vi } from "vitest";

import { auditVaultEntries } from "./vault-audit";

import type { KdbxEntry } from "kdbxweb";

function entry(input: {
  id: string;
  title?: string;
  username?: string;
  url?: string;
  password?: string;
  lastModTime?: Date | null;
}): KdbxEntry {
  return {
    uuid: { id: input.id },
    fields: new Map([
      ["Title", input.title ?? ""],
      ["UserName", input.username ?? ""],
      ["URL", input.url ?? ""],
      ["Password", input.password ?? ""],
    ]),
    times: { lastModTime: input.lastModTime ?? null },
  } as unknown as KdbxEntry;
}

describe("auditVaultEntries", () => {
  it("flags weak, missing and old entries", () => {
    vi.setSystemTime(new Date("2026-05-24T00:00:00Z"));

    const result = auditVaultEntries(
      [
        entry({
          id: "weak",
          title: "Email",
          username: "",
          url: "",
          password: "123456",
          lastModTime: new Date("2024-01-01T00:00:00Z"),
        }),
        entry({
          id: "missing",
          title: "Empty",
          username: "user",
          url: "https://example.com",
          password: "",
        }),
      ],
      { oldEntryDays: 365 },
    );

    expect(result.summary).toMatchObject({ totalEntries: 2, high: 2, low: 3 });
    expect(result.findings.map((finding) => finding.type)).toEqual(
      expect.arrayContaining([
        "weak-password",
        "missing-password",
        "missing-url",
        "missing-username",
        "old-entry",
      ]),
    );

    vi.useRealTimers();
  });

  it("flags reused passwords and duplicate URLs", () => {
    const result = auditVaultEntries([
      entry({
        id: "one",
        title: "GitHub pessoal",
        username: "a",
        url: "https://github.com/login",
        password: "SameStrongPassword!234",
      }),
      entry({
        id: "two",
        title: "GitHub trabalho",
        username: "b",
        url: "https://www.github.com/login/",
        password: "SameStrongPassword!234",
      }),
    ]);

    const reused = result.findings.find(
      (finding) => finding.type === "reused-password",
    );
    const duplicateUrl = result.findings.find(
      (finding) => finding.type === "duplicate-url",
    );

    expect(reused?.severity).toBe("high");
    expect(reused?.entryIds).toEqual(["one", "two"]);
    expect(duplicateUrl?.severity).toBe("medium");
    expect(duplicateUrl?.entryIds).toEqual(["one", "two"]);
  });

  it("does not flag a healthy unique entry", () => {
    const result = auditVaultEntries([
      entry({
        id: "healthy",
        title: "Banco",
        username: "cliente",
        url: "https://bank.example",
        password: "V8y$kPz!42mQxR7@",
        lastModTime: new Date(),
      }),
    ]);

    expect(result.summary).toEqual({
      totalEntries: 1,
      high: 0,
      medium: 0,
      low: 0,
    });
    expect(result.findings).toEqual([]);
  });
});
