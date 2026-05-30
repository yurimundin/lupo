import {
  Archive,
  BookOpen,
  BriefcaseBusiness,
  Cloud,
  CreditCard,
  Folder,
  Globe,
  Heart,
  Home,
  KeyRound,
  Landmark,
  LockKeyhole,
  Server,
  Shield,
  ShoppingCart,
  Scale,
  Star,
  TriangleAlert,
  User,
  Users,
  WalletCards,
  type LucideIcon,
} from "lucide-react";

import type { KdbxGroup } from "kdbxweb";

export const LUPO_GROUP_ICON_KEY = "lupo.groupIcon";
export const LUPO_GROUP_ICON_COLOR_KEY = "lupo.groupIconColor";
export const LEGACY_LUPO_GROUP_ICON_KEY = "sec.basis.groupIcon";
export const LEGACY_LUPO_GROUP_ICON_COLOR_KEY = "sec.basis.groupIconColor";
export const LUPO_GROUP_ICON_KEYS = [
  LUPO_GROUP_ICON_KEY,
  LEGACY_LUPO_GROUP_ICON_KEY,
] as const;
export const LUPO_GROUP_ICON_COLOR_KEYS = [
  LUPO_GROUP_ICON_COLOR_KEY,
  LEGACY_LUPO_GROUP_ICON_COLOR_KEY,
] as const;

export const GROUP_ICON_OPTIONS = [
  { id: "folder", label: "Pasta", icon: Folder },
  { id: "briefcase", label: "Trabalho", icon: BriefcaseBusiness },
  { id: "home", label: "Casa", icon: Home },
  { id: "bank", label: "Banco", icon: Landmark },
  { id: "scale", label: "Jurídico", icon: Scale },
  { id: "card", label: "Cartoes", icon: CreditCard },
  { id: "wallet", label: "Carteira", icon: WalletCards },
  { id: "server", label: "Servidor", icon: Server },
  { id: "cloud", label: "Nuvem", icon: Cloud },
  { id: "web", label: "Web", icon: Globe },
  { id: "favorite", label: "Favoritos", icon: Star },
  { id: "shield", label: "Seguranca", icon: Shield },
  { id: "lock", label: "Privado", icon: LockKeyhole },
  { id: "key", label: "Chaves", icon: KeyRound },
  { id: "team", label: "Equipe", icon: Users },
  { id: "person", label: "Pessoal", icon: User },
  { id: "book", label: "Notas", icon: BookOpen },
  { id: "heart", label: "Importante", icon: Heart },
  { id: "alert", label: "Atencao", icon: TriangleAlert },
  { id: "archive", label: "Arquivo", icon: Archive },
  { id: "shopping", label: "Compras", icon: ShoppingCart },
] as const;

export type GroupLucideIconId = (typeof GROUP_ICON_OPTIONS)[number]["id"];

export const GROUP_ICON_COLOR_OPTIONS = [
  {
    id: "default",
    label: "Padrão",
    className: "text-brand-tertiary",
    swatchClassName: "bg-brand-tertiary",
  },
  {
    id: "blue",
    label: "Azul",
    className: "text-blue-500",
    swatchClassName: "bg-blue-500",
  },
  {
    id: "green",
    label: "Verde",
    className: "text-emerald-500",
    swatchClassName: "bg-emerald-500",
  },
  {
    id: "amber",
    label: "Âmbar",
    className: "text-amber-500",
    swatchClassName: "bg-amber-500",
  },
  {
    id: "red",
    label: "Vermelho",
    className: "text-rose-500",
    swatchClassName: "bg-rose-500",
  },
  {
    id: "purple",
    label: "Roxo",
    className: "text-violet-500",
    swatchClassName: "bg-violet-500",
  },
  {
    id: "cyan",
    label: "Ciano",
    className: "text-cyan-500",
    swatchClassName: "bg-cyan-500",
  },
  {
    id: "slate",
    label: "Cinza",
    className: "text-slate-500",
    swatchClassName: "bg-slate-500",
  },
] as const;

export type GroupIconColorId = (typeof GROUP_ICON_COLOR_OPTIONS)[number]["id"];

const GROUP_ICON_IDS = new Set<string>(
  GROUP_ICON_OPTIONS.map((option) => option.id),
);
const GROUP_ICON_COLOR_IDS = new Set<string>(
  GROUP_ICON_COLOR_OPTIONS.map((option) => option.id),
);

export const GROUP_ICON_BY_ID = Object.fromEntries(
  GROUP_ICON_OPTIONS.map((option) => [option.id, option.icon]),
) as Record<GroupLucideIconId, LucideIcon>;
export const GROUP_ICON_COLOR_BY_ID = Object.fromEntries(
  GROUP_ICON_COLOR_OPTIONS.map((option) => [option.id, option]),
) as Record<GroupIconColorId, (typeof GROUP_ICON_COLOR_OPTIONS)[number]>;

export function normalizeGroupLucideIconId(
  value: string | null | undefined,
): GroupLucideIconId | null {
  if (!value || !GROUP_ICON_IDS.has(value)) return null;
  return value as GroupLucideIconId;
}

export function normalizeGroupIconColorId(
  value: string | null | undefined,
): GroupIconColorId | null {
  if (!value || !GROUP_ICON_COLOR_IDS.has(value)) return null;
  return value as GroupIconColorId;
}

export function getGroupLucideIconId(
  group: KdbxGroup,
): GroupLucideIconId | null {
  return normalizeGroupLucideIconId(
    getFirstCustomDataValue(group, LUPO_GROUP_ICON_KEYS),
  );
}

export function getGroupIconColorId(group: KdbxGroup): GroupIconColorId | null {
  return normalizeGroupIconColorId(
    getFirstCustomDataValue(group, LUPO_GROUP_ICON_COLOR_KEYS),
  );
}

export function setGroupLucideIconId(
  group: KdbxGroup,
  iconId: GroupLucideIconId | null,
): void {
  if (!iconId) {
    for (const key of LUPO_GROUP_ICON_KEYS) {
      group.customData?.delete(key);
    }
    return;
  }

  group.customData ??= new Map();
  group.customData.delete(LEGACY_LUPO_GROUP_ICON_KEY);
  group.customData.set(LUPO_GROUP_ICON_KEY, {
    value: iconId,
    lastModified: new Date(),
  });
}

export function setGroupIconColorId(
  group: KdbxGroup,
  colorId: GroupIconColorId | null,
): void {
  if (!colorId || colorId === "default") {
    for (const key of LUPO_GROUP_ICON_COLOR_KEYS) {
      group.customData?.delete(key);
    }
    return;
  }

  group.customData ??= new Map();
  group.customData.delete(LEGACY_LUPO_GROUP_ICON_COLOR_KEY);
  group.customData.set(LUPO_GROUP_ICON_COLOR_KEY, {
    value: colorId,
    lastModified: new Date(),
  });
}

function getFirstCustomDataValue(
  group: KdbxGroup,
  keys: readonly string[],
): string | undefined {
  for (const key of keys) {
    const value = group.customData?.get(key)?.value;
    if (value) return value;
  }
  return undefined;
}
