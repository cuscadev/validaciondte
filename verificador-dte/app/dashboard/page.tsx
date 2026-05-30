'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { QRCodeCanvas } from 'qrcode.react';
import {
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  Download,
  FileJson,
  FileSearch,
  FileText,
  Link2,
  ShieldCheck,
  ShieldPlus,
  Sparkles,
  UserRound,
} from 'lucide-react';

import { useAuth } from '@/components/AuthProvider';
import { useOrganizationMe } from '@/hooks/useOrganizationMe';
import { isNaturalOrganization } from '@/lib/org-display';
import { Progress } from '@/components/ui/progress';

const mobileAppDownloadUrl =
  'https://firebasestorage.googleapis.com/v0/b/kaydte-48e8a.firebasestorage.app/o/apk%2Fapplication-0af9fda5-d65b-4692-98b3-4edc93a63a9a.apk?alt=media';
  
const dteShortcuts = [
  {
    title: 'Verificador Links',
    description: 'Procesa enlaces DTE y genera resultados consolidados.',
    href: '/verificadorDTE/verificador',
    icon: Link2,
    accent: 'bg-yellow-400 text-black',
  },
  {
    title: 'Codigo y Fecha',
    description: 'Consulta por codigo de generacion y fecha de emision.',
    href: '/verificadorDTE/verificarodyfecha',
    icon: CalendarDays,
    accent: 'bg-blue-600 text-white',
  },
  {
    title: 'Verificador JSON',
    description: 'Carga archivos JSON de DTE para validarlos por lote.',
    href: '/verificadorDTE/verificadorjson',
    icon: FileJson,
    accent: 'bg-emerald-500 text-white',
  },
  {
    title: 'Verificacion Individual',
    description: 'Valida DTEs manualmente con detalle por documento.',
    href: '/verificadorDTE/verificacion_individual',
    icon: FileSearch,
    accent: 'bg-zinc-900 text-white dark:bg-white dark:text-black',
  },
];

type OrgKyc = {
  kycCompleted?: boolean;
  personType?: string | null;
  fullLegalName?: string;
  allowedEmailDomain?: string;
};

export default function DashboardPage() {
  const { firebaseUser, appUser } = useAuth();
  const { data: orgMeData } = useOrganizationMe({
    enabled: Boolean(appUser && appUser.role !== 'superadmin'),
  });

  const org = orgMeData?.organization;
  const isNaturalOrg = org ? isNaturalOrganization(org) : false;

  const orgKyc: OrgKyc | null = useMemo(() => {
    if (!org) return null;
    return {
      kycCompleted: org.kyc?.kycCompleted,
      personType: org.kyc?.personType,
      fullLegalName: org.kyc?.fullLegalName,
      allowedEmailDomain: org.allowedEmailDomain,
    };
  }, [org]);

  const displayName =
    appUser?.displayName ||
    appUser?.cliente ||
    firebaseUser?.displayName ||
    firebaseUser?.email?.split('@')[0] ||
    'Usuario';

  const membership = appUser?.membership?.type ?? 'free';

  const totpEnabled = Boolean(appUser?.totpEnabled);
  const isCliente = appUser?.role === 'cliente';
  const fiscalKycComplete = Boolean(orgKyc?.kycCompleted);
  const showClienteFiscalCard = isCliente && fiscalKycComplete;

  const kycItems = showClienteFiscalCard
    ? [
        { label: 'Foto de perfil', done: Boolean(appUser?.photoURL || firebaseUser?.photoURL) },
        { label: 'Teléfono', done: Boolean(appUser?.phoneNumber) },
        { label: '2FA activo', done: totpEnabled },
      ]
    : isCliente
      ? []
      : [
          { label: 'Foto de perfil', done: Boolean(appUser?.photoURL || firebaseUser?.photoURL) },
          { label: 'Email', done: Boolean(appUser?.email || firebaseUser?.email) },
          { label: 'Nombre completo', done: Boolean(appUser?.displayName || firebaseUser?.displayName) },
          { label: 'Teléfono', done: Boolean(appUser?.phoneNumber) },
          { label: '2FA activo', done: totpEnabled },
        ];
  const completedKycItems = kycItems.filter((item) => item.done).length;
  const kycProgress =
    kycItems.length > 0
      ? Math.round((completedKycItems / kycItems.length) * 100)
      : 100;

  return (
    <main className="min-h-[calc(100vh-5rem)] bg-slate-50 text-slate-950 dark:bg-black dark:text-white">
      <div className="flex w-full max-w-[92rem] flex-col gap-4 p-0">
        <section className="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-zinc-950">
          <div className="grid gap-4 p-5 lg:grid-cols-[1fr_auto]">
            <div>
              <p className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.24em] text-amber-600 dark:text-yellow-300">
                <Sparkles className="size-4" />
                Panel principal
              </p>

              <h1 className="text-3xl font-extrabold tracking-tight md:text-5xl">
                Hola, {displayName}
              </h1>

              <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-600 md:text-base dark:text-zinc-300">
                Accede rapido a tus herramientas DTE, refuerza la seguridad de
                tu cuenta y revisa tus accesos desde un solo lugar.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[30rem]">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 shadow-sm dark:border-white/10 dark:bg-black">
                <UserRound className="mb-3 size-5 text-amber-600 dark:text-yellow-300" />

                <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-zinc-500">
                  Rol
                </p>

                <p className="mt-1 text-sm font-bold capitalize">
                  {appUser?.role ?? 'usuario'}
                </p>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 shadow-sm dark:border-white/10 dark:bg-black">
                <BadgeCheck className="mb-3 size-5 text-amber-600 dark:text-yellow-300" />

                <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-zinc-500">
                  Plan
                </p>

                <p className="mt-1 text-sm font-bold capitalize">
                  {membership}
                </p>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 shadow-sm dark:border-white/10 dark:bg-black">
                <ShieldCheck className="mb-3 size-5 text-amber-600 dark:text-yellow-300" />

                <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-zinc-500">
                  TOTP
                </p>

                <p className="mt-1 text-sm font-bold">
                  {totpEnabled ? 'Activo' : 'Pendiente'}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
          {(showClienteFiscalCard || !isCliente) && (
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-zinc-950">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-amber-600 dark:text-yellow-300">
                  {showClienteFiscalCard ? 'Cuenta' : 'Estado de cuenta'}
                </p>
                <h2 className="mt-2 text-2xl font-bold">
                  {showClienteFiscalCard
                    ? 'Registro fiscal completo'
                    : `Perfil : ${kycProgress}% completado`}
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 dark:text-zinc-300">
                  {showClienteFiscalCard
                    ? isNaturalOrg
                      ? org?.kyc?.groupName?.trim()
                        ? `Grupo: ${org.kyc.groupName.trim()}. Puedes editarlo en Datos fiscales (KYC).`
                        : 'Tu KYC fiscal está al día. Define o edita el nombre del grupo en Datos fiscales (KYC) si delegarás tareas.'
                      : 'Tu KYC fiscal está al día. Puedes actualizar foto, teléfono y seguridad desde tu perfil.'
                    : 'Completa tus datos para mantener tu cuenta lista para uso operativo, control de accesos y seguridad.'}
                </p>
              </div>

              {!showClienteFiscalCard && (
              <div className="flex min-w-24 items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 dark:border-white/10 dark:bg-black">
                <UserRound className="size-5 text-amber-600 dark:text-yellow-300" />
                <span className="text-2xl font-extrabold">{kycProgress}%</span>
              </div>
              )}
            </div>

            {!showClienteFiscalCard && (
              <Progress value={kycProgress} className="mt-5 h-2.5 bg-slate-200 dark:bg-white/10" />
            )}

            <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {kycItems.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-white/10 dark:bg-black"
                >
                  <span className="text-sm font-medium text-slate-700 dark:text-zinc-200">
                    {item.label}
                  </span>
                  <CheckCircle2
                    className={`size-4 shrink-0 ${
                      item.done
                        ? 'text-emerald-500'
                        : 'text-slate-300 dark:text-zinc-700'
                    }`}
                  />
                </div>
              ))}
            </div>

            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              {showClienteFiscalCard && (
                <Link
                  href="/organizacion/kyc"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-sm font-bold text-amber-900 transition hover:bg-amber-500/20 dark:text-amber-100 sm:w-auto"
                >
                  Datos fiscales (KYC)
                  <ArrowRight className="size-4" />
                </Link>
              )}
              <Link
                href={showClienteFiscalCard ? '/profile' : '/profile'}
                className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-yellow-400 px-4 py-2.5 text-sm font-bold text-black transition hover:bg-yellow-300 sm:w-auto"
              >
                {showClienteFiscalCard ? 'Ir a perfil' : 'Completar perfil'}
                <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>
          )}

          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-zinc-950">
            <div className="flex size-12 items-center justify-center rounded-md bg-yellow-400 text-black">
              <ShieldPlus className="size-6" />
            </div>

            <h2 className="mt-5 text-2xl font-bold">
              {totpEnabled
                ? 'Tu cuenta esta protegida'
                : 'Activa TOTP'}
            </h2>

            <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-zinc-300">
              {totpEnabled
                ? 'Tienes verificacion en dos pasos activa. Puedes revisar o desactivar la configuracion desde tu perfil.'
                : 'Agrega un segundo factor de seguridad para proteger el acceso a tus validaciones y reportes.'}
            </p>

            <Link
              href="/profile"
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-md bg-yellow-400 px-4 py-2.5 text-sm font-bold text-black transition hover:bg-yellow-300"
            >
              {totpEnabled
                ? 'Gestionar seguridad'
                : 'Activar TOTP'}

              <ArrowRight className="size-4" />
            </Link>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-zinc-950">
            <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-amber-600 dark:text-yellow-300">
                  Atajos DTE
                </p>

                <h2 className="mt-2 text-2xl font-bold">
                  Procesa diferentes tipos de documentos
                </h2>
              </div>

              <FileText className="hidden size-9 text-slate-300 sm:block dark:text-zinc-700" />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {dteShortcuts.map((item) => {
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="group rounded-lg border border-slate-200 bg-slate-50 p-5 transition hover:-translate-y-0.5 hover:border-amber-300 hover:bg-white hover:shadow-md dark:border-white/10 dark:bg-black dark:hover:border-yellow-300/50 dark:hover:bg-zinc-900"
                  >
                    <div
                      className={`mb-4 flex size-11 items-center justify-center rounded-md ${item.accent}`}
                    >
                      <Icon className="size-5" />
                    </div>

                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="font-bold">{item.title}</h3>

                        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-zinc-400">
                          {item.description}
                        </p>
                      </div>

                      <ArrowRight className="mt-1 size-4 shrink-0 text-slate-400 transition group-hover:translate-x-1 group-hover:text-amber-600 dark:group-hover:text-yellow-300" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>

          <aside className="flex flex-col gap-4">
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-zinc-950">
              <div className="flex size-12 items-center justify-center rounded-md bg-yellow-400 text-black">
                <Download className="size-6" />
              </div>

              <h2 className="mt-5 text-2xl font-bold">
                Descarga la app
              </h2>

              <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-zinc-300">
                Escanea este codigo QR para descargar KaiserQRmobile en Android.
              </p>

              <div className="mt-5 flex justify-center rounded-xl bg-white p-4">
                <QRCodeCanvas
                  value={mobileAppDownloadUrl}
                  size={200}
                  bgColor="#ffffff"
                  fgColor="#000000"
                  level="H"
                  includeMargin
                />
              </div>

              <a
                href={mobileAppDownloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-md bg-yellow-400 px-4 py-2.5 text-sm font-bold text-black transition hover:bg-yellow-300"
              >
                Descargar APK
                <ArrowRight className="size-4" />
              </a>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
