// Indicador discreto no header: pill com dot verde + "4:32" — tempo
// restante até o auto-lock disparar. Atualiza a cada segundo.
//
// Sessão 20: redesign visual de `🔒 4:32` (texto puro) para pill
// `<dot> 4:32` (estética do mockup hi-fi). Função preservada — mesmo
// `useAutoLockRemainingMs` driver. Dot verde indica que a sessão está
// ativa (não expirada).

import { useAutoLockRemainingMs } from "@/hooks/useAutoLock";

export function AutoLockIndicator() {
  const ms = useAutoLockRemainingMs();
  return (
    <div
      className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-background"
      title="Tempo até bloqueio automático por inatividade"
    >
      <span className="size-1.5 rounded-full bg-success" aria-hidden="true" />
      <span className="text-xs text-muted-foreground tabular-nums">
        {formatMmss(ms)}
      </span>
    </div>
  );
}

function formatMmss(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
