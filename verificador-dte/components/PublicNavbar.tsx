'use client';

import LanguageSwitcher from '@/components/LanguageSwitcher';
import Link from 'next/link';
import { Home, Menu, Moon, Sun, X } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';

export default function PublicNavbar() {
  const { t } = useTranslation();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === 'dark';
  const toggleTheme = () => setTheme(isDark ? 'light' : 'dark');
  const closeMenu = () => setMenuOpen(false);

  return (
    <nav className="fixed left-0 top-0 z-50 w-full border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/70">
      <div className="mx-auto flex min-h-16 w-full max-w-7xl items-center justify-between gap-3 px-3 py-3 sm:px-4">
        <Link
          href="/"
          onClick={closeMenu}
          className="inline-flex h-10 shrink-0 items-center gap-2 rounded-md border border-zinc-200 bg-white/80 px-3 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-100 dark:hover:bg-zinc-800"
        >
          <Home className="size-4" />
          <span>Inicio</span>
        </Link>

        <div className="hidden items-center gap-2 md:flex">
          <LanguageSwitcher />
          <button
            type="button"
            onClick={toggleTheme}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-zinc-200 bg-white/80 text-zinc-800 transition hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-100 dark:hover:bg-zinc-800"
            aria-label={isDark ? t('common.lightTheme', 'Cambiar a tema claro') : t('common.darkTheme', 'Cambiar a tema oscuro')}
          >
            {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </button>
          <Link href="/login" className="rounded-md px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-800">{t('login')}</Link>
          <Link href="/signup" className="rounded-md bg-yellow-400 px-3 py-2 text-sm font-bold text-black transition hover:bg-yellow-300">{t('registerSubmit')}</Link>
        </div>

        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-zinc-200 bg-white/80 text-zinc-800 transition hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-100 dark:hover:bg-zinc-800 md:hidden"
          aria-label={menuOpen ? 'Cerrar menu' : 'Abrir menu'}
          aria-expanded={menuOpen}
        >
          {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {menuOpen && (
        <div className="border-t border-zinc-200 bg-white/95 px-3 py-3 shadow-lg dark:border-zinc-800 dark:bg-zinc-950/95 md:hidden">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-3">
            <div className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900">
              <LanguageSwitcher />
              <button
                type="button"
                onClick={toggleTheme}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-800 transition hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
                aria-label={isDark ? t('common.lightTheme', 'Cambiar a tema claro') : t('common.darkTheme', 'Cambiar a tema oscuro')}
              >
                {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
              </button>
            </div>

            <Link
              href="/login"
              onClick={closeMenu}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-3 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
            >
              {t('login')}
            </Link>
            <Link
              href="/signup"
              onClick={closeMenu}
              className="rounded-lg bg-yellow-400 px-3 py-3 text-sm font-bold text-black transition hover:bg-yellow-300"
            >
              {t('registerSubmit')}
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
