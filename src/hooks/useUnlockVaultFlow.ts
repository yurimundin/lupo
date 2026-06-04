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

export function useUnlockVaultFlow() {
  const lastFilePath = useVaultStore((s) => s.lastFilePath);
  const lastKeyFilePath = useVaultStore((s) => s.lastKeyFilePath);
  const unlock = useVaultStore((s) => s.unlock);
  const resetVault = useVaultStore((s) => s.reset);
  const rememberKeyFileSetting = useSettingsStore((s) => s.rememberKeyFile);
  const forgetKeyFileSetting = useSettingsStore((s) => s.forgetKeyFile);
  const setLastOpenedVaultPath = useSettingsStore(
    (s) => s.setLastOpenedVaultPath,
  );

  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const passwordCapsLock = useCapsLockWarning();
  const [useKeyFile, setUseKeyFile] = useState(lastKeyFilePath !== null);
  const [keyFilePath, setKeyFilePath] = useState<string | null>(
    lastKeyFilePath,
  );
  const [rememberedKeyFileMissing, setRememberedKeyFileMissing] =
    useState(false);
  const [recoveryState, setRecoveryState] =
    useState<VaultRecoveryState | null>(null);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [dismissedRecovery, setDismissedRecovery] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const autoPromptedRef = useRef(false);

  function handleBackToInitial() {
    setLastOpenedVaultPath(null);
    resetVault();
  }

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
    if (!lastKeyFilePath) return;
    let cancelled = false;
    (async () => {
      const exists = await fileExists(lastKeyFilePath);
      if (cancelled) return;
      if (!exists) {
        setKeyFilePath(null);
        setRememberedKeyFileMissing(true);
        if (!autoPromptedRef.current) {
          autoPromptedRef.current = true;
          await handleSelectKeyFile();
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [lastKeyFilePath]);

  useEffect(() => {
    if (!lastFilePath || dismissedRecovery) return;
    let cancelled = false;
    (async () => {
      try {
        const state = await inspectVaultRecovery(lastFilePath);
        if (cancelled) return;
        setRecoveryState(state);
        if (shouldShowRecoveryPrompt(state)) {
          setRecoveryOpen(true);
        }
      } catch {
        // Recovery é best-effort; o desbloqueio normal continua disponível.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [lastFilePath, dismissedRecovery]);

  function handleToggleKeyFile(checked: boolean) {
    setUseKeyFile(checked);
    if (!checked) {
      setKeyFilePath(null);
      setRememberedKeyFileMissing(false);
    } else if (lastKeyFilePath) {
      setKeyFilePath(lastKeyFilePath);
    }
  }

  async function handleUnlock(event: FormEvent) {
    event.preventDefault();
    if (!lastFilePath || password.length === 0 || busy) return;
    if (useKeyFile && !keyFilePath) return;

    setError(null);
    setBusy(true);
    try {
      const usedKeyFilePath = useKeyFile ? keyFilePath : null;
      const db = await openVault(lastFilePath, password, usedKeyFilePath);
      setPassword("");

      unlock(db);

      if (usedKeyFilePath) {
        rememberKeyFileSetting(lastFilePath, usedKeyFilePath);
      } else if (
        useSettingsStore.getState().getRememberedKeyFile(lastFilePath) !== null
      ) {
        forgetKeyFileSetting(lastFilePath);
      }

      useSettingsStore.getState().setLastOpenedVaultPath(lastFilePath);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
      if (lastFilePath && /corrompido|corrupt|kdbx/i.test(message)) {
        try {
          const state = await inspectVaultRecovery(lastFilePath);
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
    password.length > 0 && !busy && (!useKeyFile || keyFilePath !== null);

  return {
    busy,
    canUnlock,
    error,
    handleBackToInitial,
    handleSelectKeyFile,
    handleToggleKeyFile,
    handleUnlock,
    keyFilePath,
    lastFilePath,
    lastKeyFilePath,
    password,
    passwordCapsLock,
    recoveryOpen,
    recoveryState,
    rememberedKeyFileMissing,
    setDismissedRecovery,
    setError,
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
