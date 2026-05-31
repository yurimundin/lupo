import { describe, expect, it, vi } from "vitest";

import { openUrlAndCopyPassword } from "./entry-actions";

describe("entry action helpers", () => {
  it("opens the entry URL before copying the password for login use", async () => {
    const calls: string[] = [];
    const openUrl = vi.fn(async () => {
      calls.push("open");
      return true;
    });
    const copyPassword = vi.fn(async () => {
      calls.push("copy");
    });

    const result = await openUrlAndCopyPassword("https://github.com", "secret", {
      openUrl,
      copyPassword,
    });

    expect(result).toBe(true);
    expect(openUrl).toHaveBeenCalledWith("https://github.com");
    expect(copyPassword).toHaveBeenCalledWith(
      "secret",
      "Senha copiada para usar no site",
    );
    expect(calls).toEqual(["open", "copy"]);
  });

  it("does not open or copy when URL or password is missing", async () => {
    const openUrl = vi.fn();
    const copyPassword = vi.fn();

    await expect(
      openUrlAndCopyPassword("", "secret", { openUrl, copyPassword }),
    ).resolves.toBe(false);
    await expect(
      openUrlAndCopyPassword("https://github.com", "", {
        openUrl,
        copyPassword,
      }),
    ).resolves.toBe(false);

    expect(openUrl).not.toHaveBeenCalled();
    expect(copyPassword).not.toHaveBeenCalled();
  });

  it("does not copy the password when the URL could not be opened", async () => {
    const openUrl = vi.fn(async () => false);
    const copyPassword = vi.fn();

    const result = await openUrlAndCopyPassword("nota-local", "secret", {
      openUrl,
      copyPassword,
    });

    expect(result).toBe(false);
    expect(copyPassword).not.toHaveBeenCalled();
  });
});
