import { Clock, Clipboard, FileKey2, FolderClock, Shield } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  DEFAULT_AUTO_LOCK_MS,
  DEFAULT_CLIPBOARD_AUTO_CLEAR_MS,
  useSettingsStore,
} from "@/stores/settings";

interface SecuritySettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const AUTO_LOCK_OPTIONS = [
  { label: "1 min", value: 60 * 1000 },
  { label: "5 min", value: DEFAULT_AUTO_LOCK_MS },
  { label: "10 min", value: 10 * 60 * 1000 },
  { label: "15 min", value: 15 * 60 * 1000 },
  { label: "30 min", value: 30 * 60 * 1000 },
  { label: "Nunca", value: 0 },
] as const;

const CLIPBOARD_OPTIONS = [
  { label: "10s", value: 10 * 1000 },
  { label: "20s", value: DEFAULT_CLIPBOARD_AUTO_CLEAR_MS },
  { label: "30s", value: 30 * 1000 },
  { label: "60s", value: 60 * 1000 },
  { label: "Nunca", value: 0 },
] as const;

export function SecuritySettingsDialog({
  open,
  onOpenChange,
}: SecuritySettingsDialogProps) {
  const autoLockMs = useSettingsStore((s) => s.autoLockMs);
  const clipboardAutoClearMs = useSettingsStore((s) => s.clipboardAutoClearMs);
  const rememberLastVault = useSettingsStore((s) => s.rememberLastVault);
  const rememberKeyFilePath = useSettingsStore((s) => s.rememberKeyFilePath);
  const lockOnWindowBlur = useSettingsStore((s) => s.lockOnWindowBlur);

  const setAutoLockMs = useSettingsStore((s) => s.setAutoLockMs);
  const setClipboardAutoClearMs = useSettingsStore(
    (s) => s.setClipboardAutoClearMs,
  );
  const setRememberLastVault = useSettingsStore(
    (s) => s.setRememberLastVault,
  );
  const setRememberKeyFilePath = useSettingsStore(
    (s) => s.setRememberKeyFilePath,
  );
  const setLockOnWindowBlur = useSettingsStore(
    (s) => s.setLockOnWindowBlur,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px]">
        <DialogHeader>
          <DialogTitle>Configurações de segurança</DialogTitle>
          <DialogDescription>
            Ajustes locais deste dispositivo. Senhas e conteúdo do cofre nunca
            são persistidos aqui.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-1">
          <OptionGroup
            icon={<Clock />}
            title="Bloqueio automático"
            description="Bloqueia o cofre depois de um período sem atividade."
            options={AUTO_LOCK_OPTIONS}
            value={autoLockMs}
            onChange={setAutoLockMs}
          />

          <OptionGroup
            icon={<Clipboard />}
            title="Limpar clipboard"
            description="Remove senhas copiadas após o tempo escolhido."
            options={CLIPBOARD_OPTIONS}
            value={clipboardAutoClearMs}
            onChange={setClipboardAutoClearMs}
          />

          <ToggleRow
            icon={<FolderClock />}
            id="remember-last-vault"
            title="Lembrar último cofre"
            description="Pré-preenche o último arquivo aberto ao iniciar o app."
            checked={rememberLastVault}
            onCheckedChange={setRememberLastVault}
          />

          <ToggleRow
            icon={<FileKey2 />}
            id="remember-key-file"
            title="Lembrar caminho do key file"
            description="Guarda apenas o caminho do arquivo, não o conteúdo."
            checked={rememberKeyFilePath}
            onCheckedChange={setRememberKeyFilePath}
          />

          <ToggleRow
            icon={<Shield />}
            id="lock-on-blur"
            title="Bloquear ao perder foco"
            description="Bloqueia quando a janela perde foco ou é minimizada."
            checked={lockOnWindowBlur}
            onCheckedChange={setLockOnWindowBlur}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface Option {
  label: string;
  value: number;
}

function OptionGroup({
  icon,
  title,
  description,
  options,
  value,
  onChange,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  options: readonly Option[];
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-muted-foreground [&>svg]:size-4">
          {icon}
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-medium">{title}</h3>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-1.5 pl-7 sm:grid-cols-6">
        {options.map((option) => (
          <Button
            key={option.value}
            type="button"
            variant={value === option.value ? "default" : "outline"}
            size="sm"
            onClick={() => onChange(option.value)}
            className="h-8 px-2 text-xs"
          >
            {option.label}
          </Button>
        ))}
      </div>
    </section>
  );
}

function ToggleRow({
  icon,
  id,
  title,
  description,
  checked,
  onCheckedChange,
}: {
  icon: React.ReactNode;
  id: string;
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-muted-foreground [&>svg]:size-4">
          {icon}
        </span>
        <div className="min-w-0">
          <Label htmlFor={id} className="text-sm font-medium">
            {title}
          </Label>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        className="shrink-0"
      />
    </div>
  );
}
