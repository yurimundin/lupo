import { beforeEach, describe, expect, it, vi } from "vitest";

import type { KdbxEntry } from "kdbxweb";

const { invokeMock, kdfSetMock, setKdfMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  kdfSetMock: vi.fn(),
  setKdfMock: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: invokeMock,
}));

vi.mock("kdbxweb", () => {
  class Credentials {
    ready = Promise.resolve();

    constructor(
      public password: unknown,
      public keyFileBytes?: Uint8Array | null,
    ) {}

    static createRandomKeyFile = vi.fn(async () => new Uint8Array([7, 8, 9]));
  }

  return {
    CryptoEngine: {
      setArgon2Impl: vi.fn(),
    },
    ProtectedValue: {
      fromString: vi.fn((value: string) => ({ protected: value })),
    },
    Credentials,
    Kdbx: {
      create: vi.fn(() => ({
        header: {
          kdfParameters: {
            set: kdfSetMock,
          },
        },
        setKdf: setKdfMock,
      })),
      load: vi.fn(),
    },
    Consts: {
      KdfId: {
        Argon2id: "argon2id",
      },
    },
    VarDictionary: {
      ValueType: {
        UInt64: "UInt64",
        UInt32: "UInt32",
      },
    },
    Int64: {
      from: vi.fn((value: number) => value),
    },
  };
});

import {
  addEntryAttachmentInVault,
  createVault,
  emptyRecycleBin,
  getEntryAttachments,
  moveEntryToGroup,
  moveEntryToRecycleBin,
  removeEntryAttachmentInVault,
  restoreEntryFromRecycleBin,
  saveVault,
  setEntryFavoriteInVault,
  setGroupVisualIconInVault,
} from "./kdbx";

interface FakeUuid {
  id: string;
  empty?: boolean;
}

interface FakeEntry {
  uuid: FakeUuid;
  parentGroup?: FakeGroup;
  binaries: Map<string, { hash: string; value: ArrayBuffer }>;
  customData?: Map<string, { value: string; lastModified?: Date }>;
  times: { update: () => void };
}

interface FakeGroup {
  uuid: FakeUuid;
  name: string;
  entries: FakeEntry[];
  groups: FakeGroup[];
  parentGroup?: FakeGroup;
  customData?: Map<string, { value: string; lastModified?: Date }>;
  times: { update: () => void };
}

interface FakeDb {
  meta: { recycleBinUuid?: FakeUuid };
  deletedObjects: unknown[];
  save: ReturnType<typeof vi.fn>;
  createBinary: ReturnType<typeof vi.fn>;
  getDefaultGroup: () => FakeGroup;
  getGroup: (uuid: FakeUuid) => FakeGroup | undefined;
  createRecycleBin: () => void;
  move: (item: FakeEntry | FakeGroup, toGroup?: FakeGroup) => void;
}

function entry(id: string): FakeEntry {
  return { uuid: { id }, binaries: new Map(), times: { update: vi.fn() } };
}

function group(id: string, name: string): FakeGroup {
  return {
    uuid: { id },
    name,
    entries: [],
    groups: [],
    times: { update: vi.fn() },
  };
}

function attachEntry(parent: FakeGroup, item: FakeEntry): void {
  item.parentGroup = parent;
  parent.entries.push(item);
}

function attachGroup(parent: FakeGroup, child: FakeGroup): void {
  child.parentGroup = parent;
  parent.groups.push(child);
}

function makeDb(): { db: FakeDb; root: FakeGroup; recycleBin: FakeGroup } {
  const root = group("root", "Root");
  const recycleBin = group("trash", "Recycle Bin");
  attachGroup(root, recycleBin);
  let binaryId = 0;

  const db: FakeDb = {
    meta: { recycleBinUuid: recycleBin.uuid },
    deletedObjects: [],
    save: vi.fn(async () => new Uint8Array([1, 2, 3]).buffer),
    createBinary: vi.fn(async (value: ArrayBuffer) => {
      binaryId += 1;
      return { hash: `hash-${binaryId}`, value };
    }),
    getDefaultGroup: () => root,
    getGroup: (uuid) => findGroup(root, uuid.id),
    createRecycleBin: vi.fn(() => undefined),
    move: (item, toGroup) => {
      if ("entries" in item) {
        if (item.parentGroup) {
          item.parentGroup.groups = item.parentGroup.groups.filter(
            (child) => child !== item,
          );
        }
        if (toGroup) {
          attachGroup(toGroup, item);
        } else {
          item.parentGroup = undefined;
        }
        return;
      }

      if (item.parentGroup) {
        item.parentGroup.entries = item.parentGroup.entries.filter(
          (entryItem) => entryItem !== item,
        );
      }
      if (toGroup) {
        attachEntry(toGroup, item);
      } else {
        item.parentGroup = undefined;
        db.deletedObjects.push({ uuid: item.uuid.id });
      }
    },
  };

  return { db, root, recycleBin };
}

function findGroup(root: FakeGroup, id: string): FakeGroup | undefined {
  if (root.uuid.id === id) return root;
  for (const child of root.groups) {
    const found = findGroup(child, id);
    if (found) return found;
  }
  return undefined;
}

const asDb = (value: FakeDb) => value as unknown as Parameters<typeof saveVault>[1];
const asEntry = (value: FakeEntry) => value as unknown as KdbxEntry;
const asGroup = (value: FakeGroup) => value as unknown as Parameters<
  typeof setGroupVisualIconInVault
>[2];

describe("kdbx helpers", () => {
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

  it("stores a Sec.Basis favorite marker on an entry", async () => {
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
    expect(item.customData?.get("sec.basis.entryFavorite")?.value).toBe("true");
    expect(item.times.update).toHaveBeenCalled();
  });

  it("rolls the previous favorite marker back when saving fails", async () => {
    const { db, root } = makeDb();
    const item = entry("entry");
    item.customData = new Map([
      ["sec.basis.entryFavorite", { value: "true", lastModified: new Date(0) }],
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
    expect(item.customData.get("sec.basis.entryFavorite")?.value).toBe("true");
  });

  it("adds an entry attachment as a KDBX binary and persists the vault", async () => {
    const { db, root } = makeDb();
    const item = entry("entry");
    attachEntry(root, item);

    const result = await addEntryAttachmentInVault(
      "C:/vault.kdbx",
      asDb(db),
      asEntry(item),
      "contrato.pdf",
      new Uint8Array([10, 20, 30]),
    );

    expect(result).toEqual({
      ok: true,
      durationMs: 12,
      attachmentName: "contrato.pdf",
    });
    expect(db.createBinary).toHaveBeenCalledOnce();
    expect(item.binaries.has("contrato.pdf")).toBe(true);
    expect(getEntryAttachments(asEntry(item))).toEqual([
      { name: "contrato.pdf", sizeBytes: 3 },
    ]);
    expect(item.times.update).toHaveBeenCalled();
  });

  it("adds a suffix when an entry attachment name already exists", async () => {
    const { db, root } = makeDb();
    const item = entry("entry");
    attachEntry(root, item);
    item.binaries.set("contrato.pdf", {
      hash: "existing",
      value: new Uint8Array([1]).buffer,
    });

    const result = await addEntryAttachmentInVault(
      "C:/vault.kdbx",
      asDb(db),
      asEntry(item),
      "contrato.pdf",
      new Uint8Array([2]),
    );

    expect(result).toEqual({
      ok: true,
      durationMs: 12,
      attachmentName: "contrato (2).pdf",
    });
    expect(item.binaries.has("contrato.pdf")).toBe(true);
    expect(item.binaries.has("contrato (2).pdf")).toBe(true);
  });

  it("rolls an added attachment back when saving fails", async () => {
    const { db, root } = makeDb();
    const item = entry("entry");
    attachEntry(root, item);
    invokeMock.mockRejectedValue("save falhou");

    const result = await addEntryAttachmentInVault(
      "C:/vault.kdbx",
      asDb(db),
      asEntry(item),
      "contrato.pdf",
      new Uint8Array([10, 20, 30]),
    );

    expect(result).toEqual({ ok: false, error: "save falhou" });
    expect(item.binaries.size).toBe(0);
  });

  it("removes an entry attachment and rolls back when saving fails", async () => {
    const { db, root } = makeDb();
    const item = entry("entry");
    attachEntry(root, item);
    const originalBinary = {
      hash: "existing",
      value: new Uint8Array([1, 2]).buffer,
    };
    item.binaries.set("contrato.pdf", originalBinary);
    invokeMock.mockRejectedValue("save falhou");

    const result = await removeEntryAttachmentInVault(
      "C:/vault.kdbx",
      asDb(db),
      asEntry(item),
      "contrato.pdf",
    );

    expect(result).toEqual({ ok: false, error: "save falhou" });
    expect(item.binaries.get("contrato.pdf")).toBe(originalBinary);
  });
});
