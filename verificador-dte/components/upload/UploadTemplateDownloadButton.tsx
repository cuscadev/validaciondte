'use client';

import { Download } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type UploadTemplateDownloadButtonProps = {
  href: string;
  download?: string;
  className?: string;
};

const templateButtonClasses =
  'h-8 shrink-0 gap-1.5 border-emerald-200/80 bg-emerald-50/80 px-3 text-sm font-semibold text-emerald-900 hover:bg-emerald-100/90 dark:border-emerald-400/25 dark:bg-emerald-950/40 dark:text-emerald-100 dark:hover:bg-emerald-950/60';

export default function UploadTemplateDownloadButton({
  href,
  download,
  className,
}: UploadTemplateDownloadButtonProps) {
  return (
    <Button variant="outline" size="sm" className={cn(templateButtonClasses, className)} asChild>
      <a href={href} download={download} aria-label="Descargar plantilla">
        <Download className="size-3.5 shrink-0" aria-hidden />
        Descargar plantilla
      </a>
    </Button>
  );
}
