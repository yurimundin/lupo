// Helpers de leitura de campos de uma `KdbxEntry`. A kdbxweb tipa
// `entry.fields` como `Map<string, string | ProtectedValue>` — escolhemos
// padronizar tudo em `string` na UI (com a senha desprotegida só onde
// realmente vai ser exibida/copiada).

import * as kdbxweb from "kdbxweb";
import type { KdbxEntry, KdbxGroup } from "kdbxweb";

const { ProtectedValue } = kdbxweb;
export const SEC_BASIS_ENTRY_FAVORITE_KEY = "sec.basis.entryFavorite";

/** Lê um campo de texto. Desprotege se for `ProtectedValue`. Vazio se nulo. */
export function fieldText(entry: KdbxEntry, name: string): string {
  const v = entry.fields.get(name);
  if (!v) return "";
  if (v instanceof ProtectedValue) return v.getText();
  return v;
}

export function getTitle(entry: KdbxEntry): string {
  return fieldText(entry, "Title");
}

export function getUsername(entry: KdbxEntry): string {
  return fieldText(entry, "UserName");
}

export function getUrl(entry: KdbxEntry): string {
  return fieldText(entry, "URL");
}

export function getNotes(entry: KdbxEntry): string {
  return fieldText(entry, "Notes");
}

/** Senha desprotegida — usar APENAS no momento da cópia ou exibição. */
export function getPassword(entry: KdbxEntry): string {
  return fieldText(entry, "Password");
}

export function isEntryFavorite(entry: KdbxEntry): boolean {
  return entry.customData?.get(SEC_BASIS_ENTRY_FAVORITE_KEY)?.value === "true";
}

export function setEntryFavorite(entry: KdbxEntry, favorite: boolean): void {
  if (!favorite) {
    entry.customData?.delete(SEC_BASIS_ENTRY_FAVORITE_KEY);
    return;
  }

  entry.customData ??= new Map();
  entry.customData.set(SEC_BASIS_ENTRY_FAVORITE_KEY, {
    value: "true",
    lastModified: new Date(),
  });
}

/** Última modificação. `null` se a kdbxweb não tiver gravado. */
export function getLastModTime(entry: KdbxEntry): Date | null {
  return entry.times.lastModTime ?? null;
}

/**
 * Formata "há X dias" / "há X horas" / "agora" — em PT-BR. Não usa
 * `Intl.RelativeTimeFormat` pra manter tudo offline-first sem
 * dependências de locale carregado tarde.
 */
export function formatRelative(date: Date | null): string {
  if (!date) return "data desconhecida";
  const ms = Date.now() - date.getTime();
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return "há instantes";
  const min = Math.floor(sec / 60);
  if (min < 60) return `há ${min} ${min === 1 ? "minuto" : "minutos"}`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} ${h === 1 ? "hora" : "horas"}`;
  const d = Math.floor(h / 24);
  if (d < 30) return `há ${d} ${d === 1 ? "dia" : "dias"}`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `há ${mo} ${mo === 1 ? "mês" : "meses"}`;
  const y = Math.floor(mo / 12);
  return `há ${y} ${y === 1 ? "ano" : "anos"}`;
}

/** Iniciais (até 2 letras) usadas em avatares. */
export function getInitials(text: string): string {
  const cleaned = text.trim();
  if (cleaned.length === 0) return "??";
  const parts = cleaned.split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return cleaned.slice(0, 2).toUpperCase();
}

/** Cor de fundo determinística para o avatar. Usa classes Tailwind padrão. */
export function getAvatarColorClass(text: string): string {
  const palette = [
    "bg-blue-500",
    "bg-emerald-500",
    "bg-purple-500",
    "bg-pink-500",
    "bg-amber-500",
    "bg-indigo-500",
    "bg-rose-500",
    "bg-teal-500",
    "bg-orange-500",
    "bg-cyan-500",
  ];
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }
  return palette[Math.abs(hash) % palette.length];
}

/**
 * Retorna o caminho do grupo de uma entry como string formatada.
 * Walk-up via `parentGroup`, traduz Lixeira (i18n consistente com
 * `getGroupDisplayName` em `vault.ts`).
 *
 * Não importa `getGroupDisplayName` direto para evitar ciclo
 * `entry-helpers.ts ↔ vault.ts` (vault.ts já importa helpers daqui).
 * A regra de tradução é uma única linha — duplicação aceitável.
 *
 * @example "Pessoal / Bancos"
 * @example "Cofre / Trabalho / Email"
 */
export function getGroupPath(
  entry: KdbxEntry,
  recycleBinUuidId: string | null,
): string {
  const path: string[] = [];
  let group: KdbxGroup | undefined = entry.parentGroup;
  while (group) {
    const displayName =
      recycleBinUuidId && group.uuid.id === recycleBinUuidId
        ? "Lixeira"
        : group.name || "(sem nome)";
    path.unshift(displayName);
    group = group.parentGroup;
  }
  return path.join(" / ");
}

/**
 * Verifica se uma entry casa com a query de busca.
 * Substring case-insensitive em Title + UserName + URL + Notes.
 *
 * Não inclui Password por segurança (ProtectedValue não é desprotegido
 * durante typing — vide §15 sobre selectors do Zustand e §30 sobre
 * critérios de segurança).
 */
export function matchesSearch(entry: KdbxEntry, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  const haystack = [
    getTitle(entry),
    getUsername(entry),
    getUrl(entry),
    getNotes(entry),
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

/**
 * Retorna array de partes do texto, com flag indicando se cada parte
 * deve ser highlighted. Usado para renderizar o título com `<mark>`
 * envolvendo trechos que casam com a query.
 *
 * Comparação case-insensitive, mas preserva o casing original do
 * texto nos pedaços retornados (ex.: query "gma" em "GmailUser" →
 * split com "Gma" highlighted, "ilUser" não).
 *
 * @example highlightMatch("gmail.com", "gma") returns:
 *   [{ text: "gma", highlighted: true },
 *    { text: "il.com", highlighted: false }]
 */
export function highlightMatch(
  text: string,
  query: string,
): Array<{ text: string; highlighted: boolean }> {
  if (!query) return [{ text, highlighted: false }];
  const q = query.toLowerCase();
  const lowerText = text.toLowerCase();
  const parts: Array<{ text: string; highlighted: boolean }> = [];
  let lastIndex = 0;
  let index = lowerText.indexOf(q);
  while (index !== -1) {
    if (index > lastIndex) {
      parts.push({
        text: text.substring(lastIndex, index),
        highlighted: false,
      });
    }
    parts.push({
      text: text.substring(index, index + query.length),
      highlighted: true,
    });
    lastIndex = index + query.length;
    index = lowerText.indexOf(q, lastIndex);
  }
  if (lastIndex < text.length) {
    parts.push({ text: text.substring(lastIndex), highlighted: false });
  }
  return parts;
}
