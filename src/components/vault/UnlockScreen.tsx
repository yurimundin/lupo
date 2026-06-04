import { Eye, EyeOff, FileLock2, Key, Loader2 } from "lucide-react";

import { CapsLockWarning } from "@/components/CapsLockWarning";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { baseName, useUnlockVaultFlow } from "@/hooks/useUnlockVaultFlow";

import { VaultRecoveryDialog } from "./VaultRecoveryDialog";

export function UnlockScreen() {
  const {
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
  } = useUnlockVaultFlow();

  if (!lastFilePath) return null;

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
      <div className="w-full max-w-[460px] flex flex-col items-center gap-8">
        <header className="flex flex-col items-center gap-4">
          <img
            src="/lupo-appicon-steel.svg"
            alt="Lupo logo"
            className="size-[84px]"
          />
          <div className="text-center">
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
              Lupo
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Cofre bloqueado
            </p>
          </div>
        </header>

        <Card className="w-full border border-border shadow-sm ring-0">
          <CardContent className="p-8">
            <form onSubmit={handleUnlock} className="space-y-6">
              <div className="space-y-2">
                <Label>Cofre</Label>
                <div className="flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-2.5">
                  <FileLock2 className="text-primary size-4 shrink-0" />
                  <span
                    className="flex-1 truncate text-sm font-medium"
                    title={lastFilePath}
                  >
                    {baseName(lastFilePath)}
                  </span>
                </div>
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

              {lastKeyFilePath !== null && (
                <div className="space-y-2">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="unlock-use-key-file"
                      checked={useKeyFile}
                      onCheckedChange={(c) => handleToggleKeyFile(c === true)}
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
                onClick={handleBackToInitial}
                className="w-full text-xs text-muted-foreground hover:text-foreground"
              >
                Voltar para a tela inicial (abrir outro cofre)
              </button>
            </form>
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground text-center">
          Compatível com KeePass / KeePassXC · Offline-first
        </p>
      </div>

      <VaultRecoveryDialog
        open={recoveryOpen}
        filePath={lastFilePath}
        recovery={recoveryState}
        onOpenCurrent={() => {
          setDismissedRecovery(true);
          setRecoveryOpen(false);
        }}
        onRecovered={() => {
          setError(null);
          setDismissedRecovery(false);
          setRecoveryState(null);
        }}
        onOpenChange={(open) => {
          setRecoveryOpen(open);
          if (!open) setDismissedRecovery(true);
        }}
      />
    </div>
  );
}
