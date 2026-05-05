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

import { useSettingsStore } from "@/stores/settings";
import { useVaultStore } from "@/stores/vault";

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
  const lock = useVaultStore((s) => s.lock);
  const kdbx = useVaultStore((s) => s.kdbx);
  const autoLockMs = useSettingsStore((s) => s.autoLockMs);

  useEffect(() => {
    // Só ativa o auto-lock quando há cofre desbloqueado.
    if (!kdbx) return;

    const bump = () => useActivityStore.getState().bump();
    bump(); // reseta no mount também — usuário acabou de desbloquear

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

    const tickId = window.setInterval(() => {
      const elapsed = Date.now() - useActivityStore.getState().lastActivity;
      if (elapsed >= autoLockMs) {
        lock();
      }
    }, 1000);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("keydown", bump);
      document.removeEventListener("click", bump);
      document.removeEventListener("scroll", bump, true);
      document.removeEventListener("touchstart", bump);
      if (mouseTimer !== null) clearTimeout(mouseTimer);
      clearInterval(tickId);
    };
  }, [kdbx, lock, autoLockMs]);
}

export function useAutoLockRemainingMs(): number {
  const lastActivity = useActivityStore((s) => s.lastActivity);
  const autoLockMs = useSettingsStore((s) => s.autoLockMs);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  return Math.max(0, autoLockMs - (now - lastActivity));
}
