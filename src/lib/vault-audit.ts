import type { KdbxEntry } from "kdbxweb";

import {
  getLastModTime,
  getPassword,
  getTitle,
  getUrl,
  getUsername,
} from "./entry-helpers";
import {
  computePasswordStrength,
  type PasswordStrength,
} from "./password-strength";

export type AuditSeverity = "high" | "medium" | "low";
export type AuditFindingType =
  | "weak-password"
  | "reused-password"
  | "missing-url"
  | "duplicate-url"
  | "missing-username"
  | "missing-password"
  | "old-entry";

export interface AuditEntrySnapshot {
  id: string;
  title: string;
  username: string;
  url: string;
  password: string;
  lastModTime: Date | null;
  source: KdbxEntry;
}

export interface AuditFinding {
  type: AuditFindingType;
  severity: AuditSeverity;
  entryIds: string[];
  title: string;
  description: string;
  recommendation: string;
  strength?: PasswordStrength;
}

export interface VaultAuditSummary {
  totalEntries: number;
  high: number;
  medium: number;
  low: number;
}

export interface VaultAuditResult {
  summary: VaultAuditSummary;
  findings: AuditFinding[];
}

export interface VaultAuditOptions {
  oldEntryDays?: number;
}

const DEFAULT_OLD_ENTRY_DAYS = 365;

export function auditVaultEntries(
  entries: KdbxEntry[],
  options: VaultAuditOptions = {},
): VaultAuditResult {
  const snapshots = entries.map(toSnapshot);
  const findings: AuditFinding[] = [];
  const oldEntryDays = options.oldEntryDays ?? DEFAULT_OLD_ENTRY_DAYS;

  for (const entry of snapshots) {
    findings.push(...auditSingleEntry(entry, oldEntryDays));
  }

  findings.push(...auditReusedPasswords(snapshots));
  findings.push(...auditDuplicateUrls(snapshots));

  findings.sort(compareFindings);

  return {
    summary: summarize(findings, snapshots.length),
    findings,
  };
}

function auditSingleEntry(
  entry: AuditEntrySnapshot,
  oldEntryDays: number,
): AuditFinding[] {
  const findings: AuditFinding[] = [];

  if (!entry.password) {
    findings.push({
      type: "missing-password",
      severity: "high",
      entryIds: [entry.id],
      title: `${entryLabel(entry)} sem senha`,
      description: "A entrada não possui senha armazenada.",
      recommendation: "Defina uma senha forte ou remova a entrada se ela não for mais usada.",
    });
  } else {
    const strength = computePasswordStrength(entry.password, {
      title: entry.title,
      username: entry.username,
      url: entry.url,
    });
    if (strength.level <= 1) {
      findings.push({
        type: "weak-password",
        severity: strength.level === 0 ? "high" : "medium",
        entryIds: [entry.id],
        title: `${entryLabel(entry)} usa senha ${strength.label.toLowerCase()}`,
        description:
          strength.warnings.join(" ") || "A senha não atende aos critérios mínimos.",
        recommendation:
          strength.suggestions[0] ?? "Gere uma senha longa, única e aleatória.",
        strength,
      });
    }
  }

  if (!entry.url) {
    findings.push({
      type: "missing-url",
      severity: "low",
      entryIds: [entry.id],
      title: `${entryLabel(entry)} sem URL`,
      description: "A entrada não possui URL associada.",
      recommendation: "Adicione a URL do serviço para facilitar busca e auditoria.",
    });
  }

  if (!entry.username) {
    findings.push({
      type: "missing-username",
      severity: "low",
      entryIds: [entry.id],
      title: `${entryLabel(entry)} sem usuário`,
      description: "A entrada não possui usuário/login preenchido.",
      recommendation: "Preencha o usuário quando o serviço exigir login.",
    });
  }

  if (isOlderThan(entry.lastModTime, oldEntryDays)) {
    findings.push({
      type: "old-entry",
      severity: "low",
      entryIds: [entry.id],
      title: `${entryLabel(entry)} não é atualizada há muito tempo`,
      description: `A entrada não é modificada há pelo menos ${oldEntryDays} dias.`,
      recommendation: "Revise se a senha ainda é atual e única.",
    });
  }

  return findings;
}

function auditReusedPasswords(entries: AuditEntrySnapshot[]): AuditFinding[] {
  const byPassword = new Map<string, AuditEntrySnapshot[]>();
  for (const entry of entries) {
    if (!entry.password) continue;
    const key = entry.password;
    byPassword.set(key, [...(byPassword.get(key) ?? []), entry]);
  }

  return [...byPassword.values()]
    .filter((group) => group.length > 1)
    .map((group) => ({
      type: "reused-password" as const,
      severity: "high" as const,
      entryIds: group.map((entry) => entry.id),
      title: "Senha reutilizada",
      description: `A mesma senha aparece em ${group.length} entradas: ${group
        .map(entryLabel)
        .join(", ")}.`,
      recommendation: "Gere uma senha única para cada serviço.",
    }));
}

function auditDuplicateUrls(entries: AuditEntrySnapshot[]): AuditFinding[] {
  const byUrl = new Map<string, AuditEntrySnapshot[]>();
  for (const entry of entries) {
    const normalized = normalizeUrl(entry.url);
    if (!normalized) continue;
    byUrl.set(normalized, [...(byUrl.get(normalized) ?? []), entry]);
  }

  return [...byUrl.values()]
    .filter((group) => group.length > 1)
    .map((group) => ({
      type: "duplicate-url" as const,
      severity: "medium" as const,
      entryIds: group.map((entry) => entry.id),
      title: "URL duplicada",
      description: `A mesma URL aparece em ${group.length} entradas: ${group
        .map(entryLabel)
        .join(", ")}.`,
      recommendation: "Revise se as entradas são duplicadas ou contas diferentes.",
    }));
}

function toSnapshot(entry: KdbxEntry): AuditEntrySnapshot {
  return {
    id: entry.uuid.id,
    title: getTitle(entry),
    username: getUsername(entry),
    url: getUrl(entry),
    password: getPassword(entry),
    lastModTime: getLastModTime(entry),
    source: entry,
  };
}

function summarize(
  findings: AuditFinding[],
  totalEntries: number,
): VaultAuditSummary {
  return {
    totalEntries,
    high: findings.filter((finding) => finding.severity === "high").length,
    medium: findings.filter((finding) => finding.severity === "medium").length,
    low: findings.filter((finding) => finding.severity === "low").length,
  };
}

function compareFindings(a: AuditFinding, b: AuditFinding): number {
  const severityRank: Record<AuditSeverity, number> = {
    high: 0,
    medium: 1,
    low: 2,
  };
  return severityRank[a.severity] - severityRank[b.severity];
}

function entryLabel(entry: AuditEntrySnapshot): string {
  return entry.title || entry.url || entry.username || "(sem título)";
}

function normalizeUrl(value: string): string | null {
  if (!value) return null;
  try {
    const withProtocol = /^[a-z][a-z0-9+.-]*:/i.test(value)
      ? value
      : `https://${value}`;
    const parsed = new URL(withProtocol);
    return `${parsed.hostname.replace(/^www\./i, "").toLowerCase()}${parsed.pathname.replace(/\/$/, "")}`;
  } catch {
    return value.trim().toLowerCase() || null;
  }
}

function isOlderThan(date: Date | null, days: number): boolean {
  if (!date) return false;
  const ageMs = Date.now() - date.getTime();
  return ageMs >= days * 24 * 60 * 60 * 1000;
}
