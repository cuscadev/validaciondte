'use client';

import { Label } from '@/components/ui/label';
import FechaEmiInput from '@/components/dte/FechaEmiInput';
import { isoToDmy, dmyToIso } from '@/lib/dte-fecha-input';

type Props = {
  label: string;
  isoValue: string;
  onIsoChange: (iso: string) => void;
  disabled?: boolean;
  id?: string;
};

export default function EmailSyncDateField({
  label,
  isoValue,
  onIsoChange,
  disabled,
  id,
}: Props) {
  const dmyValue = isoToDmy(isoValue);

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <fieldset disabled={disabled} className="m-0 min-w-0 border-0 p-0">
        <FechaEmiInput
          value={dmyValue}
          onChange={(dmy) => {
            const iso = dmyToIso(dmy);
            if (iso) onIsoChange(iso);
          }}
        />
      </fieldset>
    </div>
  );
}
