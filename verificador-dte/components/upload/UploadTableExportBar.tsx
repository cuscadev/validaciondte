'use client';

import { Download, FileDown, FileSpreadsheet, FileText } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

type ExportAction = {
  href?: string | null;
  download?: string;
  onClick?: () => void;
  label?: string;
};

export type UploadTableExportBarProps = {
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

  function handleExcel() {
    if (excel?.onClick) {
      excel.onClick();
      return;
    }
    if (excel?.href) {
      const anchor = document.createElement('a');
      anchor.href = excel.href;
      if (excel.download) anchor.download = excel.download;
      anchor.click();
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn('h-9 shrink-0 gap-1.5 px-3', className)}
          aria-label="Exportar a"
          title="Exportar a"
        >
          <Download className="size-4 shrink-0" aria-hidden />
          <span>Exportar a</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[10rem]">
        {hasExcel && (
          <DropdownMenuItem onClick={handleExcel}>
            <FileSpreadsheet className="size-4 text-emerald-600" aria-hidden />
            {excel?.label ?? 'EXCEL'}
          </DropdownMenuItem>
        )}
        {csv.onClick && (
          <DropdownMenuItem onClick={csv.onClick}>
            <FileDown className="size-4 text-sky-600" aria-hidden />
            {csv.label ?? 'CSV'}
          </DropdownMenuItem>
        )}
        {pdf.onClick && (
          <DropdownMenuItem onClick={pdf.onClick}>
            <FileText className="size-4 text-red-600" aria-hidden />
            {pdf.label ?? 'PDF'}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
