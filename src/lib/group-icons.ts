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
  Star,
  TriangleAlert,
  User,
  Users,
  WalletCards,
  type LucideIcon,
} from "lucide-react";

import type { KdbxGroup } from "kdbxweb";

export const SEC_BASIS_GROUP_ICON_KEY = "sec.basis.groupIcon";

export const GROUP_ICON_OPTIONS = [
  { id: "folder", label: "Pasta", icon: Folder },
  { id: "briefcase", label: "Trabalho", icon: BriefcaseBusiness },
  { id: "home", label: "Casa", icon: Home },
  { id: "bank", label: "Banco", icon: Landmark },
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

const GROUP_ICON_IDS = new Set<string>(
  GROUP_ICON_OPTIONS.map((option) => option.id),
);

export const GROUP_ICON_BY_ID = Object.fromEntries(
  GROUP_ICON_OPTIONS.map((option) => [option.id, option.icon]),
) as Record<GroupLucideIconId, LucideIcon>;

export function normalizeGroupLucideIconId(
  value: string | null | undefined,
): GroupLucideIconId | null {
  if (!value || !GROUP_ICON_IDS.has(value)) return null;
  return value as GroupLucideIconId;
}

export function getGroupLucideIconId(
  group: KdbxGroup,
): GroupLucideIconId | null {
  return normalizeGroupLucideIconId(
    group.customData?.get(SEC_BASIS_GROUP_ICON_KEY)?.value,
  );
}

export function setGroupLucideIconId(
  group: KdbxGroup,
  iconId: GroupLucideIconId | null,
): void {
  if (!iconId) {
    group.customData?.delete(SEC_BASIS_GROUP_ICON_KEY);
    return;
  }

  group.customData ??= new Map();
  group.customData.set(SEC_BASIS_GROUP_ICON_KEY, {
    value: iconId,
    lastModified: new Date(),
  });
}
