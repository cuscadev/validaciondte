'use client';

import { FileDown, FileSpreadsheet, FileText } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type UploadTableDownloadButtonProps = {
  label?: string;
  href?: string | null;
  download?: string;
  onClick?: () => void;
  variant?: 'excel' | 'csv' | 'pdf';
  className?: string;
};

const excelButtonClasses =
  'h-9 shrink-0 gap-1.5 border-emerald-200/80 bg-emerald-50/80 px-3 text-sm font-semibold text-emerald-900 hover:bg-emerald-100/90 dark:border-emerald-400/25 dark:bg-emerald-950/40 dark:text-emerald-100 dark:hover:bg-emerald-950/60';

const csvButtonClasses =
  'h-9 shrink-0 gap-1.5 border-sky-200/80 bg-sky-50/80 px-3 text-sm font-semibold text-sky-900 hover:bg-sky-100/90 dark:border-sky-400/25 dark:bg-sky-950/40 dark:text-sky-100 dark:hover:bg-sky-950/60';

const pdfButtonClasses =
  'h-9 shrink-0 gap-1.5 border-red-200/80 bg-red-50/80 px-3 text-sm font-semibold text-red-900 hover:bg-red-100/90 dark:border-red-400/25 dark:bg-red-950/40 dark:text-red-100 dark:hover:bg-red-950/60';

const variantConfig = {
  excel: { name: 'Excel', Icon: FileSpreadsheet, classes: excelButtonClasses },
  csv: { name: 'CSV', Icon: FileDown, classes: csvButtonClasses },
  pdf: { name: 'PDF', Icon: FileText, classes: pdfButtonClasses },
} as const;

export default function UploadTableDownloadButton({
  label,
  href,
  download,
  onClick,
  variant = 'excel',
  className,
}: UploadTableDownloadButtonProps) {
  if (!href && !onClick) return null;

  const { name, Icon, classes } = variantConfig[variant];
  const ariaLabel = label ?? `Exportar a ${name}`;

  const content = (
    <>
      <Icon className="size-4 shrink-0" aria-hidden />
      {name}
    </>
  );

  if (href) {
    return (
      <Button variant="outline" className={cn(classes, className)} asChild>
        <a href={href} download={download} aria-label={ariaLabel}>
          {content}
        </a>
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      className={cn(classes, className)}
      onClick={onClick}
      aria-label={ariaLabel}
    >
      {content}
    </Button>
  );
}
