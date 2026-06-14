'use client';

import LanguageSwitcher from '@/components/LanguageSwitcher';
import Image from 'next/image';
import Link from 'next/link';
import { Menu, Moon, Sun, X } from 'lucide-react';
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
    <nav className="fixed left-0 top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex min-h-16 w-full max-w-7xl items-center justify-between gap-3 px-3 py-3 sm:px-4">
        <Link
          href="/"
          onClick={closeMenu}
          className="inline-flex h-10 shrink-0 items-center gap-2 rounded-md border border-border bg-card/80 px-3 text-sm font-semibold text-foreground transition hover:bg-accent"
        >
          <Image
            src="/TemaDarkLogo.png"
            alt="Kaiser DTE"
            width={96}
            height={32}
            className="h-7 w-auto object-contain"
            priority
          />
          <span className="hidden sm:inline">Kaiser DTE</span>
        </Link>

        <div className="hidden items-center gap-2 md:flex">
          <Link href="/politica-privacidad" className="rounded-md px-3 py-2 text-sm font-medium text-foreground transition hover:bg-accent">Privacidad</Link>
          <Link href="/terminos-condiciones" className="rounded-md px-3 py-2 text-sm font-medium text-foreground transition hover:bg-accent">Terminos</Link>
          <LanguageSwitcher />
          <button
            type="button"
            onClick={toggleTheme}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-card/80 text-foreground transition hover:bg-accent"
            aria-label={isDark ? t('common.lightTheme', 'Cambiar a tema claro') : t('common.darkTheme', 'Cambiar a tema oscuro')}
          >
            {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </button>
          <Link href="/login" className="rounded-md px-3 py-2 text-sm font-medium text-foreground transition hover:bg-accent">{t('login')}</Link>
          <Link href="/signup" className="rounded-md bg-primary px-3 py-2 text-sm font-bold text-primary-foreground transition hover:bg-primary/90">{t('registerSubmit')}</Link>
        </div>

        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border bg-card/80 text-foreground transition hover:bg-accent md:hidden"
          aria-label={menuOpen ? 'Cerrar menu' : 'Abrir menu'}
          aria-expanded={menuOpen}
        >
          {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {menuOpen && (
        <div className="border-t border-border bg-background/95 px-3 py-3 shadow-lg md:hidden">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-3">
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted px-3 py-2">
              <LanguageSwitcher />
              <button
                type="button"
                onClick={toggleTheme}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-card text-foreground transition hover:bg-accent"
                aria-label={isDark ? t('common.lightTheme', 'Cambiar a tema claro') : t('common.darkTheme', 'Cambiar a tema oscuro')}
              >
                {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
              </button>
            </div>

            <Link
              href="/politica-privacidad"
              onClick={closeMenu}
              className="rounded-lg border border-border bg-card px-3 py-3 text-sm font-semibold text-foreground transition hover:bg-accent"
            >
              Politica de privacidad
            </Link>
            <Link
              href="/terminos-condiciones"
              onClick={closeMenu}
              className="rounded-lg border border-border bg-card px-3 py-3 text-sm font-semibold text-foreground transition hover:bg-accent"
            >
              Terminos y condiciones
            </Link>
            <Link
              href="/login"
              onClick={closeMenu}
              className="rounded-lg border border-border bg-card px-3 py-3 text-sm font-semibold text-foreground transition hover:bg-accent"
            >
              {t('login')}
            </Link>
            <Link
              href="/signup"
              onClick={closeMenu}
              className="rounded-lg bg-primary px-3 py-3 text-sm font-bold text-primary-foreground transition hover:bg-primary/90"
            >
              {t('registerSubmit')}
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
