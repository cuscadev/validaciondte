'use client';

import { useState } from 'react';

import UploadTableExportBar, {
  type UploadTableExportBarProps,
} from '@/components/upload/UploadTableExportBar';
import UploadTableFilterButton from '@/components/upload/UploadTableFilterButton';
import UploadTableFiltersModal from '@/components/upload/UploadTableFiltersModal';
import { cn } from '@/lib/utils';

type UploadTableToolbarProps = {
  resultCount: { filtered: number; total?: number };
  export: UploadTableExportBarProps;
  filters?: {
    children: React.ReactNode;
    onClear?: () => void;
    activeCount?: number;
  };
  className?: string;
};

export default function UploadTableToolbar({
  resultCount,
  export: exportProps,
  filters,
  className,
}: UploadTableToolbarProps) {
  const [filtersOpen, setFiltersOpen] = useState(false);

  return (
    <>
      <div
        className={cn(
          'flex flex-col gap-3 md:flex-row md:items-center md:justify-between',
          className
        )}
      >
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="hidden sm:inline">Resultados:</span>
          <span className="font-medium text-foreground">{resultCount.filtered}</span>
          {resultCount.total !== undefined && resultCount.filtered !== resultCount.total && (
            <span className="text-xs">(de {resultCount.total} totales)</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <UploadTableExportBar {...exportProps} />
          {filters && (
            <UploadTableFilterButton
              onClick={() => setFiltersOpen(true)}
              activeCount={filters.activeCount}
            />
          )}
        </div>
      </div>

      {filters && (
        <UploadTableFiltersModal
          open={filtersOpen}
          onClose={() => setFiltersOpen(false)}
          onClear={filters.onClear}
        >
          {filters.children}
        </UploadTableFiltersModal>
      )}
    </>
  );
}
