// Tab "Criar cofre". Pede nome + senha mestra + (opcionalmente) key file,
// mostra medidor de força e usa o diálogo nativo "Salvar como" para gravar
// o `.kdbx`. KDF aplicado é `KDBX4_SECURE_KDF_PARAMS` (64 MiB / 2 iter / 2
// lanes / Argon2id) — não o default fraco da kdbxweb.
//
// Suporte a key file (Sessão 3):
// - Opcional ("Adicionar key file" como switch).
// - Modo "Gerar novo" → kdbxweb.Credentials.createRandomKeyFile(2) →
//   formato `.keyx` v2 do KeePassXC, gravado via comando Tauri.
// - Modo "Usar existente" → file picker, qualquer arquivo é aceito como
//   chave (binário ou XML KeePassXC).
// - 3 checkboxes obrigatórios consciencializam o usuário: sem key file não
//   há como abrir o cofre, nem nós podemos recuperar.

import { open as openDialog, save as saveDialog } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import {
  Eye,
  EyeOff,
  FileLock2,
  Key,
  Loader2,
  ShieldPlus,
} from "lucide-react";
import { useMemo, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { createVault, generateKeyFile, writeNewVaultFile } from "@/lib/kdbx";
import {
  computePasswordStrength,
  type PasswordStrength,
} from "@/lib/password-strength";
import { useSettingsStore } from "@/stores/settings";
import { useVaultStore } from "@/stores/vault";

const MIN_PASSWORD_LENGTH = 8;

const STRENGTH_BAR_CLASS: Record<PasswordStrength["semantic"], string> = {
  destructive: "bg-destructive",
  warning: "bg-warning",
  primary: "bg-primary",
  success: "bg-success",
};

type KeyFileMode = "generate" | "existing";

interface KeyFileSelection {
  path: string;
  bytes: Uint8Array;
}

// Sem props: o sucesso popula `useVaultStore` direto, e o switch em
// `App.tsx` cuida da navegação para o VaultLayout.
export function CreateVaultTab() {
  const [vaultName, setVaultName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);

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

  const strength = useMemo(
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
    vaultName,
    password,
    confirm,
    useKeyFile,
    keyFile,
    ackLoss,
    ackSeparation,
    ackBackup,
  ]);

  // Reset do key file quando o usuário muda o modo ou desliga a opção, pra
  // não ficar com bytes obsoletos no estado.
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
        filters: [
          { name: "Key File", extensions: ["keyx", "key", "*"] },
        ],
      });
      if (typeof path !== "string") return;
      const raw = await invoke<number[] | Uint8Array>("read_file_bytes", {
        path,
      });
      const bytes = raw instanceof Uint8Array ? raw : new Uint8Array(raw);
      setKeyFile({ path, bytes });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleCreate(event: React.FormEvent) {
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
      // Auto-clear: limpa as senhas do estado React assim que as
      // Credentials foram montadas dentro do Kdbx.
      setPassword("");
      setConfirm("");

      await writeNewVaultFile(vaultPath, db);
      console.info("[Lupo] cofre criado em:", vaultPath);

      const usedKeyFilePath = useKeyFile && keyFile ? keyFile.path : null;

      // Popula o store global (App.tsx vai trocar a tela pro VaultLayout) e
      // memoriza o key file para futuras aberturas.
      setVaultInStore(db, vaultPath, usedKeyFilePath);
      if (usedKeyFilePath) {
        rememberKeyFileSetting(vaultPath, usedKeyFilePath);
      }

      // Persistir caminho como "último cofre" pra auto-load no próximo
      // boot (ver §24 do CLAUDE.md).
      useSettingsStore.getState().setLastOpenedVaultPath(vaultPath);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

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
        />
      </div>

      {/* ---------- Bloco opcional: Key File ---------- */}
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
              Um arquivo extra que se torna parte da chave do cofre. Sem
              ele, o cofre não abre — nem com a senha correta.
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
                  Sugestão: salve em pasta diferente do cofre (pen drive,
                  pasta criptografada, gerenciador da empresa).
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
                Entendi que sem este key file eu NÃO consigo abrir o cofre,
                mesmo com a senha correta.
              </CheckboxRow>
              <CheckboxRow
                id="ack-separation"
                checked={ackSeparation}
                onChange={setAckSeparation}
                disabled={busy}
              >
                Vou guardar o key file em local separado do cofre
                (idealmente em outro dispositivo: pen drive, pasta
                criptografada, cofre da família).
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
  children: React.ReactNode;
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
      <Label htmlFor={id} className="text-xs font-normal leading-snug cursor-pointer">
        {children}
      </Label>
    </div>
  );
}

function sanitizeFileName(name: string): string {
  // Sanitização de filename: \x00-\x1F são caracteres de controle
  // inválidos em filesystems (Windows/Linux/macOS).
  // eslint-disable-next-line no-control-regex
  return name.replace(/[<>:"/\\|?*\x00-\x1F]/g, "_").trim();
}

function baseName(filePath: string): string {
  const parts = filePath.split(/[\\/]/);
  return parts[parts.length - 1] || filePath;
}
