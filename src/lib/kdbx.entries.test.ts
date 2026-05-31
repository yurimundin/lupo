import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  asDb,
  asEntry,
  asGroup,
  attachEntry,
  attachGroup,
  entry,
  group,
  invokeMock,
  makeDb,
} from "./kdbx-test-utils";
import {
  createEntryInVault,
  duplicateEntryInVault,
  emptyRecycleBin,
  moveEntryToGroup,
  moveEntryToRecycleBin,
  restoreEntryFromRecycleBin,
  setEntryFavoriteInVault,
} from "./kdbx";

describe("kdbx entry helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invokeMock.mockResolvedValue(12);
  });

  it("creates an entry through the KDBX domain layer", async () => {
    const { db, root } = makeDb();

    const result = await createEntryInVault(
      "C:/vault.kdbx",
      asDb(db),
      asGroup(root),
      {
        title: "GitHub",
        username: "octo",
        password: "secret",
        url: "https://github.com",
        notes: "2FA",
      },
    );

    expect(result.ok).toBe(true);
    expect(root.entries).toHaveLength(1);
    const item = root.entries[0];
    expect(item.fields.get("Title")).toBe("GitHub");
    expect(item.fields.get("UserName")).toBe("octo");
    expect(item.fields.get("URL")).toBe("https://github.com");
    expect(item.fields.get("Notes")).toBe("2FA");
    expect(item.times.update).toHaveBeenCalled();
  });

  it("rolls a newly created entry back when saving fails", async () => {
    const { db, root } = makeDb();
    invokeMock.mockRejectedValue("save falhou");

    const result = await createEntryInVault(
      "C:/vault.kdbx",
      asDb(db),
      asGroup(root),
      {
        title: "GitHub",
        username: "",
        password: "",
        url: "",
        notes: "",
      },
    );

    expect(result).toEqual({ ok: false, error: "save falhou" });
    expect(root.entries).toHaveLength(0);
  });

  it("duplicates an entry into the same group with cloned fields and a copy title", async () => {
    const { db, root } = makeDb();
    const item = entry("github");
    const password = {
      clone: vi.fn(() => ({ marker: "cloned-password" })),
      getText: vi.fn(() => "secret"),
    };
    item.fields = new Map<string, unknown>([
      ["Title", "GitHub"],
      ["UserName", "octo"],
      ["Password", password],
      ["URL", "https://github.com"],
      ["Notes", "2FA"],
      ["Custom", "extra"],
    ]);
    item.binaries = new Map([
      ["recovery.txt", { hash: "hash-1", value: new ArrayBuffer(2) }],
    ]);
    item.customData = new Map([
      ["lupo.entryFavorite", { value: "true", lastModified: new Date(0) }],
    ]);
    attachEntry(root, item);

    const result = await duplicateEntryInVault(
      "C:/vault.kdbx",
      asDb(db),
      asEntry(item),
    );

    expect(result.ok).toBe(true);
    expect(root.entries).toHaveLength(2);
    const copy = root.entries[1];
    expect(copy).not.toBe(item);
    expect(copy.parentGroup).toBe(root);
    expect(copy.fields.get("Title")).toBe("GitHub (cópia)");
    expect(copy.fields.get("UserName")).toBe("octo");
    expect(copy.fields.get("URL")).toBe("https://github.com");
    expect(copy.fields.get("Notes")).toBe("2FA");
    expect(copy.fields.get("Custom")).toBe("extra");
    expect(copy.fields.get("Password")).toEqual({ marker: "cloned-password" });
    expect(password.clone).toHaveBeenCalledOnce();
    expect(copy.binaries).toEqual(item.binaries);
    expect(copy.binaries).not.toBe(item.binaries);
    expect(copy.customData).toEqual(item.customData);
    expect(copy.customData).not.toBe(item.customData);
    expect(copy.times.update).toHaveBeenCalled();
  });

  it("rolls a duplicated entry back when saving fails", async () => {
    const { db, root } = makeDb();
    const item = entry("github");
    item.fields.set("Title", "GitHub");
    attachEntry(root, item);
    invokeMock.mockRejectedValue("save falhou");

    const result = await duplicateEntryInVault(
      "C:/vault.kdbx",
      asDb(db),
      asEntry(item),
    );

    expect(result).toEqual({ ok: false, error: "save falhou" });
    expect(root.entries).toEqual([item]);
  });

  it("rolls an entry back to its original group when moving to trash fails", async () => {
    const { db, root, recycleBin } = makeDb();
    const item = entry("entry");
    attachEntry(root, item);
    invokeMock.mockRejectedValue("save falhou");

    const result = await moveEntryToRecycleBin(
      "C:/vault.kdbx",
      asDb(db),
      asEntry(item),
    );

    expect(result).toEqual({ ok: false, error: "save falhou" });
    expect(item.parentGroup).toBe(root);
    expect(root.entries).toContain(item);
    expect(recycleBin.entries).not.toContain(item);
  });

  it("moves an entry to another group and persists the vault", async () => {
    const { db, root } = makeDb();
    const source = group("source", "Source");
    const target = group("target", "Target");
    attachGroup(root, source);
    attachGroup(root, target);
    const item = entry("entry");
    attachEntry(source, item);

    const result = await moveEntryToGroup(
      "C:/vault.kdbx",
      asDb(db),
      asEntry(item),
      asGroup(target),
    );

    expect(result).toEqual({ ok: true, durationMs: 12 });
    expect(item.parentGroup).toBe(target);
    expect(target.entries).toContain(item);
    expect(source.entries).not.toContain(item);
  });

  it("rolls an entry back to its original group when moving to another group fails", async () => {
    const { db, root } = makeDb();
    const source = group("source", "Source");
    const target = group("target", "Target");
    attachGroup(root, source);
    attachGroup(root, target);
    const item = entry("entry");
    attachEntry(source, item);
    invokeMock.mockRejectedValue("save falhou");

    const result = await moveEntryToGroup(
      "C:/vault.kdbx",
      asDb(db),
      asEntry(item),
      asGroup(target),
    );

    expect(result).toEqual({ ok: false, error: "save falhou" });
    expect(item.parentGroup).toBe(source);
    expect(source.entries).toContain(item);
    expect(target.entries).not.toContain(item);
  });

  it("rolls a restored entry back into the recycle bin when save fails", async () => {
    const { db, recycleBin } = makeDb();
    const item = entry("entry");
    attachEntry(recycleBin, item);
    invokeMock.mockRejectedValue("save falhou");

    const result = await restoreEntryFromRecycleBin(
      "C:/vault.kdbx",
      asDb(db),
      asEntry(item),
    );

    expect(result).toEqual({ ok: false, error: "save falhou" });
    expect(item.parentGroup).toBe(recycleBin);
    expect(recycleBin.entries).toContain(item);
  });

  it("restores recycle bin entries and tombstones when emptying fails", async () => {
    const { db, recycleBin } = makeDb();
    const first = entry("first");
    const second = entry("second");
    attachEntry(recycleBin, first);
    attachEntry(recycleBin, second);
    db.deletedObjects.push({ uuid: "old" });
    invokeMock.mockRejectedValue("save falhou");

    const result = await emptyRecycleBin("C:/vault.kdbx", asDb(db));

    expect(result).toEqual({ ok: false, error: "save falhou" });
    expect(recycleBin.entries).toEqual([first, second]);
    expect(first.parentGroup).toBe(recycleBin);
    expect(second.parentGroup).toBe(recycleBin);
    expect(db.deletedObjects).toEqual([{ uuid: "old" }]);
  });

  it("stores a Lupo favorite marker on an entry", async () => {
    const { db, root } = makeDb();
    const item = entry("entry");
    attachEntry(root, item);

    const result = await setEntryFavoriteInVault(
      "C:/vault.kdbx",
      asDb(db),
      asEntry(item),
      true,
    );

    expect(result).toEqual({ ok: true, durationMs: 12 });
    expect(item.customData?.get("lupo.entryFavorite")?.value).toBe("true");
    expect(item.times.update).toHaveBeenCalled();
  });

  it("rolls the previous favorite marker back when saving fails", async () => {
    const { db, root } = makeDb();
    const item = entry("entry");
    item.customData = new Map([
      ["lupo.entryFavorite", { value: "true", lastModified: new Date(0) }],
    ]);
    attachEntry(root, item);
    invokeMock.mockRejectedValue("save falhou");

    const result = await setEntryFavoriteInVault(
      "C:/vault.kdbx",
      asDb(db),
      asEntry(item),
      false,
    );

    expect(result).toEqual({ ok: false, error: "save falhou" });
    expect(item.customData.get("lupo.entryFavorite")?.value).toBe("true");
  });
});
