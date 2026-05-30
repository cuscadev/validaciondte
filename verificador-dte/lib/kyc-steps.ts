import type { PersonType } from '@/lib/organization-types';

export type KycStepId = 'tipo' | 'fiscal' | 'resumen';

export type KycStepDef = { id: KycStepId; label: string };

export function buildKycSteps(personType: PersonType | null): KycStepDef[] {
  const steps: KycStepDef[] = [
    { id: 'tipo', label: 'Tipo' },
  ];
  steps.push(
    { id: 'fiscal', label: 'Fiscal' },
    { id: 'resumen', label: 'Resumen' }
  );
  return steps;
}
