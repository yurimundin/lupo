import { describe, expect, it } from "vitest";

import {
  buildGroupTree,
  collectEntriesForSearch,
  getGroupDisplayName,
} from "./vault";

import type { KdbxGroup } from "kdbxweb";

interface FakeGroup {
  uuid: { id: string };
  name: string;
  customData?: Map<string, { value: string; lastModified?: Date }>;
  entries: FakeEntry[];
  groups: FakeGroup[];
  parentGroup?: FakeGroup;
}

interface FakeEntry {
  uuid: { id: string };
  parentGroup?: FakeGroup;
}

function group(
  id: string,
  name: string,
  entries: FakeEntry[] = [],
  groups: FakeGroup[] = [],
): FakeGroup {
  const node: FakeGroup = { uuid: { id }, name, entries, groups };
  for (const entry of entries) entry.parentGroup = node;
  for (const child of groups) child.parentGroup = node;
  return node;
}

function entry(id: string): FakeEntry {
  return { uuid: { id } };
}

const asGroup = (value: FakeGroup) => value as unknown as KdbxGroup;

describe("vault pure selectors", () => {
  it("collects search entries while excluding the recycle bin subtree", () => {
    const active = entry("active");
    const trashed = entry("trashed");
    const nestedTrash = entry("nested-trash");
    const recycleChild = group("trash-child", "Nested", [nestedTrash]);
    const recycleBin = group("trash", "Recycle Bin", [trashed], [recycleChild]);
    const root = group("root", "Root", [active], [recycleBin]);

    const result = collectEntriesForSearch(asGroup(root), "trash");

    expect(result.map((item) => item.uuid.id)).toEqual(["active"]);
  });

  it("builds recursive group tree metadata", () => {
    const child = group("child", "Child", [entry("one")]);
    const recycleBin = group("trash", "Recycle Bin");
    const root = group("root", "Root", [], [child, recycleBin]);

    const [tree] = buildGroupTree(asGroup(root), "trash");

    expect(tree).toMatchObject({
      uuid: "root",
      name: "Root",
      iconId: null,
      depth: 0,
      parentUuid: null,
      isRecycleBin: false,
      entryCount: 0,
    });
    expect(tree.children[0]).toMatchObject({
      uuid: "child",
      iconId: null,
      depth: 1,
      parentUuid: "root",
      entryCount: 1,
    });
    expect(tree.children[1]).toMatchObject({
      uuid: "trash",
      name: "Lixeira",
      isRecycleBin: true,
    });
  });

  it("includes Sec.Basis custom Lucide icon metadata in the group tree", () => {
    const child = group("child", "Child");
    child.customData = new Map([
      ["sec.basis.groupIcon", { value: "shield" }],
    ]);
    const root = group("root", "Root", [], [child]);

    const [tree] = buildGroupTree(asGroup(root), null);

    expect(tree.children[0].iconId).toBe("shield");
  });

  it("translates only the configured recycle bin display name", () => {
    const recycleBin = group("trash", "Recycle Bin");
    const regular = group("regular", "Recycle Bin");

    expect(getGroupDisplayName(asGroup(recycleBin), "trash")).toBe("Lixeira");
    expect(getGroupDisplayName(asGroup(regular), "trash")).toBe("Recycle Bin");
  });
});
