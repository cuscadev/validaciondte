'use client';

import Image from 'next/image';
import type { ReactNode } from 'react';

type OnboardingShellProps = {
  children: ReactNode;
  showLogo?: boolean;
  showFooter?: boolean;
};

export function OnboardingShell({
  children,
  showLogo = true,
  showFooter = true,
}: OnboardingShellProps) {
  return (
    <main className="flex min-h-screen flex-col bg-slate-50 dark:bg-black">
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-8 sm:py-12">
        {showLogo && (
          <div className="mb-6 flex justify-center">
            <Image
              src="/TemaDarkLogo.png"
              alt="Kaiser DTE"
              width={120}
              height={40}
              className="h-10 w-auto object-contain"
              priority
            />
          </div>
        )}
        {children}
      </div>
      {showFooter ? (
        <footer className="shrink-0 border-t border-slate-200/80 px-4 py-4 text-center dark:border-white/10">
          <p className="text-xs text-slate-500 dark:text-zinc-500">
            Desarrollado por{' '}
            <a
              href="https://cuscadev.com"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-amber-600 underline-offset-2 transition hover:text-amber-500 hover:underline dark:text-yellow-400 dark:hover:text-yellow-300"
            >
              cuscadev.com
            </a>
          </p>
        </footer>
      ) : null}
    </main>
  );
}
