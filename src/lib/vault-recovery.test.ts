import { describe, expect, it } from "vitest";

import type { VaultRecoveryState } from "@/lib/fs";

import {
  canRestoreBackup,
  getRecoverySummary,
  shouldShowRecoveryPrompt,
} from "./vault-recovery";

function state(
  overrides: Partial<VaultRecoveryState> = {},
): VaultRecoveryState {
  const baseFile = {
    path: "C:/vault.kdbx",
    exists: true,
    size: 512,
    modifiedMs: 1,
    hasKdbxMagic: true,
  };
  return {
    vault: baseFile,
    tmp: {
      ...baseFile,
      path: "C:/vault.kdbx.tmp",
      exists: false,
      hasKdbxMagic: false,
    },
    bak: {
      ...baseFile,
      path: "C:/vault.kdbx.bak",
      exists: true,
      hasKdbxMagic: true,
    },
    needsAttention: false,
    ...overrides,
  };
}

describe("vault recovery UI rules", () => {
  it("does not interrupt opening for a normal backup created by regular saves", () => {
    expect(shouldShowRecoveryPrompt(state())).toBe(false);
  });

  it("shows recovery when a temporary save file is still present", () => {
    const recoveryState = state({
      tmp: {
        path: "C:/vault.kdbx.tmp",
        exists: true,
        size: 512,
        modifiedMs: 2,
        hasKdbxMagic: true,
      },
      needsAttention: true,
    });

    expect(shouldShowRecoveryPrompt(recoveryState)).toBe(true);
    expect(getRecoverySummary(recoveryState)).toContain("gravacao interrompida");
  });

  it("offers restore only when the backup has KDBX magic bytes", () => {
    expect(canRestoreBackup(state())).toBe(true);
    expect(
      canRestoreBackup(
        state({
          bak: {
            path: "C:/vault.kdbx.bak",
            exists: true,
            size: 4,
            modifiedMs: 3,
            hasKdbxMagic: false,
          },
        }),
      ),
    ).toBe(false);
  });
});

