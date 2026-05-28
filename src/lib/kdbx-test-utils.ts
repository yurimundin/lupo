import type { Kdbx, KdbxEntry, KdbxGroup } from "kdbxweb";
import { vi } from "vitest";

const hoistedMocks = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  kdfSetMock: vi.fn(),
  setKdfMock: vi.fn(),
}));

export const invokeMock = hoistedMocks.invokeMock;
export const kdfSetMock = hoistedMocks.kdfSetMock;
export const setKdfMock = hoistedMocks.setKdfMock;

vi.mock("@tauri-apps/api/core", () => ({
  invoke: invokeMock,
}));

vi.mock("kdbxweb", () => {
  class ProtectedValue {
    constructor(private value: string) {}

    static fromString = vi.fn((value: string) => new ProtectedValue(value));

    getText(): string {
      return this.value;
    }

    clone(): ProtectedValue {
      return new ProtectedValue(this.value);
    }
  }

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
    ProtectedValue,
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

export interface FakeUuid {
  id: string;
  empty?: boolean;
}

export interface FakeEntry {
  uuid: FakeUuid;
  parentGroup?: FakeGroup;
  fields: Map<string, unknown>;
  binaries: Map<string, { hash: string; value: ArrayBuffer }>;
  history: FakeEntry[];
  customData?: Map<string, { value: string; lastModified?: Date }>;
  times: FakeTimes;
  pushHistory: ReturnType<typeof vi.fn>;
  removeHistory: ReturnType<typeof vi.fn>;
}

export interface FakeTimes {
  lastModTime: Date | null;
  update: ReturnType<typeof vi.fn>;
  clone: () => FakeTimes;
}

export interface FakeGroup {
  uuid: FakeUuid;
  name: string;
  entries: FakeEntry[];
  groups: FakeGroup[];
  parentGroup?: FakeGroup;
  customData?: Map<string, { value: string; lastModified?: Date }>;
  times: { update: () => void };
}

export interface FakeDb {
  meta: { recycleBinUuid?: FakeUuid };
  deletedObjects: unknown[];
  save: ReturnType<typeof vi.fn>;
  createBinary: ReturnType<typeof vi.fn>;
  createEntry: (parent: FakeGroup) => FakeEntry;
  getDefaultGroup: () => FakeGroup;
  getGroup: (uuid: FakeUuid) => FakeGroup | undefined;
  createRecycleBin: () => void;
  move: (item: FakeEntry | FakeGroup, toGroup?: FakeGroup) => void;
}

export function times(lastModTime: Date | null = null): FakeTimes {
  const state: FakeTimes = {
    lastModTime,
    update: vi.fn(() => {
      state.lastModTime = new Date("2026-05-28T12:00:00Z");
    }),
    clone: () => times(state.lastModTime ? new Date(state.lastModTime) : null),
  };
  return state;
}

export function entry(id: string): FakeEntry {
  const item: FakeEntry = {
    uuid: { id },
    fields: new Map(),
    binaries: new Map(),
    history: [],
    times: times(),
    pushHistory: vi.fn(),
    removeHistory: vi.fn(),
  };
  item.pushHistory.mockImplementation(() => {
    item.history.push(cloneEntry(item));
  });
  item.removeHistory.mockImplementation((index: number, count = 1) => {
    item.history.splice(index, count);
  });
  return item;
}

export function group(id: string, name: string): FakeGroup {
  return {
    uuid: { id },
    name,
    entries: [],
    groups: [],
    times: { update: vi.fn() },
  };
}

export function attachEntry(parent: FakeGroup, item: FakeEntry): void {
  item.parentGroup = parent;
  parent.entries.push(item);
}

export function attachGroup(parent: FakeGroup, child: FakeGroup): void {
  child.parentGroup = parent;
  parent.groups.push(child);
}

export function setEntryFields(
  item: FakeEntry,
  fields: {
    title?: string;
    username?: string;
    password?: unknown;
    url?: string;
    notes?: string;
  },
): void {
  item.fields.set("Title", fields.title ?? "");
  item.fields.set("UserName", fields.username ?? "");
  item.fields.set("Password", fields.password ?? "");
  item.fields.set("URL", fields.url ?? "");
  item.fields.set("Notes", fields.notes ?? "");
}

export function makeDb(): {
  db: FakeDb;
  root: FakeGroup;
  recycleBin: FakeGroup;
} {
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
    createEntry: (parent: FakeGroup) => {
      const item = entry(`entry-${parent.entries.length + 1}`);
      attachEntry(parent, item);
      return item;
    },
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

export const asDb = (value: FakeDb) => value as unknown as Kdbx;
export const asEntry = (value: FakeEntry) => value as unknown as KdbxEntry;
export const asGroup = (value: FakeGroup) => value as unknown as KdbxGroup;

function cloneEntry(source: FakeEntry): FakeEntry {
  const item = entry(source.uuid.id);
  item.parentGroup = source.parentGroup;
  item.fields = new Map(source.fields);
  item.binaries = new Map(source.binaries);
  item.history = [...source.history];
  item.customData = source.customData
    ? new Map(source.customData)
    : undefined;
  item.times = source.times.clone();
  return item;
}

function findGroup(root: FakeGroup, id: string): FakeGroup | undefined {
  if (root.uuid.id === id) return root;
  for (const child of root.groups) {
    const found = findGroup(child, id);
    if (found) return found;
  }
  return undefined;
}
