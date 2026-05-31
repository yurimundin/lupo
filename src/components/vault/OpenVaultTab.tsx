// Tab "Abrir cofre". Usa o diálogo nativo do SO (via
// @tauri-apps/plugin-dialog) para o usuário selecionar o `.kdbx`, então
// pede a senha-mestra e — opcionalmente — um key file.
//
// Suporte a key file (Sessão 3 + adendo):
// - Checkbox "Este cofre usa key file" abaixo do input de senha.
// - Se o app já memorizou o caminho do key file pra esse cofre (ver
//   `settings.keyFilePathByVault`), o checkbox vem pré-marcado e o
//   arquivo aparece pronto. Se o key file lembrado sumiu do disco,
//   mostramos warning amigável e abrimos o picker UMA vez (sem loop).
// - Erros de credencial (senha errada OU key file errado) são
//   indistinguíveis pela kdbxweb — mostramos mensagem unificada quando
//   o cofre foi aberto com key file marcado.

import { open as openDialog } from "@tauri-apps/plugin-dialog";
import {
  Eye,
  EyeOff,
  FileLock2,
  FolderOpen,
  Key,
  Loader2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { CapsLockWarning } from "@/components/CapsLockWarning";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  fileExists,
  inspectVaultRecovery,
  type VaultRecoveryState,
} from "@/lib/fs";
import { useCapsLockWarning } from "@/hooks/useCapsLockWarning";
import { openVault } from "@/lib/kdbx";
import { canRestoreBackup, shouldShowRecoveryPrompt } from "@/lib/vault-recovery";
import { useSettingsStore } from "@/stores/settings";
import { useVaultStore } from "@/stores/vault";

import { VaultRecoveryDialog } from "./VaultRecoveryDialog";

// Sem props: o sucesso popula `useVaultStore` direto.
export function OpenVaultTab() {
  const [filePath, setFilePath] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const passwordCapsLock = useCapsLockWarning();

  const [useKeyFile, setUseKeyFile] = useState(false);
  const [keyFilePath, setKeyFilePath] = useState<string | null>(null);
  const [rememberedKeyFileMissing, setRememberedKeyFileMissing] = useState(false);
  const [recoveryState, setRecoveryState] =
    useState<VaultRecoveryState | null>(null);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [dismissedRecoveryPath, setDismissedRecoveryPath] = useState<
    string | null
  >(null);

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Evita loop de picker: marcamos qual vault path já disparou o picker
  // automático (quando o key file lembrado some do disco).
  const autoPromptedForVault = useRef<string | null>(null);

  const setVaultInStore = useVaultStore((s) => s.setVault);
  const rememberKeyFileSetting = useSettingsStore((s) => s.rememberKeyFile);
  const forgetKeyFileSetting = useSettingsStore((s) => s.forgetKeyFile);

  // Quando o usuário seleciona um cofre, consultamos a memória de key
  // files e pré-preenchemos o estado.
  useEffect(() => {
    if (!filePath) return;
    let cancelled = false;
    (async () => {
      const remembered =
        useSettingsStore.getState().getRememberedKeyFile(filePath);
      if (!remembered) {
        // Sem memória: o usuário decide se marca o checkbox manualmente.
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
        // Auto-abre o picker UMA vez por vault path.
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
        // Recovery e best-effort; erros normais seguem pelo fluxo de abrir.
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
        // Reset do tracker de auto-picker quando o vault muda.
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
      // Se o usuário cancelou: NÃO reabre o picker; mantém warning visível.
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

  async function handleUnlock(event: React.FormEvent) {
    event.preventDefault();
    if (!filePath || password.length === 0 || busy) return;
    if (useKeyFile && !keyFilePath) return; // botão também já bloqueia, defesa em profundidade

    setError(null);
    setBusy(true);
    try {
      const usedKeyFilePath = useKeyFile ? keyFilePath : null;
      const db = await openVault(filePath, password, usedKeyFilePath);
      const fileName = baseName(filePath);

      // Auto-clear: zera a senha do estado React assim que o cofre desbloqueia.
      setPassword("");

      // Popula o store global.
      setVaultInStore(db, filePath, usedKeyFilePath);

      // Atualiza memória de key file.
      if (usedKeyFilePath) {
        rememberKeyFileSetting(filePath, usedKeyFilePath);
      } else if (
        useSettingsStore.getState().getRememberedKeyFile(filePath) !== null
      ) {
        // Cofre tinha key file lembrado mas o usuário desbloqueou sem ele
        // (provavelmente o cofre foi alterado para não exigir mais).
        forgetKeyFileSetting(filePath);
      }

      // Persistir caminho como "último cofre" pra auto-load no próximo
      // boot (ver §24 do CLAUDE.md).
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
          // Mantem o erro original de abertura.
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

  return (
    <form onSubmit={handleUnlock} className="space-y-6">
      <div className="space-y-2">
        <Label>Arquivo do cofre</Label>
        {filePath ? (
          <div className="flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-2">
            <FileLock2 className="text-primary" />
            <span className="flex-1 truncate text-sm font-medium">
              {baseName(filePath)}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setFilePath(null)}
              disabled={busy}
            >
              Trocar
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            onClick={handleSelectFile}
            className="w-full"
            disabled={busy}
          >
            <FolderOpen />
            Selecionar arquivo .kdbx
          </Button>
        )}
      </div>

      {filePath && (
        <>
          <div className="space-y-2">
            <Label htmlFor="open-password">Senha mestra</Label>
            <div className="relative">
              <Input
                id="open-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                autoComplete="current-password"
                disabled={busy}
                className="pr-10"
                {...passwordCapsLock.inputProps}
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              >
                {showPassword ? <EyeOff /> : <Eye />}
              </button>
            </div>
            <CapsLockWarning visible={passwordCapsLock.capsLockOn} />
          </div>

          <div className="space-y-2">
            <div className="flex items-start gap-3">
              <Checkbox
                id="open-use-key-file"
                checked={useKeyFile}
                onCheckedChange={(c) => handleToggleKeyFile(c === true)}
                disabled={busy}
                className="mt-0.5"
              />
              <Label
                htmlFor="open-use-key-file"
                className="text-sm font-normal cursor-pointer"
              >
                Este cofre usa key file
              </Label>
            </div>

            {useKeyFile && (
              <div className="pl-7 space-y-2">
                {keyFilePath ? (
                  <div className="flex items-center gap-2 rounded-md bg-brand-soft px-3 py-2">
                    <Key className="text-primary" />
                    <span className="flex-1 truncate text-sm font-medium">
                      {baseName(keyFilePath)}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleSelectKeyFile}
                      disabled={busy}
                    >
                      Trocar
                    </Button>
                  </div>
                ) : (
                  <>
                    {rememberedKeyFileMissing && (
                      <p className="text-xs text-warning">
                        Key file lembrado não encontrado. Selecione o
                        arquivo manualmente.
                      </p>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleSelectKeyFile}
                      className="w-full"
                      disabled={busy}
                    >
                      <Key />
                      Selecionar key file
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Não foi possível abrir o cofre</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Button
        type="submit"
        size="lg"
        className="w-full"
        disabled={!canUnlock}
      >
        {busy ? (
          <>
            <Loader2 className="animate-spin" />
            Derivando chave...
          </>
        ) : (
          "Desbloquear"
        )}
      </Button>

      {filePath && (
        <VaultRecoveryDialog
          open={recoveryOpen}
          filePath={filePath}
          recovery={recoveryState}
          onOpenCurrent={() => {
            setDismissedRecoveryPath(filePath);
            setRecoveryOpen(false);
          }}
          onRecovered={() => {
            setError(null);
            setDismissedRecoveryPath(null);
            setRecoveryState(null);
          }}
          onOpenChange={(open) => {
            setRecoveryOpen(open);
            if (!open) setDismissedRecoveryPath(filePath);
          }}
        />
      )}
    </form>
  );
}

function baseName(filePath: string): string {
  const parts = filePath.split(/[\\/]/);
  return parts[parts.length - 1] || filePath;
}
