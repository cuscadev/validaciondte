'use client';



import { useMemo } from 'react';

import { AlertCircle } from 'lucide-react';



import { useAuth } from '@/components/AuthProvider';

import { ActivityPeriodChart } from '@/components/dashboard/ActivityPeriodChart';

import { DashboardActionsBento } from '@/components/dashboard/DashboardActionsBento';

import { DashboardHero } from '@/components/dashboard/DashboardHero';

import { DashboardUsersRow } from '@/components/dashboard/DashboardUsersRow';

import { ModuleBreakdown } from '@/components/dashboard/ModuleBreakdown';

import { useDashboardStats } from '@/hooks/useDashboardStats';

import { useOrganizationMe } from '@/hooks/useOrganizationMe';

import { canManageOrgUsers } from '@/lib/firestoreUser';



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

  const {

    data: stats,

    isPending,

    isError,

    error,

    isRefetching,

    refetch,

  } = useDashboardStats();



  const showStatsSkeleton = isPending && !stats;



  const org = orgMeData?.organization;

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



  const photoURL = appUser?.photoURL || firebaseUser?.photoURL || null;

  const membership = appUser?.membership?.type ?? 'free';

  const totpEnabled = Boolean(appUser?.totpEnabled);

  const isCliente = appUser?.role === 'cliente';

  const fiscalKycComplete = Boolean(orgKyc?.kycCompleted);

  const showClienteFiscalCard = isCliente && fiscalKycComplete;



  const kycItems = showClienteFiscalCard

    ? [

        { label: 'Foto de perfil', done: Boolean(photoURL) },

        { label: 'Telefono', done: Boolean(appUser?.phoneNumber) },

        { label: '2FA activo', done: totpEnabled },

      ]

    : isCliente

      ? []

      : [

          { label: 'Foto de perfil', done: Boolean(photoURL) },

          { label: 'Email', done: Boolean(appUser?.email || firebaseUser?.email) },

          {

            label: 'Nombre completo',

            done: Boolean(appUser?.displayName || firebaseUser?.displayName),

          },

          { label: 'Telefono', done: Boolean(appUser?.phoneNumber) },

          { label: '2FA activo', done: totpEnabled },

        ];



  const completedKycItems = kycItems.filter((item) => item.done).length;

  const kycProgress =

    kycItems.length > 0

      ? Math.round((completedKycItems / kycItems.length) * 100)

      : 100;



  const daily = stats?.daily ?? [];

  const weekly = stats?.weekly ?? [];

  const monthly = stats?.monthly ?? [];

  const byModule = stats?.byModule ?? [];

  const recent = stats?.recent ?? [];

  const showUserStats = canManageOrgUsers(appUser) || appUser?.role === 'superadmin';

  const userManageHref =
    appUser?.role === 'superadmin' ? '/admin/users' : '/usuarios';



  return (

    <main className="min-h-[calc(100vh-5rem)] bg-slate-50 text-slate-950 dark:bg-black dark:text-white">

      <div className="flex w-full max-w-none flex-col gap-4 p-0">

        {isError && (

          <div className="flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100">

            <AlertCircle className="mt-0.5 size-4 shrink-0" />

            <div>

              <p className="font-semibold">No se pudieron cargar las metricas</p>

              <p className="mt-1 text-amber-900/80 dark:text-amber-100/80">

                {error instanceof Error

                  ? error.message

                  : 'Intenta actualizar de nuevo en unos segundos.'}

              </p>

            </div>

          </div>

        )}



        <section className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_minmax(15rem,17rem)] 2xl:grid-rows-[auto_auto] 2xl:items-stretch">

          <ActivityPeriodChart

            daily={daily}

            weekly={weekly}

            monthly={monthly}

            byModule={byModule}

            loading={showStatsSkeleton}

            onRefresh={() => refetch()}

            isRefetching={isRefetching}

            className="order-1 h-full min-h-[18rem] 2xl:order-none 2xl:col-start-1 2xl:row-start-1 2xl:min-h-[20rem]"

          />



          <DashboardHero

            displayName={displayName}

            photoURL={photoURL}

            role={appUser?.role}

            membership={membership}

            variant="sidebar"

            chartsLoading={showStatsSkeleton}

            profileCompletion={
              kycItems.length > 0 ? { progress: kycProgress } : undefined
            }

            stats={{

              records: stats?.totals?.records,

              processes: stats?.totals?.processes,

              errorRate: stats?.errorRates?.monthly.errorRate,

              mobileScans: stats?.mobile?.totalScans,

              mobilePending: stats?.mobile?.pendingBatches,

              loading: showStatsSkeleton,

            }}

            className="order-3 min-h-[20rem] 2xl:order-none 2xl:col-start-2 2xl:row-start-1 2xl:row-span-2 2xl:min-h-0"

          />



          <ModuleBreakdown

            byModule={byModule}

            loading={showStatsSkeleton}

            className="order-2 2xl:order-none 2xl:col-start-1 2xl:row-start-2"

          />

        </section>



        <DashboardUsersRow

          users={stats?.users}

          showSkeleton={showStatsSkeleton && showUserStats}

          manageHref={userManageHref}

        />



        <DashboardActionsBento
          recent={recent}
          totpEnabled={totpEnabled}
          loading={showStatsSkeleton}
        />

      </div>

    </main>

  );

}


