// Indicador discreto no header: "🔒 4:32" — tempo restante até o
// auto-lock disparar. Atualiza a cada segundo.

import { Lock } from "lucide-react";

import { useAutoLockRemainingMs } from "@/hooks/useAutoLock";

export function AutoLockIndicator() {
  const ms = useAutoLockRemainingMs();
  return (
    <span
      className="text-xs text-muted-foreground flex items-center gap-1 tabular-nums"
      title="Tempo até bloqueio automático por inatividade"
    >
      <Lock className="size-3" />
      {formatMmss(ms)}
    </span>
  );
}

function formatMmss(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
