import { beforeEach, describe, expect, it, vi } from "vitest";

import { asDb, asGroup, invokeMock, makeDb } from "./kdbx-test-utils";
import { setGroupVisualIconInVault } from "./kdbx";

describe("kdbx group visual helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invokeMock.mockResolvedValue(12);
  });

  it("stores a Sec.Basis visual group icon without changing KeePass icon ids", async () => {
    const { db, root } = makeDb();

    const result = await setGroupVisualIconInVault(
      "C:/vault.kdbx",
      asDb(db),
      asGroup(root),
      "shield",
      "green",
    );

    expect(result).toEqual({ ok: true, durationMs: 12 });
    expect(root.customData?.get("sec.basis.groupIcon")?.value).toBe("shield");
    expect(root.customData?.get("sec.basis.groupIconColor")?.value).toBe(
      "green",
    );
    expect(root.times.update).toHaveBeenCalled();
    expect("icon" in root).toBe(false);
  });

  it("rolls the previous visual group icon back when saving fails", async () => {
    const { db, root } = makeDb();
    root.customData = new Map([
      ["sec.basis.groupIcon", { value: "home", lastModified: new Date(0) }],
      ["sec.basis.groupIconColor", { value: "blue", lastModified: new Date(0) }],
    ]);
    invokeMock.mockRejectedValue("save falhou");

    const result = await setGroupVisualIconInVault(
      "C:/vault.kdbx",
      asDb(db),
      asGroup(root),
      "shield",
      "green",
    );

    expect(result).toEqual({ ok: false, error: "save falhou" });
    expect(root.customData.get("sec.basis.groupIcon")?.value).toBe("home");
    expect(root.customData.get("sec.basis.groupIconColor")?.value).toBe("blue");
  });
});
