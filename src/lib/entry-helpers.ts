// Helpers de leitura de campos de uma `KdbxEntry`. A kdbxweb tipa
// `entry.fields` como `Map<string, string | ProtectedValue>` — escolhemos
// padronizar tudo em `string` na UI (com a senha desprotegida só onde
// realmente vai ser exibida/copiada).

import * as kdbxweb from "kdbxweb";
import type { KdbxEntry } from "kdbxweb";

const { ProtectedValue } = kdbxweb;

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
