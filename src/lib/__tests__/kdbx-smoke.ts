// =============================================================================
// ARQUIVO DE TESTE — todas as senhas/strings deste arquivo são DUMMY.
// =============================================================================
//
// Smoke test do pipeline cripto: Argon2 nativo + kdbxweb.
//
// Executado automaticamente em modo DEV (ver `main.tsx`) e em release com a
// flag `VITE_RUN_SMOKE=1`. Mede tempos e reporta tanto no console do webview
// quanto no stdout do `tauri dev` via o comando `log_smoke_result`. Não é
// um teste formal — é um sanity check para garantir que toda a pilha está
// conectada antes de construir UI em cima dela.
//
// As strings literais usadas como "senhas" abaixo (`test123`, `super-secret`,
// `benchmark-password`) NÃO são credenciais — são placeholders propositadamente
// óbvios para qualquer scanner de segredos detectar como falso positivo.

import { invoke } from "@tauri-apps/api/core";
import * as kdbxweb from "kdbxweb";

import { deriveArgon2Key } from "../argon2";

const KDBX4_DEFAULT_MEMORY_KIB = 65536; // 64 MiB
const KDBX4_DEFAULT_ITERATIONS = 2;
const KDBX4_DEFAULT_PARALLELISM = 2;
const KDBX4_KEY_LEN = 32;

function logBoth(message: string): void {
  // Console do webview (DevTools) + terminal do `tauri dev`.
  console.info("[SMOKE]", message);
  void invoke("log_smoke_result", { message }).catch(() => {
    // Ignora — em raras condições (HMR muito cedo) o backend pode não
    // estar pronto, e o smoke test não deve poluir o console com erros.
  });
}

interface BenchResult {
  individualMs: number[];
  averageMs: number;
}

async function benchArgon2(): Promise<BenchResult> {
  const password = new TextEncoder().encode("benchmark-password");
  const individualMs: number[] = [];

  for (let i = 0; i < 3; i++) {
    // Sal novo por execução pra impedir cache acidental em qualquer camada.
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const t0 = performance.now();
    await deriveArgon2Key({
      password,
      salt,
      iterations: KDBX4_DEFAULT_ITERATIONS,
      memoryKib: KDBX4_DEFAULT_MEMORY_KIB,
      parallelism: KDBX4_DEFAULT_PARALLELISM,
      outputLen: KDBX4_KEY_LEN,
      version: 0x13,
      variant: "argon2id",
    });
    individualMs.push(performance.now() - t0);
  }

  const averageMs =
    individualMs.reduce((a, b) => a + b, 0) / individualMs.length;
  return { individualMs, averageMs };
}

async function kdbxRoundTrip(): Promise<{ saveMs: number; openMs: number; bytes: number }> {
  // DUMMY: senha mestra do cofre criado e descartado durante o teste.
  const masterPw = kdbxweb.ProtectedValue.fromString("test123");
  const credentials = new kdbxweb.Credentials(masterPw);

  // KDBX4 com defaults — Argon2d / 64 MiB / 2 iter / 2 threads.
  const db = kdbxweb.Kdbx.create(credentials, "SmokeTestVault");
  const group = db.createGroup(db.getDefaultGroup(), "SmokeGroup");
  const entry = db.createEntry(group);
  entry.fields.set("Title", "SmokeEntry");
  entry.fields.set(
    "Password",
    // DUMMY: senha de uma entry sintética usada só pra validar round-trip.
    kdbxweb.ProtectedValue.fromString("super-secret"),
  );

  const t0save = performance.now();
  const buffer = await db.save();
  const saveMs = performance.now() - t0save;

  const t0open = performance.now();
  const reopened = await kdbxweb.Kdbx.load(buffer, credentials);
  const openMs = performance.now() - t0open;

  // Validações de integridade.
  const reloadedGroup = reopened
    .getDefaultGroup()
    .groups.find((g) => g.name === "SmokeGroup");
  if (!reloadedGroup) throw new Error("grupo não persistiu");
  const reloadedEntry = reloadedGroup.entries[0];
  if (reloadedEntry.fields.get("Title") !== "SmokeEntry") {
    throw new Error("título da entrada não persistiu");
  }
  const pw = reloadedEntry.fields.get("Password");
  if (!(pw instanceof kdbxweb.ProtectedValue) || pw.getText() !== "super-secret") {
    throw new Error("senha não voltou corretamente");
  }

  return { saveMs, openMs, bytes: buffer.byteLength };
}

export async function runKdbxSmokeTest(): Promise<void> {
  logBoth("=== INICIO smoke test (Argon2 nativo + kdbxweb) ===");
  try {
    const bench = await benchArgon2();
    logBoth(
      `Argon2 (64 MiB / 2 iter / 2 threads / Argon2id / v0x13) — 3x: ` +
        `[${bench.individualMs.map((t) => t.toFixed(0)).join(", ")}] ms, ` +
        `media=${bench.averageMs.toFixed(0)} ms`,
    );

    const trip = await kdbxRoundTrip();
    logBoth(
      `KDBX4 round-trip: save=${trip.saveMs.toFixed(0)} ms, ` +
        `open=${trip.openMs.toFixed(0)} ms, bytes=${trip.bytes}`,
    );

    logBoth("=== PASS smoke test ===");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logBoth(`=== FAIL smoke test: ${msg} ===`);
    throw err;
  }
}
