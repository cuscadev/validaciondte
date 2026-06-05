'use client'

import { usePathname } from 'next/navigation'
import { ThemeProvider } from '@/components/ThemeProvider'
import I18nProvider from '@/components/I18nProvider'
import ProtectedAppShell from '@/components/ProtectedAppShell'
import QueryProvider from '@/components/QueryProvider'
import { ViewTransitionShell } from '@/components/ViewTransitionShell'
import { isPublicPath } from '@/lib/publicRoutes'
import { Toaster } from 'sonner'
import { NetworkStatusToast } from '@/components/NetworkStatusToast'

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isPublicRoute = isPublicPath(pathname)

  return (
    <QueryProvider>
      <I18nProvider>
        <Toaster position="top-center" richColors closeButton />
        <NetworkStatusToast />
        {isPublicRoute ? (
          <ThemeProvider>{children}</ThemeProvider>
        ) : (
          <ProtectedAppShell>
            <ViewTransitionShell>{children}</ViewTransitionShell>
          </ProtectedAppShell>
        )}
      </I18nProvider>
    </QueryProvider>
  )
}
