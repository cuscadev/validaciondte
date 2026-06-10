'use client';

import { OnboardingProgress } from '@/components/onboarding/OnboardingProgress';

export type EmailWizardStepId =
  | 'connect'
  | 'search'
  | 'extract'
  | 'confirm'
  | 'select'
  | 'results';

export const EMAIL_WIZARD_STEPS: Array<{ id: EmailWizardStepId; label: string }> = [
  { id: 'connect', label: 'Conexión' },
  { id: 'search', label: 'Buscar' },
  { id: 'extract', label: 'Extracción (Go)' },
  { id: 'confirm', label: 'Confirmar' },
  { id: 'select', label: 'Seleccionar' },
  { id: 'results', label: 'Resultados' },
];

type Props = {
  activeStep: EmailWizardStepId;
};

export default function EmailWizardProgress({ activeStep }: Props) {
  const activeIndex = EMAIL_WIZARD_STEPS.findIndex((s) => s.id === activeStep);
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Paso {activeIndex + 1} de {EMAIL_WIZARD_STEPS.length}:{' '}
        {EMAIL_WIZARD_STEPS[activeIndex]?.label}
      </p>
      <OnboardingProgress
        segments={EMAIL_WIZARD_STEPS.map((s) => ({ kind: s.id, label: s.label }))}
        activeIndex={Math.max(0, activeIndex)}
      />
    </div>
  );
}
