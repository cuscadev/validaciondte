'use client';

import { Search } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type UploadTableBasicFiltersProps = {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  rowsPerPage?: number;
  onRowsPerPageChange?: (value: number) => void;
  rowsPerPageId?: string;
  showRowsPerPage?: boolean;
};

export default function UploadTableBasicFilters({
  search,
  onSearchChange,
  searchPlaceholder = 'Buscar…',
  rowsPerPage,
  onRowsPerPageChange,
  rowsPerPageId = 'upload-table-rpp',
  showRowsPerPage = true,
}: UploadTableBasicFiltersProps) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="upload-table-search">Buscar</Label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="upload-table-search"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={searchPlaceholder}
            className="pl-9"
          />
        </div>
      </div>

      {showRowsPerPage && rowsPerPage !== undefined && onRowsPerPageChange && (
        <div className="space-y-2">
          <Label htmlFor={rowsPerPageId}>Filas por página</Label>
          <select
            id={rowsPerPageId}
            value={rowsPerPage}
            onChange={(event) => onRowsPerPageChange(Number(event.target.value))}
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
          >
            {[10, 20, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      )}
    </>
  );
}

export function countBasicFilters(search: string, rowsPerPage?: number, defaultRows = 10) {
  let count = 0;
  if (search.trim()) count += 1;
  if (rowsPerPage !== undefined && rowsPerPage !== defaultRows) count += 1;
  return count;
}
