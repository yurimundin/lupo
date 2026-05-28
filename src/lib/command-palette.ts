import type { KdbxEntry } from "kdbxweb";

import {
  getGroupPath,
  getNotes,
  getPassword,
  getTitle,
  getUrl,
  getUsername,
  isEntryFavorite,
} from "./entry-helpers";

export type CommandPaletteActionId =
  | "new-entry"
  | "lock-vault"
  | "focus-search";

export interface CommandPaletteAction {
  id: CommandPaletteActionId;
  label: string;
  description: string;
  keywords: string[];
}

export interface CommandPaletteActionItem extends CommandPaletteAction {
  type: "action";
}

export interface CommandPaletteEntryItem {
  type: "entry";
  id: string;
  entry: KdbxEntry;
  title: string;
  subtitle: string;
  url: string;
  groupPath: string;
  favorite: boolean;
  hasPassword: boolean;
  hasUsername: boolean;
  hasUrl: boolean;
}

export type CommandPaletteItem =
  | CommandPaletteActionItem
  | CommandPaletteEntryItem;

export const COMMAND_PALETTE_ACTIONS: CommandPaletteAction[] = [
  {
    id: "new-entry",
    label: "Nova entrada",
    description: "Criar uma entrada no grupo selecionado",
    keywords: ["criar", "novo", "entrada", "login", "senha"],
  },
  {
    id: "lock-vault",
    label: "Bloquear cofre",
    description: "Bloquear o cofre aberto",
    keywords: ["bloquear", "lock", "segurança", "cofre"],
  },
  {
    id: "focus-search",
    label: "Focar busca",
    description: "Usar a busca tradicional do header",
    keywords: ["buscar", "pesquisar", "filtro", "header"],
  },
];

export function buildCommandPaletteItems({
  entries,
  query,
  recycleBinUuidId,
}: {
  entries: KdbxEntry[];
  query: string;
  recycleBinUuidId: string | null;
}): CommandPaletteItem[] {
  const normalizedQuery = normalize(query);

  const actionItems = COMMAND_PALETTE_ACTIONS.filter((action) =>
    actionMatches(action, normalizedQuery),
  ).map<CommandPaletteActionItem>((action) => ({
    ...action,
    type: "action",
  }));

  const entryItems = entries
    .map((entry) => toEntryItem(entry, recycleBinUuidId))
    .filter((item) => entryMatches(item, normalizedQuery))
    .sort(compareEntryItems);

  return [...actionItems, ...entryItems];
}

function toEntryItem(
  entry: KdbxEntry,
  recycleBinUuidId: string | null,
): CommandPaletteEntryItem {
  const title = getTitle(entry) || "(sem título)";
  const username = getUsername(entry);
  const url = getUrl(entry);
  return {
    type: "entry",
    id: `entry:${entry.uuid.id}`,
    entry,
    title,
    subtitle: username || url || "",
    url,
    groupPath: getGroupPath(entry, recycleBinUuidId),
    favorite: isEntryFavorite(entry),
    hasPassword: getPassword(entry).length > 0,
    hasUsername: username.length > 0,
    hasUrl: url.length > 0,
  };
}

function actionMatches(
  action: CommandPaletteAction,
  normalizedQuery: string,
): boolean {
  if (!normalizedQuery) return true;
  return normalize(
    [action.label, action.description, ...action.keywords].join(" "),
  ).includes(normalizedQuery);
}

function entryMatches(
  item: CommandPaletteEntryItem,
  normalizedQuery: string,
): boolean {
  if (!normalizedQuery) return true;
  return normalize(
    [
      item.title,
      item.subtitle,
      item.url,
      item.groupPath,
      getNotes(item.entry),
    ].join(" "),
  ).includes(normalizedQuery);
}

function compareEntryItems(
  a: CommandPaletteEntryItem,
  b: CommandPaletteEntryItem,
): number {
  if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
  return a.title.localeCompare(b.title, "pt-BR", { sensitivity: "base" });
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase("pt-BR");
}
