'use client';

import { useCallback } from 'react';
import { useDropzone, type Accept } from 'react-dropzone';
import { UploadCloud } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';

export type FileDropzoneProps = {
  accept?: Accept;
  multiple?: boolean;
  disabled?: boolean;
  files: File[];
  onFilesChange: (files: File[]) => void;
  label?: string;
  labelHint?: string;
  hint?: string;
  emptyText?: string;
  headerExtra?: React.ReactNode;
  labelActions?: React.ReactNode;
  sidePanel?: React.ReactNode;
  className?: string;
};

export default function FileDropzone({
  accept,
  multiple = true,
  disabled = false,
  files,
  onFilesChange,
  label,
  labelHint,
  hint,
  emptyText = 'Arrastra archivos aqui o haz clic para seleccionarlos',
  headerExtra,
  labelActions,
  sidePanel,
  className,
}: FileDropzoneProps) {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (!acceptedFiles.length) return;
      onFilesChange(multiple ? [...files, ...acceptedFiles] : acceptedFiles.slice(0, 1));
    },
    [files, multiple, onFilesChange]
  );

  const { getRootProps, getInputProps, isDragActive, isDragReject, open } = useDropzone({
    onDrop,
    accept,
    multiple,
    disabled,
    noClick: true,
    noKeyboard: false,
  });

  const isEmpty = files.length === 0;

  return (
    <div className={cn('space-y-2', className)}>
      {label || headerExtra || labelActions ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          {label || headerExtra ? (
            <Label className="inline-flex w-fit max-w-full items-center gap-1">
              {label}
              {headerExtra}
            </Label>
          ) : null}
          {labelActions}
        </div>
      ) : null}
      {labelHint ? (
        <p className="text-xs leading-snug text-muted-foreground">{labelHint}</p>
      ) : null}

      <div
        className={cn(
          sidePanel
            ? 'grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(11rem,14rem)] lg:items-stretch'
            : undefined
        )}
      >
        <div
          {...getRootProps()}
          onClick={disabled ? undefined : open}
          className={cn(
            'rounded-lg border-2 border-dashed p-6 text-center transition-colors cursor-pointer',
            'border-slate-300 bg-slate-50 hover:border-primary hover:bg-primary/10/50',
            'dark:border-white/15 dark:bg-black dark:hover:border-primary/60 dark:hover:bg-primary/5',
            isEmpty && !disabled && !isDragActive && 'dropzone-empty-pulse motion-reduce:animate-none',
            isDragActive && !isDragReject && 'border-primary bg-primary/10 dark:bg-primary/10',
            isDragReject && 'border-red-400 bg-red-50 dark:bg-red-950/20',
            disabled && 'pointer-events-none opacity-50 cursor-not-allowed',
            sidePanel && 'h-full min-h-[9.5rem]'
          )}
        >
          <input {...getInputProps()} />
          <UploadCloud className="mx-auto mb-3 size-8 text-primary" />
          <p className="text-sm font-medium text-slate-900 dark:text-white">{emptyText}</p>
          {hint ? (
            <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
          ) : null}
        </div>

        {sidePanel ? (
          <aside className="hidden min-w-0 lg:flex">{sidePanel}</aside>
        ) : null}
      </div>

      {sidePanel ? <div className="lg:hidden">{sidePanel}</div> : null}
    </div>
  );
}
