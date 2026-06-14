'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { BrandLoader } from '@/components/ui/brand-loader';
import { runViewTransition } from '@/lib/view-transition';

import { useAuth } from '@/components/AuthProvider';
import { ChangePasswordStep } from '@/components/onboarding/ChangePasswordStep';
import { OnboardingProgress } from '@/components/onboarding/OnboardingProgress';
import { OnboardingShell } from '@/components/onboarding/OnboardingShell';
import { OnboardingStepTransition } from '@/components/onboarding/OnboardingStepTransition';
import { FadeIn } from '@/components/motion/FadeIn';
import { auth } from '@/lib/firebase';
import { useOrganizationMe } from '@/hooks/useOrganizationMe';
import { buildKycSteps, type KycStepId } from '@/lib/kyc-steps';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import type { PersonType } from '@/lib/organization-types';
import { EmitterSettingsForm, type EmitterForm } from '@/components/profile/EmitterSettingsForm';

type WizardStep =
  | { kind: 'password'; label: 'Seguridad' }
  | { kind: 'kyc'; label: string; kycStepId: KycStepId };

function onlyDigits(value: string) {
  return value.replace(/\D/g, '');
}

function formatDui(value: string) {
  const digits = onlyDigits(value).slice(0, 9);
  if (digits.length <= 8) return digits;
  return `${digits.slice(0, 8)}-${digits.slice(8)}`;
}

function formatNit(value: string) {
  const digits = onlyDigits(value).slice(0, 14);
  const parts = [
    digits.slice(0, 4),
    digits.slice(4, 10),
    digits.slice(10, 13),
    digits.slice(13, 14),
  ].filter(Boolean);
  return parts.join('-');
}

export default function OnboardingPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { appUser, authChecked, refreshAppUser } = useAuth();

  const [pageLoading, setPageLoading] = useState(true);
  const [passwordDone, setPasswordDone] = useState(false);
  const [step, setStep] = useState(0);
  const [submitLoading, setSubmitLoading] = useState(false);

  const [fullLegalName, setFullLegalName] = useState(appUser?.displayName || appUser?.email || '');
  const [personType, setPersonType] = useState<PersonType | null>(null);
  const [hasHomologatedDui, setHasHomologatedDui] = useState<boolean | null>(null);
  const [dui, setDui] = useState('');
  const [nit, setNit] = useState('');
  const [nrc, setNrc] = useState('');
  const [fiscalAddress, setFiscalAddress] = useState('');
  const [companyLegalName, setCompanyLegalName] = useState('');
  const [companyNit, setCompanyNit] = useState('');
  const [companyNrc, setCompanyNrc] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [emitterSaved, setEmitterSaved] = useState(false);

  const isCliente = appUser?.role === 'cliente';
  const isColaborador = appUser?.role === 'colaborador';

  const kycSteps = useMemo(() => buildKycSteps(personType), [personType]);

  const wizardSteps = useMemo((): WizardStep[] => {
    const steps: WizardStep[] = [];
    if (isCliente && appUser?.mustChangePassword && !passwordDone) {
      steps.push({ kind: 'password', label: 'Seguridad' });
    }
    if (isCliente) {
      kycSteps.forEach((s) => {
        steps.push({ kind: 'kyc', label: s.label, kycStepId: s.id });
      });
    }
    return steps;
  }, [appUser?.mustChangePassword, passwordDone, isCliente, kycSteps]);

  const { data: orgMeData, isLoading: orgMeLoading } = useOrganizationMe({
    enabled: authChecked && isCliente,
  });

  const org = orgMeData?.organization;

  const emitterDefaults = useMemo<Partial<EmitterForm>>(() => {
    const fiscalNit =
      personType === 'juridica'
        ? companyNit
        : hasHomologatedDui
          ? formatDui(dui)
          : nit;
    const fiscalNrc = personType === 'juridica' ? companyNrc : nrc;
    const legalName =
      personType === 'juridica'
        ? companyLegalName || fullLegalName
        : fullLegalName;

    return {
      nit: fiscalNit,
      nrc: fiscalNrc,
      nombre: legalName,
      nombreComercial: legalName,
      razonSocial: legalName,
      complementoDireccion: fiscalAddress,
      correo: appUser?.email || '',
      ambienteCodigo: '00',
    };
  }, [
    appUser?.email,
    companyLegalName,
    companyNit,
    companyNrc,
    dui,
    fiscalAddress,
    fullLegalName,
    hasHomologatedDui,
    nit,
    nrc,
    personType,
  ]);

  useEffect(() => {
    setEmitterSaved(false);
  }, [emitterDefaults]);

  useEffect(() => {
    if (step >= wizardSteps.length && wizardSteps.length > 0) {
      setStep(wizardSteps.length - 1);
    }
  }, [wizardSteps.length, step]);

  useEffect(() => {
    if (!authChecked) return;

    if (!appUser) {
      router.replace('/login');
      return;
    }

    if (appUser.role === 'superadmin') {
      router.replace('/dashboard');
      return;
    }

    if (!isCliente) {
      router.replace('/dashboard');
      return;
    }

    if (isCliente && !appUser.mustChangePassword) {
      if (org?.kyc?.kycCompleted && appUser.onboardingCompleted === true) {
        router.replace('/dashboard');
        return;
      }
    }

    if (!isCliente || !orgMeLoading) {
      if (org?.kyc?.fullLegalName) setFullLegalName(org.kyc.fullLegalName);
      else if (appUser?.displayName) setFullLegalName(appUser.displayName);
      else if (org?.name) setFullLegalName(org.name);
      else if (appUser?.email) setFullLegalName(appUser.email);
      if (org?.kyc?.personType) setPersonType(org.kyc.personType);
      if (org?.kyc?.hasHomologatedDui !== undefined) setHasHomologatedDui(org.kyc.hasHomologatedDui);
      if (org?.kyc?.dui) setDui(org.kyc.dui);
      if (org?.kyc?.nit) setNit(org.kyc.nit);
      if (org?.kyc?.nrc) setNrc(org.kyc.nrc);
      if (org?.kyc?.fiscalAddress) setFiscalAddress(org.kyc.fiscalAddress);
      if (org?.kyc?.companyLegalName) setCompanyLegalName(org.kyc.companyLegalName);
      if (org?.kyc?.companyNit) setCompanyNit(org.kyc.companyNit);
      if (org?.kyc?.companyNrc || org?.kyc?.companyNcr) setCompanyNrc(org.kyc.companyNrc || org.kyc.companyNcr || '');
      if (org?.kyc?.termsAccepted) setTermsAccepted(true);
      if (org?.kyc?.privacyAccepted) setPrivacyAccepted(true);
      setPageLoading(false);
    }
  }, [authChecked, appUser, isCliente, org, orgMeLoading, router]);

  const current = wizardSteps[step];

  function updateHomologatedDui(value: string) {
    const formatted = formatDui(value);
    setDui(formatted);
    if (hasHomologatedDui === true) {
      setNit(formatted);
    }
  }

  function updateHasHomologatedDui(value: boolean) {
    setHasHomologatedDui(value);
    if (value) {
      setNit(formatDui(dui));
    } else {
      setNit('');
    }
  }

  async function submitKyc() {
    setSubmitLoading(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('Sesión expirada');

      const res = await fetch('/api/organization/onboarding', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          fullLegalName: fullLegalName || appUser?.displayName || appUser?.email || '',
          personType,
          hasHomologatedDui,
          dui,
          nit: hasHomologatedDui ? formatDui(dui) : nit,
          nrc,
          fiscalAddress,
          companyLegalName,
          companyNit,
          companyNrc,
          termsAccepted,
          privacyAccepted,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al guardar');

      if (appUser?.uid) {
        queryClient.setQueryData(['users', appUser.uid], (old: typeof appUser | undefined) =>
          old ? { ...old, onboardingCompleted: true, mustChangePassword: false } : old
        );
        await queryClient.invalidateQueries({ queryKey: ['users', appUser.uid] });
      }
      await queryClient.invalidateQueries({ queryKey: ['organization', 'me'] });
      await refreshAppUser();

      toast.success('Registro completado. Ya puedes usar la plataforma.');
      router.replace('/dashboard');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error');
    } finally {
      setSubmitLoading(false);
    }
  }

  function handlePasswordSuccess() {
    setPasswordDone(true);
    if (appUser?.uid) {
      queryClient.setQueryData(['users', appUser.uid], (old: typeof appUser | undefined) =>
        old ? { ...old, mustChangePassword: false } : old
      );
    }
    if (isColaborador) {
      toast.success('Contraseña actualizada.');
      router.replace('/dashboard');
      return;
    }
    runViewTransition(() => setStep(0));
  }

  function nextKyc() {
    if (!current || current.kind !== 'kyc') return;
    const { kycStepId } = current;

    if (kycStepId === 'tipo' && !personType) {
      toast.error('Selecciona tipo de persona');
      return;
    }
    if (kycStepId === 'fiscal' && personType === 'natural') {
      if (hasHomologatedDui === null) {
        toast.error('Indica si tienes DUI homologado');
        return;
      }
      if (hasHomologatedDui && onlyDigits(dui).length !== 9) {
        toast.error('Ingresa un DUI valido de 9 digitos');
        return;
      }
      if (!hasHomologatedDui && onlyDigits(nit).length !== 14) {
        toast.error('Ingresa un NIT valido de 14 digitos');
        return;
      }
      if (!nrc.trim()) {
        toast.error('Ingresa tu NRC');
        return;
      }
      if (!fiscalAddress.trim()) {
        toast.error('Ingresa tu direccion fiscal');
        return;
      }
    }
    if (kycStepId === 'fiscal' && personType === 'juridica') {
      if (!companyLegalName.trim() || onlyDigits(companyNit).length !== 14 || !companyNrc.trim() || !fiscalAddress.trim()) {
        toast.error('Completa nombre, NIT, NRC y direccion de la empresa');
        return;
      }
    }
    if (kycStepId === 'emisor' && !emitterSaved) {
      toast.error('Guarda los datos del emisor antes de continuar');
      return;
    }
    runViewTransition(() => {
      setStep((s) => Math.min(s + 1, wizardSteps.length - 1));
    });
  }

  function finishKyc() {
    if (!termsAccepted) {
      toast.error('Debes aceptar los términos y condiciones');
      return;
    }
    if (!privacyAccepted) {
      toast.error('Debes aceptar la política de privacidad');
      return;
    }
    void submitKyc();
  }

  function goToStep(next: number) {
    runViewTransition(() => setStep(next));
  }

  if (!authChecked || pageLoading || wizardSteps.length === 0) {
    return (
      <OnboardingShell showLogo={false} showFooter={false}>
        <BrandLoader size="lg" label="Cargando registro" />
      </OnboardingShell>
    );
  }

  const title =
    current?.kind === 'password'
      ? 'Configura tu contraseña'
      : 'Conoce a tu cliente';

  const subtitle =
    current?.kind === 'password'
      ? 'Paso obligatorio antes de continuar con el registro de tu organización.'
      : 'Completa estos datos para facturación y para invitar usuarios de tu empresa.';

  const isLastStep = step === wizardSteps.length - 1;
  const showBack = step > 0 && current?.kind !== 'password';

  const stepKey =
    current?.kind === 'kyc'
      ? `kyc-${current.kycStepId}-${step}`
      : current?.kind === 'password'
        ? `password-${step}`
        : `step-${step}`;

  const kycStepId = current?.kind === 'kyc' ? current.kycStepId : null;

  return (
    <OnboardingShell>
      <FadeIn className="w-full max-w-xl">
        <div
          className="w-full rounded-xl border border-border bg-card p-6 shadow-lg sm:p-8 dark:shadow-none"
          style={{ viewTransitionName: 'onboarding-wizard' }}
        >
          <div className="text-center sm:text-left">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary text-primary">
              Registro {step + 1} de {wizardSteps.length}
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight">{title}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
          </div>

          <OnboardingProgress
            segments={wizardSteps.map((s) => ({ kind: s.kind, label: s.label }))}
            activeIndex={step}
          />

          <OnboardingStepTransition stepKey={stepKey} className="mt-8">
            <div className="space-y-4 text-left">
          {current?.kind === 'password' && appUser && (
            <ChangePasswordStep
              uid={appUser.uid}
              mustClearFlag={Boolean(appUser.mustChangePassword)}
              onSuccess={handlePasswordSuccess}
            />
          )}

          {kycStepId === 'tipo' && (
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setPersonType('natural')}
                className={`rounded-lg border p-4 text-left ${personType === 'natural' ? 'border-primary bg-primary/10' : 'border-border'}`}
              >
                <p className="font-semibold">Persona natural</p>
                <p className="mt-1 text-xs text-muted-foreground">Contribuyente individual</p>
              </button>
              <button
                type="button"
                onClick={() => setPersonType('juridica')}
                className={`rounded-lg border p-4 text-left ${personType === 'juridica' ? 'border-primary bg-primary/10' : 'border-border'}`}
              >
                <p className="font-semibold">Persona jurídica</p>
                <p className="mt-1 text-xs text-muted-foreground">Empresa u organización</p>
              </button>
            </div>
          )}

          {kycStepId === 'fiscal' && personType === 'natural' && (
            <div className="space-y-4">
              <p className="text-sm font-medium">¿Cuentas con DUI homologado? (equivale a NIT)</p>
              <div className="flex gap-3">
                <Button type="button" variant={hasHomologatedDui === true ? 'default' : 'outline'} onClick={() => updateHasHomologatedDui(true)}>Sí</Button>
                <Button type="button" variant={hasHomologatedDui === false ? 'default' : 'outline'} onClick={() => updateHasHomologatedDui(false)}>No</Button>
              </div>
              <div>
                <Label htmlFor="dui">DUI</Label>
                <Input
                  id="dui"
                  value={dui}
                  onChange={(e) => updateHomologatedDui(e.target.value)}
                  placeholder="00000000-0"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="nit">NIT</Label>
                <Input
                  id="nit"
                  value={nit}
                  onChange={(e) => setNit(formatNit(e.target.value))}
                  placeholder={hasHomologatedDui ? 'Se completa con el DUI' : '0000-000000-000-0'}
                  disabled={hasHomologatedDui === true}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="nrc">NRC</Label>
                <Input
                  id="nrc"
                  value={nrc}
                  onChange={(e) => setNrc(e.target.value)}
                  placeholder="000000-0"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="fiscalAddress">Dirección</Label>
                <Input
                  id="fiscalAddress"
                  value={fiscalAddress}
                  onChange={(e) => setFiscalAddress(e.target.value)}
                  placeholder="Departamento, municipio, colonia, calle y número"
                  className="mt-1"
                />
              </div>
            </div>
          )}

          {kycStepId === 'fiscal' && personType === 'juridica' && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="companyLegalName">Nombre de la empresa</Label>
                <Input
                  id="companyLegalName"
                  value={companyLegalName}
                  onChange={(e) => setCompanyLegalName(e.target.value)}
                  placeholder="Ej. Mi Empresa S.A. de C.V."
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="companyNit">NIT</Label>
                <Input
                  id="companyNit"
                  value={companyNit}
                  onChange={(e) => setCompanyNit(formatNit(e.target.value))}
                  placeholder="0000-000000-000-0"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="companyNrc">NRC</Label>
                <Input
                  id="companyNrc"
                  value={companyNrc}
                  onChange={(e) => setCompanyNrc(e.target.value)}
                  placeholder="000000-0"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="companyFiscalAddress">Dirección</Label>
                <Input
                  id="companyFiscalAddress"
                  value={fiscalAddress}
                  onChange={(e) => setFiscalAddress(e.target.value)}
                  placeholder="Departamento, municipio, colonia, calle y número"
                  className="mt-1"
                />
              </div>
            </div>
          )}

          {kycStepId === 'resumen' && (
            <div className="space-y-2 text-sm">
              <p><strong>Nombre:</strong> {fullLegalName}</p>
              <p><strong>Tipo:</strong> {personType === 'natural' ? 'Natural' : 'Jurídica'}</p>
              {personType === 'natural' && (
                <>
                  <p><strong>Identificación:</strong> {hasHomologatedDui ? `DUI ${dui}` : `NIT ${nit}`}</p>
                  {hasHomologatedDui && <p><strong>NIT:</strong> {nit}</p>}
                  <p><strong>NRC:</strong> {nrc}</p>
                  <p><strong>Dirección:</strong> {fiscalAddress}</p>
                </>
              )}
              {personType === 'juridica' && (
                <>
                  <p><strong>Empresa:</strong> {companyLegalName}</p>
                  <p><strong>NIT / NRC:</strong> {companyNit} / {companyNrc}</p>
                  <p><strong>Dirección:</strong> {fiscalAddress}</p>
                </>
              )}
              <label className="mt-4 flex items-start gap-3 rounded-lg border border-border p-3 text-sm">
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="mt-1 size-4"
                />
                <span>Acepto los terminos y condiciones de uso de la plataforma.</span>
              </label>
              <label className="flex items-start gap-3 rounded-lg border border-border p-3 text-sm">
                <input
                  type="checkbox"
                  checked={privacyAccepted}
                  onChange={(e) => setPrivacyAccepted(e.target.checked)}
                  className="mt-1 size-4"
                />
                <span>Acepto la politica de privacidad y el tratamiento de datos para completar el KYC.</span>
              </label>
            </div>
          )}

          {kycStepId === 'emisor' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Configura el emisor que se usara para facturacion electronica y consultas fiscales.
              </p>
              <EmitterSettingsForm
                defaultValues={emitterDefaults}
                saveLabel="Guardar emisor"
                onSaved={() => setEmitterSaved(true)}
              />
            </div>
          )}
            </div>
          </OnboardingStepTransition>

        {current?.kind === 'kyc' && (
          <div className="mt-8 flex justify-between gap-3">
            <Button type="button" variant="outline" disabled={!showBack || submitLoading} onClick={() => goToStep(step - 1)}>
              Atrás
            </Button>
            {!isLastStep ? (
              <Button type="button" className="bg-primary font-bold text-black hover:bg-primary/90" onClick={nextKyc}>
                Siguiente
              </Button>
            ) : (
              <Button
                type="button"
                className="bg-primary font-bold text-black hover:bg-primary/90"
                disabled={submitLoading}
                onClick={finishKyc}
              >
                {submitLoading ? (
                  <>
                    <BrandLoader size="sm" />
                    Guardando...
                  </>
                ) : (
                  'Finalizar'
                )}
              </Button>
            )}
          </div>
        )}
        </div>
      </FadeIn>
    </OnboardingShell>
  );
}
