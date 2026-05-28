// Hook que commita o draft do `EntryEditor` no `Kdbx` em memória e
// persiste no disco via `saveVault`.
//
// Fluxo:
//   1. Validações (cofre aberto, draft válido, título não-vazio).
//   2. Em edição, cria snapshot nativo em `entry.history` antes de alterar.
//   3. Mutação in-place do `Kdbx`:
//      - `edit`: localiza entry e delega para `updateEntryFieldsInVault`.
//      - `create`: cria entry no `draftEntry.groupUuid`, popula fields.
//      Senha entra como `ProtectedValue.fromString` (não string clara).
//   4. `saveVault(filePath, kdbx)` — backup atômico + magic check + rename.
//   5. Em sucesso: `incrementVaultVersion`, seleciona a entry,
//      `exitToViewMode`, toast verde.
//   6. Em falha de save: rollback in-memory + toast vermelho + retorna
//      `false`. Edit mode preservado pra usuário tentar de novo.
//
// Retorno: `Promise<boolean>` — `true` se salvou, `false` em qualquer falha.

import * as kdbxweb from "kdbxweb";
import { useCallback } from "react";
import { toast } from "sonner";

import { saveVault, updateEntryFieldsInVault } from "@/lib/kdbx";
import {
  findEntryByUuidIdInDb,
  findGroupByUuidIdInDb,
  useVaultStore,
} from "@/stores/vault";

export function useCommitEdit(): () => Promise<boolean> {
  const editMode = useVaultStore((s) => s.editMode);
  const draftEntry = useVaultStore((s) => s.draftEntry);
  const kdbx = useVaultStore((s) => s.kdbx);
  const lastFilePath = useVaultStore((s) => s.lastFilePath);
  const exitToViewMode = useVaultStore((s) => s.exitToViewMode);
  const incrementVaultVersion = useVaultStore((s) => s.incrementVaultVersion);
  const selectEntry = useVaultStore((s) => s.selectEntry);

  return useCallback(async (): Promise<boolean> => {
    if (!kdbx || !lastFilePath || !draftEntry) {
      toast.error("Estado inválido — não há cofre aberto.");
      return false;
    }
    if (!draftEntry.title.trim()) {
      toast.error("Título é obrigatório.");
      return false;
    }

    try {
      let entryUuid: string | null = null;

      if (editMode === "edit") {
        const selectedEntryUuid = useVaultStore.getState().selectedEntryUuid;
        if (!selectedEntryUuid) {
          toast.error("Nenhuma entrada selecionada.");
          return false;
        }
        const entry = findEntryByUuidIdInDb(kdbx, selectedEntryUuid);
        if (!entry) {
          toast.error("Entrada não encontrada no cofre.");
          return false;
        }

        const result = await updateEntryFieldsInVault(
          lastFilePath,
          kdbx,
          entry,
          {
            title: draftEntry.title,
            username: draftEntry.username,
            password: draftEntry.password,
            url: draftEntry.url,
            notes: draftEntry.notes,
          },
        );
        if (!result.ok) {
          toast.error(`Falha ao salvar: ${result.error}`);
          return false;
        }

        entryUuid = selectedEntryUuid;
        incrementVaultVersion();
        toast.success(`Salvo (${result.durationMs}ms)`);
      } else if (editMode === "create") {
        const group = findGroupByUuidIdInDb(kdbx, draftEntry.groupUuid);
        if (!group) {
          toast.error("Grupo de destino não encontrado.");
          return false;
        }
        const entry = kdbx.createEntry(group);
        entry.fields.set("Title", draftEntry.title);
        entry.fields.set("UserName", draftEntry.username);
        entry.fields.set(
          "Password",
          kdbxweb.ProtectedValue.fromString(draftEntry.password),
        );
        entry.fields.set("URL", draftEntry.url);
        entry.fields.set("Notes", draftEntry.notes);

        const result = await saveVault(lastFilePath, kdbx);
        if (!result.ok) {
          // Rollback: remover a entry recém-criada do grupo.
          const idx = group.entries.indexOf(entry);
          if (idx >= 0) group.entries.splice(idx, 1);
          toast.error(`Falha ao salvar: ${result.error}`);
          return false;
        }

        entryUuid = entry.uuid.id;
        incrementVaultVersion();
        toast.success(`Salvo (${result.durationMs}ms)`);
      } else {
        // editMode === 'view' — não deveria acontecer, mas defesa.
        toast.error("Modo inválido para salvar.");
        return false;
      }

      if (entryUuid) selectEntry(entryUuid);
      exitToViewMode();
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Erro inesperado ao salvar: ${msg}`);
      return false;
    }
  }, [
    editMode,
    draftEntry,
    kdbx,
    lastFilePath,
    exitToViewMode,
    incrementVaultVersion,
    selectEntry,
  ]);
}
