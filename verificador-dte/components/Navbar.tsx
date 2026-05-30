'use client';

import { Sun, Moon, User, Bell, CheckCheck } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useTranslation } from 'react-i18next';
import { signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { useRouter } from 'next/navigation';
import { useNotifications } from '@/hooks/useNotifications';
import { AppNotification } from '@/lib/notifications';
import Image from 'next/image';
import { useAuth } from '@/components/AuthProvider';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

function timeAgo(createdAt?: { seconds: number }) {
  if (!createdAt) return '';
  const diff = Math.floor(Date.now() / 1000) - createdAt.seconds;
  if (diff < 60) return 'ahora';
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
  return `hace ${Math.floor(diff / 86400)} d`;
}

export default function Navbar({ onToggleSidebar }: { onToggleSidebar: () => void }) {
  const { t } = useTranslation();
  const [darkMode, setDarkMode] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { notifications, unread, markRead, markAllRead } = useNotifications();
  const { firebaseUser, appUser } = useAuth();

  const userEmail = firebaseUser?.email ?? null;
  const userPhotoURL = appUser?.photoURL ?? null;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setBellOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const isDark = document.documentElement.classList.contains("dark");
    setDarkMode(isDark);
  }, []);

  const toggleTheme = () => {
    const next = !darkMode;
    setDarkMode(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/login');
  };

  const handleNotifClick = (notif: AppNotification) => {
    markRead(notif.id);
    if (notif.link) {
      setBellOpen(false);
      router.push(notif.link);
    }
  };

  return (
    <>
      <button
        onClick={toggleTheme}
        className="rounded-md p-2 text-sm bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700"
      >
        {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      </button>

      {/* Campana de notificaciones */}
      <div className="relative ml-3" ref={bellRef}>
        <button
          onClick={() => setBellOpen(o => !o)}
          className="relative rounded-full bg-zinc-200 dark:bg-zinc-800 p-2 flex items-center justify-center hover:bg-zinc-300 dark:hover:bg-zinc-700"
        >
          <Bell className="w-5 h-5 text-zinc-700 dark:text-zinc-200" />
          {unread.length > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
              {unread.length > 9 ? '9+' : unread.length}
            </span>
          )}
        </button>

        {bellOpen && (
          <div className="absolute right-0 mt-2 w-80 rounded-xl border bg-background shadow-xl z-50 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <span className="font-semibold text-sm">
                Notificaciones {unread.length > 0 && <span className="text-red-500">({unread.length})</span>}
              </span>
              {unread.length > 0 && (
                <button
                  onClick={markAllRead}
                  className="flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <CheckCheck className="w-3 h-3" />
                  Marcar todas leídas
                </button>
              )}
            </div>

            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                Sin notificaciones
              </div>
            ) : (
              <ul className="max-h-80 overflow-y-auto divide-y">
                {notifications.slice(0, 20).map(notif => {
                  const isUnread = unread.some(n => n.id === notif.id);
                  return (
                    <li key={notif.id}>
                      <button
                        className={`w-full text-left px-4 py-3 hover:bg-muted transition-colors flex gap-3 items-start ${isUnread ? 'bg-primary/5' : ''}`}
                        onClick={() => handleNotifClick(notif)}
                      >
                        <div className="flex-1 min-w-0">
                          <div className={`text-sm ${isUnread ? 'font-semibold' : 'font-medium'}`}>
                            {notif.title}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">{notif.body}</div>
                          <div className="text-[10px] text-muted-foreground mt-1">{timeAgo(notif.createdAt)}</div>
                        </div>
                        {isUnread && (
                          <span className="mt-1.5 h-2 w-2 rounded-full bg-primary shrink-0" />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="ml-4 rounded-full bg-zinc-200 dark:bg-zinc-800 h-10 w-10 overflow-hidden flex items-center justify-center">
            {userPhotoURL ? (
              <Image
                src={userPhotoURL}
                alt={t('common.profile', 'Perfil')}
                width={40}
                height={40}
                className="h-full w-full object-cover"
              />
            ) : (
              <User className="w-5 h-5 text-zinc-700 dark:text-zinc-200" />
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>
            {t('common.account', 'Cuenta')}
            {userEmail && (
              <div className="text-xs font-normal text-zinc-500 truncate max-w-[180px]">{userEmail}</div>
            )}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => router.push('/profile')} className="cursor-pointer">
            {t('common.profile', 'Perfil')}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleLogout} className="text-red-600 cursor-pointer">
            {t('common.logout', 'Cerrar sesión')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
