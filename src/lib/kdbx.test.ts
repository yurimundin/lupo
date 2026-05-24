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
  createVault,
  emptyRecycleBin,
  moveEntryToRecycleBin,
  restoreEntryFromRecycleBin,
  saveVault,
} from "./kdbx";

interface FakeUuid {
  id: string;
  empty?: boolean;
}

interface FakeEntry {
  uuid: FakeUuid;
  parentGroup?: FakeGroup;
}

interface FakeGroup {
  uuid: FakeUuid;
  name: string;
  entries: FakeEntry[];
  groups: FakeGroup[];
  parentGroup?: FakeGroup;
  times: { update: () => void };
}

interface FakeDb {
  meta: { recycleBinUuid?: FakeUuid };
  deletedObjects: unknown[];
  save: ReturnType<typeof vi.fn>;
  getDefaultGroup: () => FakeGroup;
  getGroup: (uuid: FakeUuid) => FakeGroup | undefined;
  createRecycleBin: () => void;
  move: (item: FakeEntry | FakeGroup, toGroup?: FakeGroup) => void;
}

function entry(id: string): FakeEntry {
  return { uuid: { id } };
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

  const db: FakeDb = {
    meta: { recycleBinUuid: recycleBin.uuid },
    deletedObjects: [],
    save: vi.fn(async () => new Uint8Array([1, 2, 3]).buffer),
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
});
