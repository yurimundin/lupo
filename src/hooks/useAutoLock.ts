// Auto-lock por inatividade.
//
// `useAutoLock()` registra listeners no `document` (mousemove, keydown,
// click, scroll, touchstart) e chama `vault.lock()` quando o tempo de
// inatividade passa do `autoLockMs` configurado.
//
// `useAutoLockRemaining()` é um observer separado que retorna ms
// restantes até o lock — usado pelo indicador no header.
//
// Decisão (do prompt da Sessão 3): NÃO resetamos o timer quando a janela
// perde foco; queremos que continue contando se o usuário foi pra outro app.

import { useEffect, useState } from "react";
import { create } from "zustand";

import { requestLockWithGuard } from "@/lib/lock-flow";
import { useSettingsStore } from "@/stores/settings";
import { useVaultStore } from "@/stores/vault";

/**
 * Janela em ms pra usuário responder à confirmação "descartar mudanças?"
 * disparada pelo auto-lock. Se não responder, o app força o bloqueio
 * (segurança > UX). Lock manual (botão / Ctrl+L) NÃO usa timeout.
 */
const AUTO_LOCK_CONFIRM_TIMEOUT_MS = 30_000;

interface ActivityState {
  lastActivity: number;
  bump(): void;
}

// Store local pra "última atividade", compartilhado entre o hook que
// dispara o lock e o hook que observa o tempo restante.
const useActivityStore = create<ActivityState>((set) => ({
  lastActivity: Date.now(),
  bump: () => set({ lastActivity: Date.now() }),
}));

const MOUSE_MOVE_THROTTLE_MS = 250;

export function useAutoLock(): void {
  const kdbx = useVaultStore((s) => s.kdbx);
  const autoLockMs = useSettingsStore((s) => s.autoLockMs);
  const lockOnWindowBlur = useSettingsStore((s) => s.lockOnWindowBlur);

  useEffect(() => {
    // Só ativa o auto-lock quando há cofre desbloqueado.
    if (!kdbx) return;

    const bump = () => useActivityStore.getState().bump();
    bump(); // reseta no mount também — usuário acabou de desbloquear
    let lockInFlight = false;

    function lockWithInFlightGuard(options?: {
      autoConfirmAfterMs?: number;
    }): void {
      if (lockInFlight) return;
      lockInFlight = true;
      void requestLockWithGuard(options).finally(() => {
        useActivityStore.getState().bump();
        lockInFlight = false;
      });
    }

    let mouseTimer: number | null = null;
    function handleMouseMove() {
      if (mouseTimer !== null) return;
      mouseTimer = window.setTimeout(() => {
        bump();
        mouseTimer = null;
      }, MOUSE_MOVE_THROTTLE_MS);
    }

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("keydown", bump);
    document.addEventListener("click", bump);
    document.addEventListener("scroll", bump, true);
    document.addEventListener("touchstart", bump);

    function handleWindowBlur() {
      if (lockOnWindowBlur) {
        lockWithInFlightGuard();
      }
    }

    function handleVisibilityChange() {
      if (lockOnWindowBlur && document.visibilityState === "hidden") {
        lockWithInFlightGuard();
      }
    }

    window.addEventListener("blur", handleWindowBlur);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    const tickId = window.setInterval(() => {
      if (autoLockMs <= 0) return;
      if (lockInFlight) return;
      const elapsed = Date.now() - useActivityStore.getState().lastActivity;
      if (elapsed >= autoLockMs) {
        // Auto-lock confirma com o usuário se houver mudanças não-salvas;
        // se não responder em 30s, descarta e bloqueia (defesa).
        lockWithInFlightGuard({
          autoConfirmAfterMs: AUTO_LOCK_CONFIRM_TIMEOUT_MS,
        });
      }
    }, 1000);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("keydown", bump);
      document.removeEventListener("click", bump);
      document.removeEventListener("scroll", bump, true);
      document.removeEventListener("touchstart", bump);
      window.removeEventListener("blur", handleWindowBlur);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (mouseTimer !== null) clearTimeout(mouseTimer);
      clearInterval(tickId);
    };
  }, [kdbx, autoLockMs, lockOnWindowBlur]);
}

export function useAutoLockRemainingMs(): number {
  const lastActivity = useActivityStore((s) => s.lastActivity);
  const autoLockMs = useSettingsStore((s) => s.autoLockMs);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (autoLockMs <= 0) return Number.POSITIVE_INFINITY;
  return Math.max(0, autoLockMs - (now - lastActivity));
}
