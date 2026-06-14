'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { Check, ChevronDown, CircleHelp, Languages, LogOut, Moon, Settings, Sun, User, UserRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { useAuth } from '@/components/AuthProvider';
import { useProductTour } from '@/components/tours/ProductTourProvider';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { auth } from '@/lib/firebase';
import type { SupportedLanguage } from '@/lib/i18n';

const mobileLanguageOptions: Array<{ value: SupportedLanguage; labelKey: string }> = [
  { value: 'es', labelKey: 'common.spanish' },
  { value: 'en', labelKey: 'common.english' },
];

type UserAvatarMenuProps = {
  darkMode?: boolean;
  onToggleTheme?: () => void;
};

export default function UserAvatarMenu({
  darkMode = false,
  onToggleTheme,
}: UserAvatarMenuProps) {
  const { i18n, t } = useTranslation();
  const router = useRouter();
  const { firebaseUser, appUser } = useAuth();
  const productTour = useProductTour();

  const email = appUser?.email ?? firebaseUser?.email ?? null;
  const photoURL = appUser?.photoURL ?? firebaseUser?.photoURL ?? null;
  const displayName =
    appUser?.displayName ||
    appUser?.company ||
    firebaseUser?.displayName ||
    email?.split('@')[0] ||
    'Usuario';

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/login');
  };

  const changeLanguage = (language: SupportedLanguage) => {
    if (i18n.language !== language) {
      void i18n.changeLanguage(language);
      window.localStorage.setItem('language', language);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          data-tour="user-menu-trigger"
          aria-label={`${t('common.account', 'Cuenta')}: ${displayName}`}
          className="ml-1 flex max-w-[min(100%,12rem)] items-center gap-2 rounded-full border border-primary/30 bg-primary/5 py-1 pl-1 pr-1.5 transition-colors hover:border-primary/45 hover:bg-primary/10 sm:ml-4 sm:max-w-none sm:pr-3"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-primary/25 bg-primary/10">
            {photoURL ? (
              <Image
                src={photoURL}
                alt={displayName}
                width={40}
                height={40}
                className="h-full w-full object-cover"
              />
            ) : (
              <User className="h-5 w-5 text-primary" />
            )}
          </span>
          <span className="hidden min-w-0 truncate text-sm font-medium text-foreground sm:block">
            {displayName}
          </span>
          <ChevronDown className="size-4 shrink-0 text-primary/70" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[calc(100vw-1rem)] max-w-72 sm:w-56">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate text-sm font-semibold">{displayName}</p>
          {email && (
            <p className="truncate text-xs text-muted-foreground">{email}</p>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => router.push('/profile')}
          className="cursor-pointer"
        >
          <UserRound className="mr-2 size-4" />
          {t('common.profile', 'Perfil')}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => router.push('/configuraciones')}
          className="cursor-pointer"
        >
          <Settings className="mr-2 size-4" />
          {t('sidebar.configuracion', 'Configuración')}
        </DropdownMenuItem>
        <div className="sm:hidden">
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={onToggleTheme}
            disabled={!onToggleTheme}
            className="cursor-pointer"
          >
            {darkMode ? (
              <Sun className="mr-2 size-4" />
            ) : (
              <Moon className="mr-2 size-4" />
            )}
            {darkMode ? 'Modo claro' : 'Modo oscuro'}
          </DropdownMenuItem>
          <DropdownMenuLabel className="px-2 pb-1 pt-2 text-xs font-medium text-muted-foreground">
            <span className="inline-flex items-center gap-2">
              <Languages className="size-3.5" />
              {t('common.language', 'Idioma')}
            </span>
          </DropdownMenuLabel>
          <div className="grid grid-cols-2 gap-1 px-1 pb-1">
            {mobileLanguageOptions.map((option) => {
              const active =
                i18n.resolvedLanguage === option.value || i18n.language === option.value;

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => changeLanguage(option.value)}
                  className={[
                    'flex items-center justify-center gap-1 rounded-sm px-2 py-2 text-sm font-medium transition-colors',
                    active
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-accent hover:text-accent-foreground',
                  ].join(' ')}
                  aria-pressed={active}
                >
                  {option.value.toUpperCase()}
                  {active && <Check className="size-3.5" />}
                </button>
              );
            })}
          </div>
        </div>
        {productTour?.currentTour ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={productTour.restartCurrentTour}
              className="cursor-pointer"
            >
              <CircleHelp className="mr-2 size-4" />
              Ver guía de ayuda
            </DropdownMenuItem>
          </>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleLogout}
          variant="destructive"
          className="cursor-pointer"
        >
          <LogOut className="mr-2 size-4" />
          {t('common.logout', 'Cerrar sesión')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
