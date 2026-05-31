import { describe, expect, it } from "vitest";

import { isCapsLockOn } from "./useCapsLockWarning";

describe("caps lock warning helpers", () => {
  it("returns true only when the keyboard event reports Caps Lock active", () => {
    expect(
      isCapsLockOn({ getModifierState: (key) => key === "CapsLock" }),
    ).toBe(true);
    expect(isCapsLockOn({ getModifierState: () => false })).toBe(false);
  });

  it("treats missing modifier-state support as Caps Lock off", () => {
    expect(isCapsLockOn({})).toBe(false);
  });
});
