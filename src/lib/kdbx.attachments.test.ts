import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  asDb,
  asEntry,
  attachEntry,
  entry,
  invokeMock,
  makeDb,
} from "./kdbx-test-utils";
import {
  addEntryAttachmentInVault,
  getEntryAttachments,
  removeEntryAttachmentInVault,
} from "./kdbx";

describe("kdbx attachment helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invokeMock.mockResolvedValue(12);
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
