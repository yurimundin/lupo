import { useEffect, useState } from "react";
import type { KdbxGroup } from "kdbxweb";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const MAX_GROUP_NAME_LENGTH = 64;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: KdbxGroup;
  onConfirm: (newName: string) => Promise<boolean>;
};

/**
 * Dialog para renomear um grupo existente. Pré-popula o input com o
 * nome atual e oferece validações em tempo real:
 * - Nome não-vazio (após trim)
 * - Max 64 caracteres
 * - Sem duplicata entre siblings (EXCLUI o próprio grupo)
 * - Sem mudança (mesmo nome após trim — botão desabilitado + hint)
 *
 * Comportamento:
 * - Enter no input = submit (se válido)
 * - Esc = cancelar (via Dialog overlay)
 * - Reset ao abrir: input volta a ter o group.name atual
 * - Botão Renomear desabilitado se inválido/inalterado
 */
export function RenameGroupDialog({
  open,
  onOpenChange,
  group,
  onConfirm,
}: Props) {
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Reset state quando o dialog abre — pré-popular com nome atual
  useEffect(() => {
    if (open) {
      setName(group.name ?? "");
      setSubmitting(false);
    }
  }, [open, group]);

  const trimmed = name.trim();
  const currentName = (group.name ?? "").trim();
  const parent = group.parentGroup;

  // Validações em tempo real
  const isEmpty = trimmed.length === 0;
  const isTooLong = trimmed.length > MAX_GROUP_NAME_LENGTH;
  const isUnchanged = trimmed === currentName;
  // Duplicate check exclui o próprio grupo
  const isDuplicate =
    !!parent &&
    parent.groups
      .filter((g) => g !== group)
      .some((g) => g.name?.trim().toLowerCase() === trimmed.toLowerCase());

  const validationError = isEmpty
    ? null // estado inicial — não mostrar erro
    : isTooLong
      ? `Nome muito longo (máximo ${MAX_GROUP_NAME_LENGTH} caracteres).`
      : isDuplicate
        ? "Já existe um grupo com este nome neste nível."
        : isUnchanged
          ? "Digite um nome diferente do atual."
          : null;

  const canSubmit =
    !isEmpty && !isTooLong && !isDuplicate && !isUnchanged && !submitting;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    const ok = await onConfirm(trimmed);
    setSubmitting(false);
    if (ok) {
      onOpenChange(false);
    }
    // Se falhou, mantém dialog aberto (caller mostra toast de erro)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      void handleSubmit();
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Renomear grupo</DialogTitle>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="rename-group-name">Nome do grupo</Label>
          <Input
            id="rename-group-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Digite o nome..."
            maxLength={MAX_GROUP_NAME_LENGTH + 10}
            autoFocus
            disabled={submitting}
          />
          {validationError && (
            <p
              className={
                isUnchanged
                  ? "text-xs text-muted-foreground"
                  : "text-xs text-destructive"
              }
              role={isUnchanged ? undefined : "alert"}
            >
              {validationError}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            Renomear
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
