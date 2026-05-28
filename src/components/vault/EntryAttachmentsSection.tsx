import { Download, File, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";

interface EntryAttachmentView {
  name: string;
  sizeBytes: number | null;
}

interface EntryAttachmentsSectionProps {
  attachments: EntryAttachmentView[];
  inRecycleBin: boolean;
  attachmentAction: string | null;
  onAdd: () => void;
  onExport: (attachmentName: string) => void;
  onRemove: (attachmentName: string) => void;
}

export function EntryAttachmentsSection({
  attachments,
  inRecycleBin,
  attachmentAction,
  onAdd,
  onExport,
  onRemove,
}: EntryAttachmentsSectionProps) {
  return (
    <div className="rounded-md border border-border bg-bg-secondary px-3 py-2.5">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <File className="size-4" />
          <span className="font-medium">Anexos</span>
          {attachments.length > 0 && (
            <span className="text-[11px] text-muted-foreground/80">
              {attachments.length}
            </span>
          )}
        </div>
        {!inRecycleBin && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onAdd}
            disabled={attachmentAction !== null}
            title="Adicionar anexo"
          >
            <Plus />
            Anexar
          </Button>
        )}
      </div>

      {attachments.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhum anexo nesta entrada.
        </p>
      ) : (
        <ul className="space-y-1">
          {attachments.map((attachment) => {
            const exportKey = `export:${attachment.name}`;
            const removeKey = `remove:${attachment.name}`;
            return (
              <li
                key={attachment.name}
                className="flex items-center gap-2 rounded-md border border-border/70 bg-background px-2 py-1.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {attachment.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatAttachmentSize(attachment.sizeBytes)}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => onExport(attachment.name)}
                  disabled={attachmentAction !== null}
                  title="Salvar anexo como..."
                  aria-label={`Salvar anexo ${attachment.name} como`}
                >
                  <Download />
                </Button>
                {!inRecycleBin && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => onRemove(attachment.name)}
                    disabled={attachmentAction !== null}
                    title="Remover anexo"
                    aria-label={`Remover anexo ${attachment.name}`}
                    className="text-destructive hover:text-destructive"
                  >
                    {attachmentAction === removeKey ? (
                      <Trash2 className="opacity-50" />
                    ) : (
                      <Trash2 />
                    )}
                  </Button>
                )}
                {attachmentAction === exportKey && (
                  <span className="sr-only">Salvando anexo</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function formatAttachmentSize(sizeBytes: number | null): string {
  if (sizeBytes === null) return "Tamanho desconhecido";
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}
