import { TriangleAlert } from "lucide-react";

interface CapsLockWarningProps {
  visible: boolean;
}

export function CapsLockWarning({ visible }: CapsLockWarningProps) {
  if (!visible) return null;

  return (
    <p className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-warning">
      <TriangleAlert className="size-3.5" />
      Caps Lock ativado
    </p>
  );
}
