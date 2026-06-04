import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { type FormEvent, useEffect, useRef, useState } from "react";

import { useCapsLockWarning } from "@/hooks/useCapsLockWarning";
import { openVault } from "@/lib/kdbx";
import {
  canRestoreBackup,
  shouldShowRecoveryPrompt,
} from "@/lib/vault-recovery";
import {
  fileExists,
  inspectVaultRecovery,
  type VaultRecoveryState,
} from "@/services/tauri/fs";
import { useSettingsStore } from "@/stores/settings";
import { useVaultStore } from "@/stores/vault";

export function useOpenVaultFlow() {
  const [filePath, setFilePath] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const passwordCapsLock = useCapsLockWarning();

  const [useKeyFile, setUseKeyFile] = useState(false);
  const [keyFilePath, setKeyFilePath] = useState<string | null>(null);
  const [rememberedKeyFileMissing, setRememberedKeyFileMissing] =
    useState(false);
  const [recoveryState, setRecoveryState] =
    useState<VaultRecoveryState | null>(null);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [dismissedRecoveryPath, setDismissedRecoveryPath] = useState<
    string | null
  >(null);

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const autoPromptedForVault = useRef<string | null>(null);

  const setVaultInStore = useVaultStore((s) => s.setVault);
  const rememberKeyFileSetting = useSettingsStore((s) => s.rememberKeyFile);
  const forgetKeyFileSetting = useSettingsStore((s) => s.forgetKeyFile);

  async function handleSelectKeyFile() {
    setError(null);
    try {
      const path = await openDialog({
        title: "Selecione o key file",
        multiple: false,
        directory: false,
        filters: [{ name: "Key File", extensions: ["keyx", "key", "*"] }],
      });
      if (typeof path === "string") {
        setKeyFilePath(path);
        setRememberedKeyFileMissing(false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => {
    if (!filePath) return;
    let cancelled = false;
    (async () => {
      const remembered =
        useSettingsStore.getState().getRememberedKeyFile(filePath);
      if (!remembered) {
        if (!cancelled) {
          setUseKeyFile(false);
          setKeyFilePath(null);
          setRememberedKeyFileMissing(false);
        }
        return;
      }

      const exists = await fileExists(remembered);
      if (cancelled) return;

      if (exists) {
        setUseKeyFile(true);
        setKeyFilePath(remembered);
        setRememberedKeyFileMissing(false);
      } else {
        setUseKeyFile(true);
        setKeyFilePath(null);
        setRememberedKeyFileMissing(true);
        if (autoPromptedForVault.current !== filePath) {
          autoPromptedForVault.current = filePath;
          await handleSelectKeyFile();
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [filePath]);

  useEffect(() => {
    if (!filePath || dismissedRecoveryPath === filePath) return;
    let cancelled = false;
    (async () => {
      try {
        const state = await inspectVaultRecovery(filePath);
        if (cancelled) return;
        setRecoveryState(state);
        if (shouldShowRecoveryPrompt(state)) {
          setRecoveryOpen(true);
        }
      } catch {
        // Recovery é best-effort; erros normais seguem pelo fluxo de abrir.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [filePath, dismissedRecoveryPath]);

  async function handleSelectFile() {
    setError(null);
    try {
      const selected = await openDialog({
        title: "Selecione o cofre .kdbx",
        multiple: false,
        directory: false,
        filters: [{ name: "Cofre KeePass", extensions: ["kdbx"] }],
      });
      if (typeof selected === "string") {
        autoPromptedForVault.current = null;
        setDismissedRecoveryPath(null);
        setRecoveryState(null);
        setRecoveryOpen(false);
        setFilePath(selected);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  function handleToggleKeyFile(checked: boolean) {
    setUseKeyFile(checked);
    if (!checked) {
      setKeyFilePath(null);
      setRememberedKeyFileMissing(false);
    }
  }

  async function handleUnlock(event: FormEvent) {
    event.preventDefault();
    if (!filePath || password.length === 0 || busy) return;
    if (useKeyFile && !keyFilePath) return;

    setError(null);
    setBusy(true);
    try {
      const usedKeyFilePath = useKeyFile ? keyFilePath : null;
      const db = await openVault(filePath, password, usedKeyFilePath);
      const fileName = baseName(filePath);

      setPassword("");
      setVaultInStore(db, filePath, usedKeyFilePath);

      if (usedKeyFilePath) {
        rememberKeyFileSetting(filePath, usedKeyFilePath);
      } else if (
        useSettingsStore.getState().getRememberedKeyFile(filePath) !== null
      ) {
        forgetKeyFileSetting(filePath);
      }

      useSettingsStore.getState().setLastOpenedVaultPath(filePath);
      console.info("[Lupo] cofre aberto:", fileName, db.meta.name);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
      if (filePath && /corrompido|corrupt|kdbx/i.test(message)) {
        try {
          const state = await inspectVaultRecovery(filePath);
          setRecoveryState(state);
          if (canRestoreBackup(state)) {
            setRecoveryOpen(true);
          }
        } catch {
          // Mantém o erro original de abertura.
        }
      }
    } finally {
      setBusy(false);
    }
  }

  const canUnlock =
    filePath !== null &&
    password.length > 0 &&
    !busy &&
    (!useKeyFile || keyFilePath !== null);

  return {
    busy,
    canUnlock,
    error,
    filePath,
    handleSelectFile,
    handleSelectKeyFile,
    handleToggleKeyFile,
    handleUnlock,
    keyFilePath,
    password,
    passwordCapsLock,
    recoveryOpen,
    recoveryState,
    rememberedKeyFileMissing,
    setDismissedRecoveryPath,
    setError,
    setFilePath,
    setPassword,
    setRecoveryOpen,
    setRecoveryState,
    setShowPassword,
    showPassword,
    useKeyFile,
  };
}

export function baseName(filePath: string): string {
  const parts = filePath.split(/[\\/]/);
  return parts[parts.length - 1] || filePath;
}
