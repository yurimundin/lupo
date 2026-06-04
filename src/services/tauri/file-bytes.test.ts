import { beforeEach, describe, expect, it, vi } from "vitest";

const { invokeMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: invokeMock,
}));

import {
  getFileNameFromPath,
  readLocalFileBytes,
  writeLocalFileBytes,
} from "./file-bytes";

describe("file byte helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("gets the file name from Windows and Unix paths", () => {
    expect(getFileNameFromPath("C:\\docs\\contrato.pdf")).toBe("contrato.pdf");
    expect(getFileNameFromPath("/home/user/contrato.pdf")).toBe("contrato.pdf");
    expect(getFileNameFromPath("contrato.pdf")).toBe("contrato.pdf");
    expect(getFileNameFromPath("C:\\docs\\")).toBe("anexo");
  });

  it("normalizes bytes returned from the read command", async () => {
    invokeMock.mockResolvedValueOnce([1, 2, 3]);

    await expect(readLocalFileBytes("C:/docs/a.txt")).resolves.toEqual(
      new Uint8Array([1, 2, 3]),
    );
    expect(invokeMock).toHaveBeenCalledWith("read_file_bytes", {
      path: "C:/docs/a.txt",
    });
  });

  it("writes bytes through the backup-aware command", async () => {
    invokeMock.mockResolvedValueOnce(undefined);

    await writeLocalFileBytes("C:/docs/a.txt", new Uint8Array([4, 5]));

    expect(invokeMock).toHaveBeenCalledWith("write_file_with_backup", {
      path: "C:/docs/a.txt",
      bytes: [4, 5],
    });
  });
});
