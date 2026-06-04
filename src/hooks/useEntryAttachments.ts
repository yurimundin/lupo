import type { KdbxEntry } from "kdbxweb";
import { useCallback } from "react";
import { open as openDialog, save as saveDialog } from "@tauri-apps/plugin-dialog";
import { toast } from "sonner";

import { confirmDialog } from "@/lib/confirm";
import {
  getFileNameFromPath,
  readLocalFileBytes,
  writeLocalFileBytes,
} from "@/services/tauri/file-bytes";
import {
  addEntryAttachmentInVault,
  getEntryAttachmentBytes,
  removeEntryAttachmentInVault,
} from "@/lib/kdbx";

import { useVaultMutationContext } from "./useVaultMutationContext";

export function useEntryAttachments(): {
  addAttachment: (entry: KdbxEntry) => Promise<boolean>;
  exportAttachment: (
    entry: KdbxEntry,
    attachmentName: string,
  ) => Promise<boolean>;
  removeAttachment: (
    entry: KdbxEntry,
    attachmentName: string,
  ) => Promise<boolean>;
} {
  const mutation = useVaultMutationContext();

  const addAttachment = useCallback(
    async (entry: KdbxEntry): Promise<boolean> => {
      if (!mutation) {
        toast.error("Cofre não está pronto.");
        return false;
      }

      const selected = await openDialog({
        title: "Selecionar anexo",
        multiple: false,
        directory: false,
      });
      const filePath = Array.isArray(selected) ? selected[0] : selected;
      if (!filePath) return false;

      try {
        const bytes = await readLocalFileBytes(filePath);
        const result = await addEntryAttachmentInVault(
          mutation.lastFilePath,
          mutation.kdbx,
          entry,
          getFileNameFromPath(filePath),
          bytes,
        );

        if (!result.ok) {
          toast.error(`Falha ao anexar: ${result.error}`);
          return false;
        }

        mutation.incrementVaultVersion();
        toast.success(`Anexo "${result.attachmentName}" adicionado.`);
        return true;
      } catch (e) {
        toast.error(`Falha ao anexar: ${describeError(e)}`);
        return false;
      }
    },
    [mutation],
  );

  const exportAttachment = useCallback(
    async (
      entry: KdbxEntry,
      attachmentName: string,
    ): Promise<boolean> => {
      const bytes = getEntryAttachmentBytes(entry, attachmentName);
      if (!bytes) {
        toast.error("Anexo não encontrado.");
        return false;
      }

      const targetPath = await saveDialog({
        title: "Salvar anexo",
        defaultPath: attachmentName,
      });
      if (!targetPath) return false;

      try {
        await writeLocalFileBytes(targetPath, bytes);
        toast.success(`Anexo "${attachmentName}" salvo.`);
        return true;
      } catch (e) {
        toast.error(`Falha ao salvar anexo: ${describeError(e)}`);
        return false;
      }
    },
    [],
  );

  const removeAttachment = useCallback(
    async (
      entry: KdbxEntry,
      attachmentName: string,
    ): Promise<boolean> => {
      if (!mutation) {
        toast.error("Cofre não está pronto.");
        return false;
      }

      const confirmed = await confirmDialog({
        title: "Remover anexo?",
        description: `O anexo "${attachmentName}" será removido desta entrada e o cofre será salvo.`,
        confirmLabel: "Remover anexo",
        cancelLabel: "Cancelar",
        variant: "danger",
      });
      if (!confirmed) return false;

      const result = await removeEntryAttachmentInVault(
        mutation.lastFilePath,
        mutation.kdbx,
        entry,
        attachmentName,
      );
      if (!result.ok) {
        toast.error(`Falha ao remover anexo: ${result.error}`);
        return false;
      }

      mutation.incrementVaultVersion();
      toast.success(`Anexo "${attachmentName}" removido.`);
      return true;
    },
    [mutation],
  );

  return { addAttachment, exportAttachment, removeAttachment };
}

function describeError(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  return String(e);
}
