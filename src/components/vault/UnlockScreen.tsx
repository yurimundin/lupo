// Tela de desbloqueio simplificada — aparece quando o usuário bloqueou
// (ou auto-lock disparou) mas o app ainda lembra qual era o cofre.
// Mostra o nome do arquivo já fixado e pede só credenciais.
//
// Reusa a mesma `openVault` da Tarefa 3, e populariza o store
// diretamente. Se há key file lembrado, pré-preenche; se sumiu do disco,
// mostra warning e abre picker uma vez (mesmo padrão do `OpenVaultTab`).

import { open as openDialog } from "@tauri-apps/plugin-dialog";
import {
  Eye,
  EyeOff,
  FileLock2,
  Key,
  Loader2,
  Lock as LockIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fileExists } from "@/lib/fs";
import { openVault } from "@/lib/kdbx";
import { useSettingsStore } from "@/stores/settings";
import { useVaultStore } from "@/stores/vault";

export function UnlockScreen() {
  const lastFilePath = useVaultStore((s) => s.lastFilePath);
  const lastKeyFilePath = useVaultStore((s) => s.lastKeyFilePath);
  const unlock = useVaultStore((s) => s.unlock);
  const reset = useVaultStore((s) => s.reset);
  const rememberKeyFileSetting = useSettingsStore((s) => s.rememberKeyFile);
  const forgetKeyFileSetting = useSettingsStore((s) => s.forgetKeyFile);

  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [useKeyFile, setUseKeyFile] = useState(lastKeyFilePath !== null);
  const [keyFilePath, setKeyFilePath] = useState<string | null>(
    lastKeyFilePath,
  );
  const [rememberedKeyFileMissing, setRememberedKeyFileMissing] =
    useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const autoPromptedRef = useRef(false);

  // Verifica se o key file lembrado ainda existe.
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastKeyFilePath]);

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

  async function handleUnlock(event: React.FormEvent) {
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

      // Atualiza memória.
      if (usedKeyFilePath) {
        rememberKeyFileSetting(lastFilePath, usedKeyFilePath);
      } else if (
        useSettingsStore.getState().getRememberedKeyFile(lastFilePath) !== null
      ) {
        forgetKeyFileSetting(lastFilePath);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (!lastFilePath) return null;

  const canUnlock =
    password.length > 0 && !busy && (!useKeyFile || keyFilePath !== null);

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
      <div className="w-full max-w-[440px] space-y-6">
        <header className="flex items-center justify-center gap-2">
          <LockIcon className="text-primary" />
          <h1 className="text-2xl font-semibold tracking-tight">Sec.Basis</h1>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>Cofre bloqueado</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUnlock} className="space-y-4">
              <div className="flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-2">
                <FileLock2 className="text-primary" />
                <span
                  className="flex-1 truncate text-sm font-medium"
                  title={lastFilePath}
                >
                  {baseName(lastFilePath)}
                </span>
              </div>

              <div className="space-y-2">
                <Label htmlFor="unlock-password">Senha mestra</Label>
                <div className="relative">
                  <Input
                    id="unlock-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoFocus
                    autoComplete="current-password"
                    disabled={busy}
                    className="pr-10"
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
              </div>

              {lastKeyFilePath !== null && (
                <div className="space-y-2">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="unlock-use-key-file"
                      checked={useKeyFile}
                      onCheckedChange={(c) => {
                        const v = c === true;
                        setUseKeyFile(v);
                        if (!v) {
                          setKeyFilePath(null);
                          setRememberedKeyFileMissing(false);
                        } else if (lastKeyFilePath) {
                          // Volta a sugerir o lembrado (re-verifica existência
                          // ao tentar desbloquear).
                          setKeyFilePath(lastKeyFilePath);
                        }
                      }}
                      disabled={busy}
                      className="mt-0.5"
                    />
                    <Label
                      htmlFor="unlock-use-key-file"
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
              )}

              {error && (
                <Alert variant="destructive">
                  <AlertTitle>Não foi possível desbloquear</AlertTitle>
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

              <button
                type="button"
                onClick={reset}
                className="w-full text-xs text-muted-foreground hover:text-foreground"
              >
                Voltar para a tela inicial (abrir outro cofre)
              </button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function baseName(filePath: string): string {
  const parts = filePath.split(/[\\/]/);
  return parts[parts.length - 1] || filePath;
}
