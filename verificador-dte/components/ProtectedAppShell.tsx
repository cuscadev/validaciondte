'use client'

import dynamic from 'next/dynamic'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import AppBreadcrumb from '@/components/navigation/AppBreadcrumb'
import { Menu, PanelLeftClose } from 'lucide-react'
import { BrandLoader } from '@/components/ui/brand-loader'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { signOut } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { useOrganizationMe } from '@/hooks/useOrganizationMe'
import { Button } from '@/components/ui/button'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthProvider, useAuth } from '@/components/AuthProvider'
import { ThemeProvider } from '@/components/ThemeProvider'
import { isAccountUsable } from '@/lib/firestoreUser'
import {
  clientNeedsSetup,
  userNeedsOnboardingPath,
  type OrgKycSnapshot,
} from '@/lib/onboarding-gate'

const Sidebar = dynamic(() => import('@/components/Sidebar'), { ssr: false })
const Navbar = dynamic(() => import('@/components/Navbar'), { ssr: false })
export default function ProtectedAppShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ProtectedAppShellContent>{children}</ProtectedAppShellContent>
    </AuthProvider>
  )
}

function OnboardingOnlyLayout({ children }: { children: React.ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>
}

function ProtectedAppShellContent({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [orgGate, setOrgGate] = useState<'loading' | 'ok' | 'onboarding' | 'blocked'>('loading')
  const router = useRouter()
  const pathname = usePathname()
  const pathnameRef = useRef(pathname)
  pathnameRef.current = pathname
  const { t } = useTranslation()
  const { authChecked, isAuthenticated, appUser } = useAuth()

  const isSuperadmin = appUser?.role === 'superadmin'
  const needsOrgQuery =
    authChecked &&
    isAuthenticated &&
    appUser?.role === 'cliente' &&
    appUser.onboardingCompleted === true &&
    !appUser.mustChangePassword &&
    isAccountUsable(appUser)

  const {
    data: orgMeData,
    isLoading: orgMeLoading,
    isError: orgMeError,
  } = useOrganizationMe({ enabled: needsOrgQuery })

  const orgSnapshot: OrgKycSnapshot = useMemo(
    () => orgMeData?.organization ?? null,
    [orgMeData?.organization]
  )

  const orgKycCompleted = orgSnapshot?.kyc?.kycCompleted
  const orgStatus = orgSnapshot?.status

  const pendingOnboarding =
    !isSuperadmin &&
    userNeedsOnboardingPath(appUser, orgSnapshot)

  useEffect(() => {
    if (!authChecked) return
    if (!isAuthenticated) {
      router.replace('/login')
      return
    }

    if (!isAccountUsable(appUser)) {
      setOrgGate('blocked')
      return
    }

    if (appUser?.role === 'superadmin') {
      setOrgGate('ok')
      return
    }

    if (appUser?.role !== 'cliente') {
      setOrgGate('ok')
      return
    }

    if (appUser.onboardingCompleted !== true || appUser.mustChangePassword) {
      setOrgGate('onboarding')
      if (pathnameRef.current !== '/onboarding') {
        router.replace('/onboarding')
      }
      return
    }

    if (orgMeLoading && !orgSnapshot) {
      setOrgGate((prev) => (prev === 'ok' ? 'ok' : 'loading'))
      return
    }

    if (orgMeError || !orgSnapshot) {
      setOrgGate('onboarding')
      if (pathnameRef.current !== '/onboarding') {
        router.replace('/onboarding')
      }
      return
    }

    if (orgSnapshot.status === 'suspended') {
      setOrgGate('blocked')
      return
    }

    const setup = clientNeedsSetup(appUser, orgSnapshot)
    if (setup) {
      setOrgGate('onboarding')
      if (pathnameRef.current !== '/onboarding') {
        router.replace('/onboarding')
      }
      return
    }

    setOrgGate('ok')
  }, [
    appUser,
    authChecked,
    isAuthenticated,
    needsOrgQuery,
    orgMeLoading,
    orgMeError,
    orgKycCompleted,
    orgStatus,
    orgSnapshot,
    router,
  ])

  const handleSessionExpiredRedirect = async () => {
    await signOut(auth).catch(() => {})
    router.replace('/login')
  }

  useEffect(() => {
    const saved = localStorage.getItem('sidebarOpen')
    if (saved !== null) setSidebarOpen(saved === 'true')
  }, [])

  useEffect(() => {
    localStorage.setItem('sidebarOpen', String(sidebarOpen))
  }, [sidebarOpen])

  useEffect(() => {
    setMobileSidebarOpen(false)
  }, [pathname])

  const toggleSidebar = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setMobileSidebarOpen((value) => !value)
      return
    }

    setSidebarOpen((value) => !value)
  }

  if (!authChecked) return null
  if (!isAuthenticated) return null

  if (orgGate === 'blocked' || (appUser && !isAccountUsable(appUser))) {
    return (
      <ThemeProvider>
        <div className="flex min-h-screen items-center justify-center p-6">
          <div className="max-w-md rounded-xl border p-8 text-center">
            <h2 className="text-xl font-bold">Cuenta no disponible</h2>
            <p className="mt-3 text-sm text-muted-foreground">
              Tu cuenta está inactiva o bloqueada. Contacta al administrador de tu organización.
            </p>
            <Button className="mt-6" onClick={handleSessionExpiredRedirect}>
              Cerrar sesión
            </Button>
          </div>
        </div>
      </ThemeProvider>
    )
  }

  function SetupSpinner() {
    return (
      <OnboardingOnlyLayout>
        <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-black">
          <BrandLoader size="lg" label="Verificando cuenta" />
        </div>
      </OnboardingOnlyLayout>
    )
  }

  if (pendingOnboarding && pathname !== '/onboarding') {
    return <SetupSpinner />
  }

  if (pathname === '/onboarding') {
    return <OnboardingOnlyLayout>{children}</OnboardingOnlyLayout>
  }

  return (
    <ThemeProvider>
      <TooltipProvider skipDelayDuration={300}>
      <div className="relative flex h-screen overflow-hidden">
        <aside
          className={[
            'hidden md:block fixed z-30 top-0 left-0 h-screen bg-black border-r border-white/10 shadow-lg',
            'transition-[width] duration-300 ease-in-out overflow-y-auto overflow-x-visible',
            sidebarOpen ? 'w-64' : 'w-16',
          ].join(' ')}
        >
          <Sidebar collapsed={!sidebarOpen} />
        </aside>

        <aside
          className={[
            'md:hidden fixed z-40 top-0 left-0 h-screen w-64 bg-black border-r border-white/10 shadow-lg',
            'transition-transform duration-300 ease-in-out',
            mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full',
          ].join(' ')}
          aria-hidden={!mobileSidebarOpen}
        >
          <Sidebar onNavigate={() => setMobileSidebarOpen(false)} />
        </aside>

        {mobileSidebarOpen && (
          <div
            className="md:hidden fixed inset-0 z-30 bg-black/40"
            onClick={() => setMobileSidebarOpen(false)}
            aria-hidden
          />
        )}

        <main
          className={[
            'relative flex-1 h-screen overflow-y-auto overflow-x-hidden [scrollbar-gutter:stable]',
            'transition-[margin] duration-300 ease-in-out',
            sidebarOpen ? 'md:ml-64' : 'md:ml-16',
          ].join(' ')}
        >
          <div className="sticky top-0 z-20 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
            <div className="flex items-center gap-2 px-3 py-2">
              <button
                type="button"
                onClick={() => setMobileSidebarOpen((value) => !value)}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border text-sm hover:bg-muted md:hidden"
                aria-label={mobileSidebarOpen ? t('hideMenu') : t('showMenu')}
                title={mobileSidebarOpen ? t('hideMenu') : t('showMenu')}
              >
                {mobileSidebarOpen ? (
                  <PanelLeftClose className="w-4 h-4" />
                ) : (
                  <Menu className="w-4 h-4" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setSidebarOpen((value) => !value)}
                className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-md border text-sm hover:bg-muted md:inline-flex"
                aria-label={sidebarOpen ? t('hideMenu') : t('showMenu')}
                title={sidebarOpen ? t('hideMenu') : t('showMenu')}
              >
                {sidebarOpen ? (
                  <PanelLeftClose className="w-4 h-4" />
                ) : (
                  <Menu className="w-4 h-4" />
                )}
              </button>
              <AppBreadcrumb />
              <div className="ml-auto flex shrink-0 items-center gap-2">
                <LanguageSwitcher />
                <Navbar onToggleSidebar={toggleSidebar} />
              </div>
            </div>
          </div>

          <div className="p-4">{children}</div>
        </main>
      </div>
      </TooltipProvider>
    </ThemeProvider>
  )
}
