import { useEffect, useState } from "react";
import type { KdbxGroup } from "kdbxweb";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
  parent: KdbxGroup;
  parentIsRoot: boolean;
  onConfirm: (name: string) => Promise<boolean>;
};

/**
 * Dialog para criação de novo grupo. Validações em tempo real:
 * - Nome não-vazio (após trim)
 * - Max 64 caracteres
 * - Sem duplicata entre siblings (parent.groups)
 *
 * Sub-bullet UX: quando parent NÃO é root, mostra "Subgrupo de:
 * {nome do parent}" como contexto. Root é tácito.
 *
 * Comportamento:
 * - Enter no input = submit (se válido)
 * - Esc = cancelar (via Dialog overlay)
 * - Botão Criar desabilitado se inválido
 * - Reset do nome ao fechar (open transition)
 */
export function NewGroupDialog({
  open,
  onOpenChange,
  parent,
  parentIsRoot,
  onConfirm,
}: Props) {
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Reset state quando o dialog abre/fecha
  useEffect(() => {
    if (open) {
      setName("");
      setSubmitting(false);
    }
  }, [open]);

  const trimmed = name.trim();

  // Validações em tempo real
  const isEmpty = trimmed.length === 0;
  const isTooLong = trimmed.length > MAX_GROUP_NAME_LENGTH;
  const isDuplicate = parent.groups.some(
    (g) => g.name?.trim().toLowerCase() === trimmed.toLowerCase(),
  );

  const validationError = isEmpty
    ? null // não mostra erro pra estado inicial
    : isTooLong
      ? `Nome muito longo (máximo ${MAX_GROUP_NAME_LENGTH} caracteres).`
      : isDuplicate
        ? "Já existe um grupo com este nome neste nível."
        : null;

  const canSubmit = !isEmpty && !isTooLong && !isDuplicate && !submitting;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    const ok = await onConfirm(trimmed);
    setSubmitting(false);
    if (ok) {
      onOpenChange(false);
    }
    // Se falhou, mantém o dialog aberto (caller mostra toast de erro)
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
          <DialogTitle>Novo grupo</DialogTitle>
          {!parentIsRoot && (
            <DialogDescription>
              Subgrupo de:{" "}
              <span className="font-medium text-foreground">
                {parent.name ?? "(sem nome)"}
              </span>
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="new-group-name">Nome do grupo</Label>
          <Input
            id="new-group-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Digite o nome..."
            maxLength={MAX_GROUP_NAME_LENGTH + 10}
            autoFocus
            disabled={submitting}
          />
          {validationError && (
            <p className="text-xs text-destructive" role="alert">
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
            Criar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
