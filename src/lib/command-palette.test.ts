import { describe, expect, it } from "vitest";

import type { KdbxEntry } from "kdbxweb";

import {
  buildCommandPaletteItems,
  COMMAND_PALETTE_ACTIONS,
} from "./command-palette";
import { SEC_BASIS_ENTRY_FAVORITE_KEY } from "./entry-helpers";

interface FakeGroup {
  uuid: { id: string };
  name: string;
  parentGroup?: FakeGroup;
}

interface FakeEntry {
  uuid: { id: string };
  fields: Map<string, string>;
  customData?: Map<string, { value: string; lastModified?: Date }>;
  parentGroup?: FakeGroup;
}

function group(id: string, name: string, parentGroup?: FakeGroup): FakeGroup {
  return { uuid: { id }, name, parentGroup };
}

function entry(input: {
  id: string;
  title: string;
  username?: string;
  url?: string;
  notes?: string;
  favorite?: boolean;
  parentGroup?: FakeGroup;
}): KdbxEntry {
  const fake: FakeEntry = {
    uuid: { id: input.id },
    fields: new Map([
      ["Title", input.title],
      ["UserName", input.username ?? ""],
      ["URL", input.url ?? ""],
      ["Notes", input.notes ?? ""],
      ["Password", ""],
    ]),
    parentGroup: input.parentGroup,
  };
  if (input.favorite) {
    fake.customData = new Map([
      [SEC_BASIS_ENTRY_FAVORITE_KEY, { value: "true" }],
    ]);
  }
  return fake as unknown as KdbxEntry;
}

describe("buildCommandPaletteItems", () => {
  it("returns global actions and favorite entries first when query is empty", () => {
    const root = group("root", "Root");
    const work = group("work", "Work", root);
    const entries = [
      entry({ id: "normal", title: "Normal", parentGroup: work }),
      entry({ id: "fav", title: "Favorite", favorite: true, parentGroup: work }),
    ];

    const items = buildCommandPaletteItems({
      entries,
      query: "",
      recycleBinUuidId: null,
    });

    expect(items.slice(0, COMMAND_PALETTE_ACTIONS.length).map((item) => item.id))
      .toEqual(COMMAND_PALETTE_ACTIONS.map((action) => action.id));
    expect(items.filter((item) => item.type === "entry").map((item) => item.id))
      .toEqual(["entry:fav", "entry:normal"]);
  });

  it("filters actions and entries by query while keeping group path metadata", () => {
    const root = group("root", "Root");
    const work = group("work", "Work", root);
    const entries = [
      entry({
        id: "github",
        title: "GitHub",
        username: "yuri",
        url: "https://github.com",
        parentGroup: work,
      }),
      entry({ id: "bank", title: "Banco", parentGroup: root }),
    ];

    const items = buildCommandPaletteItems({
      entries,
      query: "git",
      recycleBinUuidId: null,
    });

    expect(items.map((item) => item.id)).toEqual(["entry:github"]);
    expect(items[0]).toMatchObject({
      type: "entry",
      title: "GitHub",
      subtitle: "yuri",
      groupPath: "Root / Work",
    });
  });
});
