'use client';

import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';

type UploadTableFiltersModalProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  onClear?: () => void;
};

export default function UploadTableFiltersModal({
  open,
  onClose,
  title = 'Filtros',
  children,
  onClear,
}: UploadTableFiltersModalProps) {
  return (
    <Modal open={open} onClose={onClose} className="w-full max-w-lg">
      <div className="space-y-4 pr-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{title}</h2>
          {onClear && (
            <Button type="button" variant="outline" size="sm" onClick={onClear}>
              Limpiar
            </Button>
          )}
        </div>

        <div className="space-y-4">{children}</div>

        <div className="flex justify-end pt-2">
          <Button type="button" onClick={onClose}>
            Aplicar
          </Button>
        </div>
      </div>
    </Modal>
  );
}
