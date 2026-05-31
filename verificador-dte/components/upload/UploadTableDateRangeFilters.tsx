'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type UploadTableDateRangeFiltersProps = {
  filterFrom: string;
  filterTo: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  fromId?: string;
  toId?: string;
};

export default function UploadTableDateRangeFilters({
  filterFrom,
  filterTo,
  onFromChange,
  onToChange,
  fromId = 'upload-filter-from',
  toId = 'upload-filter-to',
}: UploadTableDateRangeFiltersProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor={fromId}>Desde</Label>
        <Input
          id={fromId}
          type="date"
          value={filterFrom}
          onChange={(event) => onFromChange(event.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={toId}>Hasta</Label>
        <Input
          id={toId}
          type="date"
          value={filterTo}
          onChange={(event) => onToChange(event.target.value)}
        />
      </div>
    </div>
  );
}

export function countDateRangeFilters(
  filterFrom: string,
  filterTo: string,
  defaultTo = new Date().toISOString().slice(0, 10)
) {
  let count = 0;
  if (filterFrom) count += 1;
  if (filterTo && filterTo !== defaultTo) count += 1;
  return count;
}

export function countTipoDteFilter(filterTipoDte: string) {
  return filterTipoDte ? 1 : 0;
}
