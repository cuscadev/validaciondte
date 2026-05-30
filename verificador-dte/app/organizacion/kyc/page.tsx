'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Building2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { useAuth } from '@/components/AuthProvider';
import { useOrganizationMe } from '@/hooks/useOrganizationMe';
import { buildOrganizationDisplay, isNaturalOrganization } from '@/lib/org-display';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

function formatPersonType(personType: string | null | undefined): string {
  if (personType === 'natural') return 'Persona natural';
  if (personType === 'juridica') return 'Persona juridica';
  return '-';
}

export default function OrganizationKycPage() {
  const router = useRouter();
  const { authChecked, appUser } = useAuth();
  const { data, isLoading, isError, error } = useOrganizationMe({
    enabled: authChecked && appUser?.role === 'cliente',
  });

  const org = data?.organization;
  const display = org ? buildOrganizationDisplay(org) : null;
  const isNatural = org ? isNaturalOrganization(org) : false;
  const kyc = org?.kyc;

  useEffect(() => {
    if (!authChecked) return;
    if (appUser?.role !== 'cliente') {
      router.replace('/dashboard');
    }
  }, [authChecked, appUser?.role, router]);

  useEffect(() => {
    if (isError && error) {
      toast.error(error instanceof Error ? error.message : 'Error al cargar');
    }
  }, [isError, error]);

  if (!authChecked || isLoading) {
    return (
      <main className="flex min-h-[calc(100vh-5rem)] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-amber-500" />
      </main>
    );
  }

  if (!org || !kyc) {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <p className="text-muted-foreground">No se encontraron datos fiscales de la organizacion.</p>
        <Button asChild variant="link" className="mt-4 px-0">
          <Link href="/dashboard">Volver al panel</Link>
        </Button>
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100vh-5rem)] bg-background px-0 py-2 text-foreground">
      <div className="mx-auto max-w-2xl space-y-4">
        <header className="rounded-2xl border border-border bg-card p-5 shadow-xl">
          <Button asChild variant="ghost" size="sm" className="mb-3 -ml-2">
            <Link href="/dashboard">
              <ArrowLeft className="mr-2 size-4" />
              Volver al panel
            </Link>
          </Button>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-600 dark:text-yellow-400">
            Conoce a tu cliente
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight">Datos fiscales (KYC)</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Revisa la informacion registrada en el onboarding.
          </p>
        </header>

        <Card className="rounded-2xl border border-border shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Building2 className="size-5 text-amber-600 dark:text-yellow-400" />
              {display?.displayTitle || org.name}
            </CardTitle>
            {display?.displaySubtitle && (
              <CardDescription>{display.displaySubtitle}</CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-6">
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div className="sm:col-span-2">
                <dt className="text-muted-foreground">Nombre legal</dt>
                <dd className="font-medium">{kyc.fullLegalName || '-'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Tipo</dt>
                <dd className="font-medium">{formatPersonType(display?.personType ?? kyc.personType)}</dd>
              </div>
              {isNatural && (
                <div>
                  <dt className="text-muted-foreground">Identificacion fiscal</dt>
                  <dd className="font-medium">
                    {kyc.hasHomologatedDui
                      ? `DUI ${kyc.dui || '-'}`
                      : `NIT ${kyc.nit || '-'}`}
                  </dd>
                </div>
              )}
              {isNatural && (
                <div>
                  <dt className="text-muted-foreground">NRC</dt>
                  <dd className="font-medium">{kyc.nrc || '-'}</dd>
                </div>
              )}
              {isNatural && kyc.hasHomologatedDui && (
                <div>
                  <dt className="text-muted-foreground">NIT</dt>
                  <dd className="font-medium">{kyc.nit || '-'}</dd>
                </div>
              )}
              <div className="sm:col-span-2">
                <dt className="text-muted-foreground">Direccion</dt>
                <dd className="font-medium">{kyc.fiscalAddress || '-'}</dd>
              </div>
              {kyc.personType === 'juridica' && (
                <>
                  <div className="sm:col-span-2">
                    <dt className="text-muted-foreground">Empresa</dt>
                    <dd className="font-medium">{kyc.companyLegalName || '-'}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">NIT / NRC</dt>
                    <dd className="font-medium">
                      {kyc.companyNit || '-'} / {kyc.companyNrc || kyc.companyNcr || '-'}
                    </dd>
                  </div>
                </>
              )}
            </dl>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
