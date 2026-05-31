'use client';

import UploadTableDownloadButton from '@/components/upload/UploadTableDownloadButton';
import { cn } from '@/lib/utils';

type ExportAction = {
  href?: string | null;
  download?: string;
  onClick?: () => void;
  label?: string;
};

type UploadTableExportBarProps = {
  excel?: ExportAction;
  csv: ExportAction;
  pdf: ExportAction;
  className?: string;
};

export default function UploadTableExportBar({
  excel,
  csv,
  pdf,
  className,
}: UploadTableExportBarProps) {
  const hasExcel = Boolean(excel?.href || excel?.onClick);

  if (!hasExcel && !csv.onClick && !pdf.onClick) return null;

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <span className="shrink-0 text-sm font-medium text-muted-foreground">
        Exportar a
      </span>
      {hasExcel && (
        <UploadTableDownloadButton
          variant="excel"
          href={excel?.href}
          download={excel?.download}
          onClick={excel?.onClick}
          label={excel?.label}
        />
      )}
      <UploadTableDownloadButton
        variant="csv"
        onClick={csv.onClick}
        label={csv.label}
      />
      <UploadTableDownloadButton
        variant="pdf"
        onClick={pdf.onClick}
        label={pdf.label}
      />
    </div>
  );
}
