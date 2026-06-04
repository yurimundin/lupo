import { open as openDialog, save as saveDialog } from "@tauri-apps/plugin-dialog";
import { type FormEvent, useMemo, useState } from "react";

import { useCapsLockWarning } from "@/hooks/useCapsLockWarning";
import { createVault, generateKeyFile, writeNewVaultFile } from "@/lib/kdbx";
import {
  computePasswordStrength,
  type PasswordStrength,
} from "@/lib/password-strength";
import { readLocalFileBytes } from "@/services/tauri/file-bytes";
import { useSettingsStore } from "@/stores/settings";
import { useVaultStore } from "@/stores/vault";

export const MIN_PASSWORD_LENGTH = 8;

export type KeyFileMode = "generate" | "existing";

export interface KeyFileSelection {
  path: string;
  bytes: Uint8Array;
}

export function useCreateVaultFlow() {
  const [vaultName, setVaultName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const passwordCapsLock = useCapsLockWarning();
  const confirmCapsLock = useCapsLockWarning();

  const [useKeyFile, setUseKeyFile] = useState(false);
  const [keyFileMode, setKeyFileMode] = useState<KeyFileMode>("generate");
  const [keyFile, setKeyFile] = useState<KeyFileSelection | null>(null);
  const [ackLoss, setAckLoss] = useState(false);
  const [ackSeparation, setAckSeparation] = useState(false);
  const [ackBackup, setAckBackup] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const setVaultInStore = useVaultStore((s) => s.setVault);
  const rememberKeyFileSetting = useSettingsStore((s) => s.rememberKeyFile);

  const strength = useMemo<PasswordStrength>(
    () => computePasswordStrength(password),
    [password],
  );

  const validation = useMemo(() => {
    if (vaultName.trim().length === 0) return "Informe um nome para o cofre.";
    if (password.length < MIN_PASSWORD_LENGTH) {
      return `A senha mestra precisa ter ao menos ${MIN_PASSWORD_LENGTH} caracteres.`;
    }
    if (password !== confirm) return "As senhas não coincidem.";
    if (useKeyFile) {
      if (!keyFile) return "Gere ou selecione um key file.";
      if (!ackLoss || !ackSeparation || !ackBackup) {
        return "Confirme as três responsabilidades sobre o key file.";
      }
    }
    return null;
  }, [
    ackBackup,
    ackLoss,
    ackSeparation,
    confirm,
    keyFile,
    password,
    useKeyFile,
    vaultName,
  ]);

  function handleToggleKeyFile(checked: boolean) {
    setUseKeyFile(checked);
    if (!checked) {
      setKeyFile(null);
      setAckLoss(false);
      setAckSeparation(false);
      setAckBackup(false);
    }
  }

  function handleSwitchMode(mode: KeyFileMode) {
    setKeyFileMode(mode);
    setKeyFile(null);
  }

  async function handleGenerateKeyFile() {
    setError(null);
    try {
      const path = await saveDialog({
        title: "Salvar key file",
        defaultPath: `${sanitizeFileName(vaultName) || "lupo-key"}.keyx`,
        filters: [{ name: "Lupo Key File", extensions: ["keyx"] }],
      });
      if (!path) return;
      const bytes = await generateKeyFile(path);
      setKeyFile({ path, bytes });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleSelectExistingKeyFile() {
    setError(null);
    try {
      const path = await openDialog({
        title: "Selecione o key file",
        multiple: false,
        directory: false,
        filters: [{ name: "Key File", extensions: ["keyx", "key", "*"] }],
      });
      if (typeof path !== "string") return;
      const bytes = await readLocalFileBytes(path);
      setKeyFile({ path, bytes });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (validation || busy) return;

    setError(null);
    setBusy(true);
    try {
      const vaultPath = await saveDialog({
        title: "Salvar novo cofre",
        defaultPath: `${sanitizeFileName(vaultName)}.kdbx`,
        filters: [{ name: "Cofre KeePass", extensions: ["kdbx"] }],
      });
      if (!vaultPath) {
        setBusy(false);
        return;
      }

      const db = await createVault(
        vaultName.trim(),
        password,
        useKeyFile && keyFile ? keyFile.bytes : null,
      );
      setPassword("");
      setConfirm("");

      await writeNewVaultFile(vaultPath, db);
      console.info("[Lupo] cofre criado em:", vaultPath);

      const usedKeyFilePath = useKeyFile && keyFile ? keyFile.path : null;
      setVaultInStore(db, vaultPath, usedKeyFilePath);
      if (usedKeyFilePath) {
        rememberKeyFileSetting(vaultPath, usedKeyFilePath);
      }

      useSettingsStore.getState().setLastOpenedVaultPath(vaultPath);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return {
    ackBackup,
    ackLoss,
    ackSeparation,
    busy,
    confirm,
    confirmCapsLock,
    error,
    handleCreate,
    handleGenerateKeyFile,
    handleSelectExistingKeyFile,
    handleSwitchMode,
    handleToggleKeyFile,
    keyFile,
    keyFileMode,
    password,
    passwordCapsLock,
    setAckBackup,
    setAckLoss,
    setAckSeparation,
    setConfirm,
    setKeyFile,
    setPassword,
    setShowPassword,
    setVaultName,
    showPassword,
    strength,
    useKeyFile,
    validation,
    vaultName,
  };
}

export function sanitizeFileName(name: string): string {
  // eslint-disable-next-line no-control-regex
  return name.replace(/[<>:"/\\|?*\x00-\x1F]/g, "_").trim();
}

export function baseName(filePath: string): string {
  const parts = filePath.split(/[\\/]/);
  return parts[parts.length - 1] || filePath;
}
