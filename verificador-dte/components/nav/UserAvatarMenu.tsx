'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { ChevronDown, LogOut, Settings, User, UserRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { useAuth } from '@/components/AuthProvider';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { auth } from '@/lib/firebase';

export default function UserAvatarMenu() {
  const { t } = useTranslation();
  const router = useRouter();
  const { firebaseUser, appUser } = useAuth();

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

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`${t('common.account', 'Cuenta')}: ${displayName}`}
          className="ml-4 flex max-w-[min(100%,12rem)] items-center gap-2 rounded-full border border-yellow-200 bg-yellow-50/40 py-1 pl-1 pr-2.5 transition-colors hover:border-yellow-300 hover:bg-yellow-50/70 dark:border-yellow-400/30 dark:bg-yellow-400/5 dark:hover:border-yellow-400/45 dark:hover:bg-yellow-400/10 sm:max-w-none sm:pr-3"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-yellow-200/80 bg-yellow-50 dark:border-yellow-400/25 dark:bg-zinc-800">
            {photoURL ? (
              <Image
                src={photoURL}
                alt={displayName}
                width={40}
                height={40}
                className="h-full w-full object-cover"
              />
            ) : (
              <User className="h-5 w-5 text-yellow-700 dark:text-yellow-300" />
            )}
          </span>
          <span className="min-w-0 truncate text-sm font-medium text-zinc-900 dark:text-yellow-50">
            {displayName}
          </span>
          <ChevronDown className="size-4 shrink-0 text-yellow-600/70 dark:text-yellow-400/70" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
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
