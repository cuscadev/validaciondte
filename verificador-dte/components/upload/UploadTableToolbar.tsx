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
  exportDataTour?: string;
  filters?: {
    children: React.ReactNode;
    onClear?: () => void;
    activeCount?: number;
    dataTour?: string;
  };
  className?: string;
};

export default function UploadTableToolbar({
  resultCount,
  export: exportProps,
  exportDataTour,
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
        <div className="min-w-0 text-sm text-muted-foreground">
          <span className="hidden sm:inline">Resultados:</span>
          <span className="font-medium text-foreground">{resultCount.filtered}</span>
          {resultCount.total !== undefined && resultCount.filtered !== resultCount.total && (
            <span className="text-xs">(de {resultCount.total} totales)</span>
          )}
        </div>

        <div className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-2 sm:flex sm:items-center">
          <UploadTableExportBar {...exportProps} dataTour={exportDataTour} className="w-full sm:w-auto" />
          {filters && (
            <UploadTableFilterButton
              onClick={() => setFiltersOpen(true)}
              activeCount={filters.activeCount}
              dataTour={filters.dataTour}
              className="w-full sm:w-auto"
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
