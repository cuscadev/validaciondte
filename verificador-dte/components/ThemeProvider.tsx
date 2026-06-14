'use client'

import { ThemeProvider as NextThemesProvider } from 'next-themes'
import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'

function useMountedThemeScope(isDarkWhenResolved: boolean) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return mounted ? isDarkWhenResolved : false
}

export function ThemeProvider({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem>
      {children}
    </NextThemesProvider>
  )
}

export function PublicThemeProvider({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      storageKey="public-theme"
    >
      {children}
    </NextThemesProvider>
  )
}

export function PublicThemeScope({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  const { resolvedTheme } = useTheme()
  const isDark = useMountedThemeScope(resolvedTheme === 'dark')

  return (
    <div
      suppressHydrationWarning
      className={cn('private-app min-h-full w-full', isDark && 'dark', className)}
    >
      {children}
    </div>
  )
}

export function PrivateThemeProvider({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      storageKey="private-theme"
    >
      {children}
    </NextThemesProvider>
  )
}

export function PrivateThemeScope({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  const { resolvedTheme } = useTheme()
  const isDark = useMountedThemeScope(resolvedTheme === 'dark')

  useEffect(() => {
    document.documentElement.classList.remove('dark')
  }, [resolvedTheme])

  return (
    <div
      suppressHydrationWarning
      className={cn('private-app min-h-full w-full', isDark && 'dark', className)}
    >
      {children}
    </div>
  )
}
