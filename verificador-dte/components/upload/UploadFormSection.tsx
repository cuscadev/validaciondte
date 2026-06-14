'use client';

import { useEffect, type ReactNode } from 'react';
import type { Accept } from 'react-dropzone';
import { FileUp } from 'lucide-react';

import FileDropzone from '@/components/upload/FileDropzone';
import HelpTooltip from '@/components/upload/HelpTooltip';
import { useUploadFormAccordion } from '@/components/upload/UploadFormAccordion';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type UploadFormSectionProps = {
  label: string;
  helpContent: ReactNode;
  helpTooltip?: ReactNode;
  briefHint?: string;
  files: File[];
  onFilesChange: (files: File[]) => void;
  accept?: Accept;
  multiple?: boolean;
  disabled?: boolean;
  emptyText?: string;
  beforeDropzone?: ReactNode;
  labelActions?: ReactNode;
  sidePanel?: ReactNode;
  children?: ReactNode;
  loading?: boolean;
  /** Si true, el acordeon muestra el panel de procesamiento (no colapsa la zona de carga). */
  syncAccordionProcessing?: boolean;
  submitLabel?: string;
  loadingLabel?: string;
  submitClassName?: string;
  className?: string;
};

export default function UploadFormSection({
  label,
  helpContent,
  helpTooltip,
  briefHint,
  files,
  onFilesChange,
  accept,
  multiple = true,
  disabled = false,
  emptyText,
  beforeDropzone,
  labelActions,
  sidePanel,
  children,
  loading = false,
  syncAccordionProcessing = true,
  submitLabel = 'Procesar',
  loadingLabel = 'Procesando…',
  submitClassName = 'w-full bg-primary font-bold text-black hover:bg-primary/90 sm:w-auto',
  className,
}: UploadFormSectionProps) {
  const accordion = useUploadFormAccordion();
  const isDisabled = disabled || loading;

  useEffect(() => {
    if (!syncAccordionProcessing) return;
    accordion?.setProcessing(loading);
    return () => accordion?.setProcessing(false);
  }, [loading, accordion, syncAccordionProcessing]);

  return (
    <div className={cn('space-y-3', className)}>
      {beforeDropzone}

      <FileDropzone
        files={files}
        onFilesChange={onFilesChange}
        accept={accept}
        multiple={multiple}
        disabled={isDisabled}
        label={label}
        labelHint={briefHint}
        emptyText={emptyText}
        headerExtra={
          helpTooltip ?? (helpContent ? <HelpTooltip content={helpContent} side="top" /> : null)
        }
        labelActions={labelActions}
        sidePanel={sidePanel}
      />

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Button type="submit" disabled={isDisabled} className={submitClassName}>
          {loading ? (
            loadingLabel
          ) : (
            <>
              <FileUp className="mr-2 size-4" />
              {submitLabel}
            </>
          )}
        </Button>
        {files.length > 0 && (
          <>
            <span className="text-sm font-medium text-muted-foreground">
              {files.length} archivo{files.length === 1 ? '' : 's'} cargado
              {files.length === 1 ? '' : 's'}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9 shrink-0"
              onClick={() => onFilesChange([])}
              disabled={isDisabled}
            >
              Quitar todos
            </Button>
          </>
        )}
        {children}
      </div>
    </div>
  );
}
