import * as React from "react";
import { ChevronsLeft, ChevronsRight, ChevronLeft, ChevronRight, Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface UserTablePaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function UserTablePagination({ page, totalPages, onPageChange }: UserTablePaginationProps) {
  return (
    <div className="mt-3 flex flex-col items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2 text-sm text-muted-foreground shadow-sm sm:flex-row">
      <span>
        Pagina <span className="font-semibold text-foreground">{page}</span> de {totalPages}
      </span>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => onPageChange(1)} disabled={page === 1}>
          <ChevronsLeft className="size-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={() => onPageChange(page - 1)} disabled={page === 1}>
          <ChevronLeft className="size-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={() => onPageChange(page + 1)} disabled={page === totalPages}>
          <ChevronRight className="size-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={() => onPageChange(totalPages)} disabled={page === totalPages}>
          <ChevronsRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}

interface UserTableSearchProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

export function UserTableSearch({ value, onChange, placeholder }: UserTableSearchProps) {
  return (
    <div className="relative w-full md:max-w-md">
      <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
      <Input
        className="h-10 pl-9"
        placeholder={placeholder ?? 'Buscar por email, nombre, rol o membresia...'}
        value={value}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  );
}
