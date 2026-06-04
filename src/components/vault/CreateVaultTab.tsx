import type { ReactNode } from "react";
import {
  Eye,
  EyeOff,
  FileLock2,
  Key,
  Loader2,
  ShieldPlus,
} from "lucide-react";

import { CapsLockWarning } from "@/components/CapsLockWarning";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  baseName,
  useCreateVaultFlow,
} from "@/hooks/useCreateVaultFlow";
import type { PasswordStrength } from "@/lib/password-strength";

const STRENGTH_BAR_CLASS: Record<PasswordStrength["semantic"], string> = {
  destructive: "bg-destructive",
  warning: "bg-warning",
  primary: "bg-primary",
  success: "bg-success",
};

export function CreateVaultTab() {
  const {
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
  } = useCreateVaultFlow();

  return (
    <form onSubmit={handleCreate} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="create-name">Nome do cofre</Label>
        <Input
          id="create-name"
          type="text"
          value={vaultName}
          onChange={(e) => setVaultName(e.target.value)}
          placeholder="Ex.: Cofre pessoal"
          autoFocus
          disabled={busy}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="create-password">Senha mestra</Label>
        <div className="relative">
          <Input
            id="create-password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
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
        {password.length > 0 && (
          <div className="space-y-1.5 pt-1">
            <Progress
              value={strength.percent}
              indicatorClassName={STRENGTH_BAR_CLASS[strength.semantic]}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Força: {strength.label}</span>
              <span>{password.length} caracteres</span>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="create-confirm">Confirmar senha mestra</Label>
        <Input
          id="create-confirm"
          type={showPassword ? "text" : "password"}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          disabled={busy}
          {...confirmCapsLock.inputProps}
        />
        <CapsLockWarning visible={confirmCapsLock.capsLockOn} />
      </div>

      <div className="rounded-md border border-border p-3 space-y-3">
        <div className="flex items-start gap-3">
          <Checkbox
            id="use-key-file"
            checked={useKeyFile}
            onCheckedChange={(c) => handleToggleKeyFile(c === true)}
            disabled={busy}
            className="mt-0.5"
          />
          <div className="flex-1">
            <Label htmlFor="use-key-file" className="font-medium">
              Adicionar key file (opcional, mais seguro)
            </Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Um arquivo extra que se torna parte da chave do cofre. Sem ele, o
              cofre não abre, nem com a senha correta.
            </p>
          </div>
        </div>

        {useKeyFile && (
          <div className="space-y-3 pl-7">
            <div className="flex gap-2">
              <Button
                type="button"
                variant={keyFileMode === "generate" ? "default" : "outline"}
                size="sm"
                onClick={() => handleSwitchMode("generate")}
                disabled={busy}
              >
                Gerar novo
              </Button>
              <Button
                type="button"
                variant={keyFileMode === "existing" ? "default" : "outline"}
                size="sm"
                onClick={() => handleSwitchMode("existing")}
                disabled={busy}
              >
                Usar existente
              </Button>
            </div>

            {keyFile ? (
              <div className="flex items-center gap-2 rounded-md bg-brand-soft px-3 py-2">
                <Key className="text-primary" />
                <span className="flex-1 truncate text-sm font-medium">
                  {baseName(keyFile.path)}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setKeyFile(null)}
                  disabled={busy}
                >
                  Trocar
                </Button>
              </div>
            ) : keyFileMode === "generate" ? (
              <div className="space-y-1.5">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleGenerateKeyFile}
                  className="w-full"
                  disabled={busy}
                >
                  <Key />
                  Gerar e salvar key file
                </Button>
                <p className="text-xs text-muted-foreground">
                  Sugestão: salve em pasta diferente do cofre.
                </p>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={handleSelectExistingKeyFile}
                className="w-full"
                disabled={busy}
              >
                <FileLock2 />
                Selecionar key file
              </Button>
            )}

            <div className="space-y-2 rounded-md bg-bg-secondary p-3">
              <p className="text-xs font-medium text-foreground">
                Antes de continuar, confirme:
              </p>
              <CheckboxRow
                id="ack-loss"
                checked={ackLoss}
                onChange={setAckLoss}
                disabled={busy}
              >
                Entendi que sem este key file eu não consigo abrir o cofre,
                mesmo com a senha correta.
              </CheckboxRow>
              <CheckboxRow
                id="ack-separation"
                checked={ackSeparation}
                onChange={setAckSeparation}
                disabled={busy}
              >
                Vou guardar o key file em local separado do cofre.
              </CheckboxRow>
              <CheckboxRow
                id="ack-backup"
                checked={ackBackup}
                onChange={setAckBackup}
                disabled={busy}
              >
                Vou manter pelo menos um backup do key file em outro local
                seguro.
              </CheckboxRow>
            </div>
          </div>
        )}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Não foi possível criar o cofre</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {validation && password.length > 0 && (
        <p className="text-xs text-muted-foreground">{validation}</p>
      )}

      <Button
        type="submit"
        size="lg"
        className="w-full"
        disabled={validation !== null || busy}
      >
        {busy ? (
          <>
            <Loader2 className="animate-spin" />
            Derivando chave...
          </>
        ) : (
          <>
            <ShieldPlus />
            Criar cofre
          </>
        )}
      </Button>
    </form>
  );
}

function CheckboxRow({
  id,
  checked,
  onChange,
  disabled,
  children,
}: {
  id: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start gap-2">
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(c) => onChange(c === true)}
        disabled={disabled}
        className="mt-0.5"
      />
      <Label
        htmlFor={id}
        className="text-xs font-normal leading-snug cursor-pointer"
      >
        {children}
      </Label>
    </div>
  );
}
