import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  asDb,
  invokeMock,
  kdfSetMock,
  makeDb,
  setKdfMock,
} from "./kdbx-test-utils";
import { createVault, saveVault } from "./kdbx";

describe("kdbx core helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invokeMock.mockResolvedValue(12);
  });

  it("applies secure Argon2id KDF parameters when creating a vault", async () => {
    await createVault("Test", "master-password");

    expect(setKdfMock).toHaveBeenCalledWith("argon2id");
    expect(kdfSetMock).toHaveBeenCalledWith("M", "UInt64", 64 * 1024 * 1024);
    expect(kdfSetMock).toHaveBeenCalledWith("I", "UInt64", 2);
    expect(kdfSetMock).toHaveBeenCalledWith("P", "UInt32", 2);
  });

  it("serializes and persists an existing vault through the backend", async () => {
    const { db } = makeDb();

    const result = await saveVault("C:/vault.kdbx", asDb(db));

    expect(result).toEqual({ ok: true, durationMs: 12 });
    expect(invokeMock).toHaveBeenCalledWith("save_vault_with_backup", {
      filePath: "C:/vault.kdbx",
      vaultBytes: [1, 2, 3],
    });
  });

  it("returns a save error without throwing when the backend fails", async () => {
    const { db } = makeDb();
    invokeMock.mockRejectedValue("disco cheio");

    await expect(saveVault("C:/vault.kdbx", asDb(db))).resolves.toEqual({
      ok: false,
      error: "disco cheio",
    });
  });
});
