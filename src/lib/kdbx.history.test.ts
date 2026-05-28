import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  asDb,
  asEntry,
  attachEntry,
  entry,
  invokeMock,
  makeDb,
  setEntryFields,
  times,
} from "./kdbx-test-utils";
import {
  getEntryHistoryComparison,
  getEntryHistoryItems,
  removeEntryHistoryVersionInVault,
  restoreEntryHistoryVersionInVault,
  updateEntryFieldsInVault,
} from "./kdbx";

describe("kdbx entry history helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invokeMock.mockResolvedValue(12);
  });

  it("updates entry fields while pushing the previous version into history", async () => {
    const { db, root } = makeDb();
    const item = entry("entry");
    item.times = times(new Date("2026-01-01T10:00:00Z"));
    setEntryFields(item, {
      title: "GitHub antigo",
      username: "old-user",
      password: "old-password",
      url: "https://old.example",
      notes: "old notes",
    });
    attachEntry(root, item);

    const result = await updateEntryFieldsInVault(
      "C:/vault.kdbx",
      asDb(db),
      asEntry(item),
      {
        title: "GitHub novo",
        username: "new-user",
        password: "new-password",
        url: "https://new.example",
        notes: "new notes",
      },
    );

    expect(result).toEqual({ ok: true, durationMs: 12 });
    expect(item.pushHistory).toHaveBeenCalledOnce();
    expect(item.history).toHaveLength(1);
    expect(item.history[0].fields.get("Title")).toBe("GitHub antigo");
    expect(item.fields.get("Title")).toBe("GitHub novo");
    expect(item.fields.get("UserName")).toBe("new-user");
    expect(item.fields.get("URL")).toBe("https://new.example");
    expect(item.fields.get("Notes")).toBe("new notes");
    expect(item.times.update).toHaveBeenCalled();
  });

  it("rolls fields and history back when saving an edited entry fails", async () => {
    const { db, root } = makeDb();
    const item = entry("entry");
    setEntryFields(item, {
      title: "GitHub antigo",
      username: "old-user",
      password: "old-password",
      url: "https://old.example",
      notes: "old notes",
    });
    attachEntry(root, item);
    invokeMock.mockRejectedValue("save falhou");

    const result = await updateEntryFieldsInVault(
      "C:/vault.kdbx",
      asDb(db),
      asEntry(item),
      {
        title: "GitHub novo",
        username: "new-user",
        password: "new-password",
        url: "https://new.example",
        notes: "new notes",
      },
    );

    expect(result).toEqual({ ok: false, error: "save falhou" });
    expect(item.history).toHaveLength(0);
    expect(item.fields.get("Title")).toBe("GitHub antigo");
    expect(item.fields.get("UserName")).toBe("old-user");
    expect(item.fields.get("URL")).toBe("https://old.example");
    expect(item.fields.get("Notes")).toBe("old notes");
  });

  it("lists entry history from newest to oldest while preserving source indices", () => {
    const item = entry("entry");
    const old = entry("old");
    old.times = times(new Date("2025-01-01T10:00:00Z"));
    setEntryFields(old, {
      title: "Versão antiga",
      username: "old-user",
      url: "https://old.example",
      notes: "old notes",
    });
    const recent = entry("recent");
    recent.times = times(new Date("2025-03-01T10:00:00Z"));
    setEntryFields(recent, {
      title: "Versão recente",
      username: "recent-user",
      url: "https://recent.example",
      notes: "recent notes",
    });
    item.history.push(old, recent);

    expect(getEntryHistoryItems(asEntry(item))).toEqual([
      {
        index: 1,
        title: "Versão recente",
        username: "recent-user",
        password: "",
        url: "https://recent.example",
        notes: "recent notes",
        lastModTime: new Date("2025-03-01T10:00:00Z"),
      },
      {
        index: 0,
        title: "Versão antiga",
        username: "old-user",
        password: "",
        url: "https://old.example",
        notes: "old notes",
        lastModTime: new Date("2025-01-01T10:00:00Z"),
      },
    ]);
  });

  it("compares a history version with the current entry without exposing password values", () => {
    const item = entry("entry");
    setEntryFields(item, {
      title: "Atual",
      username: "same-user",
      password: "current-password",
      url: "https://current.example",
      notes: "current notes",
    });
    const previous = entry("previous");
    setEntryFields(previous, {
      title: "Anterior",
      username: "same-user",
      password: "old-password",
      url: "https://old.example",
      notes: "old notes",
    });
    item.history.push(previous);

    expect(getEntryHistoryComparison(asEntry(item), 0)).toEqual([
      {
        key: "title",
        label: "Título",
        changed: true,
        secret: false,
        currentValue: "Atual",
        historyValue: "Anterior",
      },
      {
        key: "username",
        label: "Usuário",
        changed: false,
        secret: false,
        currentValue: "same-user",
        historyValue: "same-user",
      },
      {
        key: "url",
        label: "URL",
        changed: true,
        secret: false,
        currentValue: "https://current.example",
        historyValue: "https://old.example",
      },
      {
        key: "notes",
        label: "Notas",
        changed: true,
        secret: false,
        currentValue: "current notes",
        historyValue: "old notes",
      },
      {
        key: "password",
        label: "Senha",
        changed: true,
        secret: true,
        currentValue: "",
        historyValue: "",
      },
    ]);
  });

  it("keeps only the 20 newest history versions after editing an entry", async () => {
    const { db, root } = makeDb();
    const item = entry("entry");
    for (let i = 0; i < 20; i += 1) {
      const oldVersion = entry(`old-${i}`);
      oldVersion.times = times(new Date(2025, 0, i + 1, 10));
      setEntryFields(oldVersion, { title: `Antiga ${i}` });
      item.history.push(oldVersion);
    }
    item.times = times(new Date("2026-01-01T10:00:00Z"));
    setEntryFields(item, { title: "Atual antes do save" });
    attachEntry(root, item);

    const result = await updateEntryFieldsInVault(
      "C:/vault.kdbx",
      asDb(db),
      asEntry(item),
      {
        title: "Atual depois do save",
        username: "",
        password: "",
        url: "",
        notes: "",
      },
    );

    expect(result).toEqual({ ok: true, durationMs: 12 });
    expect(item.history).toHaveLength(20);
    expect(
      item.history.some((version) => version.fields.get("Title") === "Antiga 0"),
    ).toBe(false);
    expect(
      item.history.some(
        (version) => version.fields.get("Title") === "Atual antes do save",
      ),
    ).toBe(true);
  });

  it("removes a history version and persists the vault", async () => {
    const { db, root } = makeDb();
    const item = entry("entry");
    const first = entry("first");
    const second = entry("second");
    setEntryFields(first, { title: "Primeira" });
    setEntryFields(second, { title: "Segunda" });
    item.history.push(first, second);
    attachEntry(root, item);

    const result = await removeEntryHistoryVersionInVault(
      "C:/vault.kdbx",
      asDb(db),
      asEntry(item),
      0,
    );

    expect(result).toEqual({ ok: true, durationMs: 12 });
    expect(item.removeHistory).toHaveBeenCalledWith(0);
    expect(item.history).toEqual([second]);
  });

  it("rolls a removed history version back when saving fails", async () => {
    const { db, root } = makeDb();
    const item = entry("entry");
    const first = entry("first");
    const second = entry("second");
    item.history.push(first, second);
    attachEntry(root, item);
    invokeMock.mockRejectedValue("save falhou");

    const result = await removeEntryHistoryVersionInVault(
      "C:/vault.kdbx",
      asDb(db),
      asEntry(item),
      0,
    );

    expect(result).toEqual({ ok: false, error: "save falhou" });
    expect(item.history).toEqual([first, second]);
  });

  it("restores a history version and keeps the current state in history", async () => {
    const { db, root } = makeDb();
    const item = entry("entry");
    setEntryFields(item, {
      title: "Atual",
      username: "current-user",
      password: "current-password",
      url: "https://current.example",
      notes: "current notes",
    });
    const previous = entry("previous");
    setEntryFields(previous, {
      title: "Anterior",
      username: "old-user",
      password: "old-password",
      url: "https://old.example",
      notes: "old notes",
    });
    item.history.push(previous);
    attachEntry(root, item);

    const result = await restoreEntryHistoryVersionInVault(
      "C:/vault.kdbx",
      asDb(db),
      asEntry(item),
      0,
    );

    expect(result).toEqual({ ok: true, durationMs: 12 });
    expect(item.pushHistory).toHaveBeenCalledOnce();
    expect(item.history).toHaveLength(2);
    expect(item.history[1].fields.get("Title")).toBe("Atual");
    expect(item.fields.get("Title")).toBe("Anterior");
    expect(item.fields.get("UserName")).toBe("old-user");
    expect(item.fields.get("URL")).toBe("https://old.example");
    expect(item.fields.get("Notes")).toBe("old notes");
  });

  it("rolls a history restore back when saving fails", async () => {
    const { db, root } = makeDb();
    const item = entry("entry");
    setEntryFields(item, {
      title: "Atual",
      username: "current-user",
      password: "current-password",
      url: "https://current.example",
      notes: "current notes",
    });
    const previous = entry("previous");
    setEntryFields(previous, {
      title: "Anterior",
      username: "old-user",
      password: "old-password",
      url: "https://old.example",
      notes: "old notes",
    });
    item.history.push(previous);
    attachEntry(root, item);
    invokeMock.mockRejectedValue("save falhou");

    const result = await restoreEntryHistoryVersionInVault(
      "C:/vault.kdbx",
      asDb(db),
      asEntry(item),
      0,
    );

    expect(result).toEqual({ ok: false, error: "save falhou" });
    expect(item.history).toEqual([previous]);
    expect(item.fields.get("Title")).toBe("Atual");
    expect(item.fields.get("UserName")).toBe("current-user");
    expect(item.fields.get("URL")).toBe("https://current.example");
    expect(item.fields.get("Notes")).toBe("current notes");
  });
});
