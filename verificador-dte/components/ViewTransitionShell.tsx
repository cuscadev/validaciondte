'use client';

import { usePathname } from 'next/navigation';
import { unstable_ViewTransition as ViewTransition } from 'react';

export function ViewTransitionShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return <ViewTransition key={pathname}>{children}</ViewTransition>;
}
