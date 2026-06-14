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
    <main className="flex min-h-screen flex-col bg-background text-foreground">
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
        <footer className="shrink-0 border-t border-border px-4 py-4 text-center">
          <p className="text-xs text-muted-foreground">
            Desarrollado por{' '}
            <a
              href="https://cuscadev.com"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary underline-offset-2 transition hover:underline"
            >
              cuscadev.com
            </a>
          </p>
        </footer>
      ) : null}
    </main>
  );
}
