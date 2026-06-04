import {
  Eye,
  EyeOff,
  FileLock2,
  FolderOpen,
  Key,
  Loader2,
} from "lucide-react";

import { CapsLockWarning } from "@/components/CapsLockWarning";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { baseName, useOpenVaultFlow } from "@/hooks/useOpenVaultFlow";

import { VaultRecoveryDialog } from "./VaultRecoveryDialog";

export function OpenVaultTab() {
  const {
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
  } = useOpenVaultFlow();

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
                        Key file lembrado não encontrado. Selecione o arquivo
                        manualmente.
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

      <Button type="submit" size="lg" className="w-full" disabled={!canUnlock}>
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
