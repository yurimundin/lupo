// Popover do gerador de senhas. Abre a partir do botão ✨ no campo
// senha do `EntryEditor` (e qualquer outro lugar que precisar no futuro).
//
// Comportamento:
// - Abre com uma senha pré-gerada usando `DEFAULT_OPTIONS`.
// - Cada mudança em slider/toggle regenera em tempo real.
// - Botão refresh regenera com as mesmas opções.
// - "Usar essa senha" chama `onUse(generatedPassword)` + fecha.
// - Sem nenhum toggle de categoria → senha vazia + mensagem amigável,
//   botão "Usar" desabilitado.

import { Loader2, RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  DEFAULT_OPTIONS,
  generatePassword,
  type GeneratorOptions,
} from "@/lib/password-generator";
import {
  computePasswordStrength,
  type PasswordStrength,
} from "@/lib/password-strength";
import { cn } from "@/lib/utils";

const MIN_LENGTH = 8;
const MAX_LENGTH = 64;

// Mapeamento estático para o Tailwind 4 detectar as classes em build
// (template literals como `bg-${semantic}` não são reconhecidas — ver
// CLAUDE.md §12).
const STRENGTH_BAR_CLASS: Record<PasswordStrength["semantic"], string> = {
  destructive: "bg-destructive",
  warning: "bg-warning",
  primary: "bg-primary",
  success: "bg-success",
};

const STRENGTH_TEXT_CLASS: Record<PasswordStrength["semantic"], string> = {
  destructive: "text-destructive",
  warning: "text-warning",
  primary: "text-primary",
  success: "text-success",
};

interface Props {
  /** Disparado quando o usuário aceita a senha gerada. */
  onUse: (password: string) => void;
  /** Botão (ou outro elemento) que abre o popover. Será passado como
   *  `asChild` do `PopoverTrigger`. */
  trigger: React.ReactNode;
}

export function PasswordGenerator({ onUse, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<GeneratorOptions>(DEFAULT_OPTIONS);
  // Counter incrementado por (a) abertura do popover e (b) clique no
  // botão regenerate — alimenta o `useMemo` abaixo. Padrão substitui
  // os 2 useEffect anteriores que faziam setState (regra v7
  // react-hooks/set-state-in-effect). Mudança em `options` já dispara
  // recálculo via dep nativa do useMemo.
  const [regenCounter, setRegenCounter] = useState(0);

  // Senha derivada de (options, regenCounter). Regenerar a senha é
  // operação cara (RNG criptográfico + filtro de ambíguos) — useMemo
  // garante uma única chamada por render.
  //
  // regenCounter aparece como dep mas NÃO é lido no callback — é cache
  // buster intencional: bump do counter força recálculo com mesmas
  // options (handler de regenerate + transição open false→true).
  // ESLint exhaustive-deps sinaliza como "unnecessary", mas o efeito é
  // proposital. §33 convention: comentário + disable nu.
  const generated = useMemo(
    () => generatePassword(options),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [options, regenCounter],
  );

  // "Regenera ao abrir o popover" — padrão setState durante render
  // (React docs). Detecta transição false→true de `open` e bumpa
  // o counter, forçando o useMemo a recalcular com options atuais.
  const [prevOpen, setPrevOpen] = useState(open);
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (open) {
      setRegenCounter((c) => c + 1);
    }
  }

  const noCategorySelected =
    !options.useLowercase &&
    !options.useUppercase &&
    !options.useNumbers &&
    !options.useSymbols;

  const strength = useMemo(
    () => computePasswordStrength(generated),
    [generated],
  );

  function patch(partial: Partial<GeneratorOptions>) {
    setOptions((o) => ({ ...o, ...partial }));
  }

  function handleUse() {
    if (!generated) return;
    onUse(generated);
    setOpen(false);
  }

  function handleRegenerate() {
    setRegenCounter((c) => c + 1);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        className="w-80 p-4 gap-3"
        align="end"
        side="bottom"
        sideOffset={6}
      >
        <h3 className="font-medium text-sm">Gerador de senhas</h3>

        {/* Senha gerada em destaque. */}
        <div className="rounded-md bg-muted p-2.5 flex items-start gap-2">
          <code className="flex-1 font-mono text-xs break-all leading-relaxed min-h-[1.5rem]">
            {generated || (
              <span className="text-muted-foreground italic font-sans">
                Selecione pelo menos uma opção
              </span>
            )}
          </code>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={handleRegenerate}
            disabled={noCategorySelected}
            title="Regenerar com as mesmas opções"
            className="shrink-0"
          >
            <RefreshCw />
          </Button>
        </div>

        {/* Indicador de força. */}
        {generated && (
          <div className="space-y-1">
            <div className="flex h-1 gap-1 overflow-hidden rounded-full">
              {([0, 1, 2, 3] as const).map((idx) => (
                <span
                  key={idx}
                  className={cn(
                    "flex-1 rounded-full transition-colors",
                    idx <= strength.level
                      ? STRENGTH_BAR_CLASS[strength.semantic]
                      : "bg-muted",
                  )}
                />
              ))}
            </div>
            <p
              className={cn(
                "text-xs font-medium",
                STRENGTH_TEXT_CLASS[strength.semantic],
              )}
            >
              {strength.label}
            </p>
          </div>
        )}

        {/* Slider de comprimento. */}
        <div className="space-y-1.5">
          <Label
            htmlFor="pwgen-length"
            className="flex items-center justify-between text-xs"
          >
            <span>Comprimento</span>
            <span className="tabular-nums text-muted-foreground">
              {options.length}
            </span>
          </Label>
          <Slider
            id="pwgen-length"
            value={[options.length]}
            onValueChange={([v]) => patch({ length: v })}
            min={MIN_LENGTH}
            max={MAX_LENGTH}
            step={1}
          />
        </div>

        {/* Toggles. */}
        <div className="space-y-2">
          <ToggleRow
            id="pwgen-uppercase"
            label="Maiúsculas (A-Z)"
            checked={options.useUppercase}
            onChange={(v) => patch({ useUppercase: v })}
          />
          <ToggleRow
            id="pwgen-lowercase"
            label="Minúsculas (a-z)"
            checked={options.useLowercase}
            onChange={(v) => patch({ useLowercase: v })}
          />
          <ToggleRow
            id="pwgen-numbers"
            label="Números (2-9)"
            checked={options.useNumbers}
            onChange={(v) => patch({ useNumbers: v })}
          />
          <ToggleRow
            id="pwgen-symbols"
            label="Símbolos (!@#…)"
            checked={options.useSymbols}
            onChange={(v) => patch({ useSymbols: v })}
          />
          <ToggleRow
            id="pwgen-ambiguous"
            label="Evitar ambíguos (l, I, 1, O, 0)"
            checked={options.avoidAmbiguous}
            onChange={(v) => patch({ avoidAmbiguous: v })}
          />
        </div>

        <Button
          type="button"
          onClick={handleUse}
          disabled={noCategorySelected || !generated}
          className="w-full mt-1"
        >
          {generated ? (
            "Usar essa senha"
          ) : (
            <>
              <Loader2 className="animate-spin" />
              Aguardando opções
            </>
          )}
        </Button>
      </PopoverContent>
    </Popover>
  );
}

interface ToggleRowProps {
  id: string;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}

function ToggleRow({ id, label, checked, onChange }: ToggleRowProps) {
  return (
    <div className="flex items-center justify-between">
      <Label htmlFor={id} className="text-xs font-normal cursor-pointer">
        {label}
      </Label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
