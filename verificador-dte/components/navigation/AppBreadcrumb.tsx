'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Fragment } from 'react';

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { getBreadcrumbSegments } from '@/lib/breadcrumb-routes';

export default function AppBreadcrumb() {
  const pathname = usePathname();
  const segments = getBreadcrumbSegments(pathname);

  if (pathname === '/dashboard') {
    return (
      <Breadcrumb className="min-w-0 flex-1">
        <BreadcrumbList className="truncate">
          <BreadcrumbItem>
            <BreadcrumbPage>Inicio</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    );
  }

  return (
    <Breadcrumb className="min-w-0 flex-1">
      <BreadcrumbList className="truncate">
        {segments.map((segment, index) => {
          const isLast = index === segments.length - 1;

          return (
            <Fragment key={`${segment.label}-${index}`}>
              <BreadcrumbItem className="max-w-[7rem] truncate sm:max-w-[12rem] md:max-w-none">
                {isLast || !segment.href ? (
                  <BreadcrumbPage className="truncate">{segment.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link href={segment.href} className="truncate">
                      {segment.label}
                    </Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {!isLast && <BreadcrumbSeparator />}
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
