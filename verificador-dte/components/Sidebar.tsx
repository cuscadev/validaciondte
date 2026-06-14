'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  type LucideIcon,
  Home,
  FileText,
  Settings,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Users,
  ClipboardList,
  CreditCard,
  CalendarDays,
  Activity,
  Bell,
  Palette,
  Smartphone,
  Mail,
  UserCheck,
  ReceiptText,
} from 'lucide-react';

import { useAuth } from '@/components/AuthProvider';
import { canManageOrgUsers } from '@/lib/firestoreUser';
import { useCurrentPlanConfig } from '@/hooks/usePlanAccess';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

type NavChild = {
  href: string;
  label: string;
  routeKey?: string;
};

type Item = {
  href: string;
  label: string;
  icon: LucideIcon;
  routeKey?: string;
  children?: NavChild[];
};

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

const collapsedIconBtn =
  'box-border mx-0.5 size-10 shrink-0 rounded-xl inline-flex items-center justify-center p-0 text-sm font-medium transition';

const collapsedItemWrap = 'flex w-full shrink-0 justify-center';

function collapsedItemClass(active: boolean) {
  return cn(
    collapsedIconBtn,
    active
      ? 'bg-yellow-400 text-black shadow-sm shadow-yellow-400/20'
      : 'text-zinc-300 hover:bg-white/10 hover:text-white',
  );
}

function SidebarTooltip({
  collapsed,
  label,
  children,
}: {
  collapsed: boolean;
  label: string;
  children: React.ReactElement;
}) {
  if (!collapsed) return children;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

function SidebarSubmenuFlyout({
  itemLabel,
  active,
  icon: Icon,
  children,
  pathname,
  onNavigate,
  t,
  open,
  onOpenChange,
}: {
  itemLabel: string;
  active: boolean;
  icon: LucideIcon;
  children: NavChild[];
  pathname: string;
  onNavigate?: () => void;
  t: (key: string) => string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <div className={collapsedItemWrap}>
      <DropdownMenu open={open} onOpenChange={onOpenChange} modal={false}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={collapsedItemClass(active || open)}
            aria-label={itemLabel}
            aria-expanded={open}
          >
            <Icon className="h-5 w-5 shrink-0" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          side="right"
          align="start"
          sideOffset={8}
          className="min-w-52"
        >
          <DropdownMenuLabel className="text-xs uppercase tracking-wide text-muted-foreground">
            {itemLabel}
          </DropdownMenuLabel>
          {children.map((c) => (
            <DropdownMenuItem key={c.href} asChild>
              <Link
                href={c.href}
                onClick={() => {
                  onOpenChange(false);
                  onNavigate?.();
                }}
                className={
                  isActivePath(pathname, c.href)
                    ? 'bg-yellow-400/10 text-yellow-700 dark:text-yellow-300'
                    : ''
                }
              >
                {t(c.label)}
              </Link>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

const collapsedChevronBtn =
  'mx-0.5 flex h-6 w-10 shrink-0 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:opacity-25';

function CollapsedNavRail({ children }: { children: React.ReactNode }) {
  const navRef = useRef<HTMLElement>(null);
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = navRef.current;
    if (!el) return;
    setCanScrollUp(el.scrollTop > 4);
    setCanScrollDown(el.scrollTop + el.clientHeight < el.scrollHeight - 4);
  }, []);

  useEffect(() => {
    const el = navRef.current;
    if (!el) return;
    updateScrollState();
    el.addEventListener('scroll', updateScrollState, { passive: true });
    const observer = new ResizeObserver(updateScrollState);
    observer.observe(el);
    return () => {
      el.removeEventListener('scroll', updateScrollState);
      observer.disconnect();
    };
  }, [updateScrollState, children]);

  const scrollBy = (delta: number) => {
    navRef.current?.scrollBy({ top: delta, behavior: 'smooth' });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center gap-0.5">
      <button
        type="button"
        className={collapsedChevronBtn}
        disabled={!canScrollUp}
        onClick={() => scrollBy(-132)}
        aria-label="Subir menú"
      >
        <ChevronUp className="h-4 w-4" />
      </button>
      <nav
        ref={navRef}
        className="sidebar-rail-scroll flex w-full min-h-0 flex-1 flex-col items-center gap-1.5 overflow-y-auto overflow-x-hidden py-0.5"
      >
        {children}
      </nav>
      <button
        type="button"
        className={collapsedChevronBtn}
        disabled={!canScrollDown}
        onClick={() => scrollBy(132)}
        aria-label="Bajar menú"
      >
        <ChevronDown className="h-4 w-4" />
      </button>
    </div>
  );
}

export default function Sidebar({
  collapsed = false,
  onNavigate,
}: {
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const { t } = useTranslation();
  const pathname = usePathname();

  const [openHref, setOpenHref] = useState<string | null>(null);
  const [openFlyoutHref, setOpenFlyoutHref] = useState<string | null>(null);

  const { appUser } = useAuth();
  const { allowedRoutes, isSuperadmin: planSuperadmin } = useCurrentPlanConfig();

  const isSuperadmin = appUser?.role === 'superadmin' || planSuperadmin;
  const isCliente = appUser?.role === 'cliente';
  const showOrgUsers = canManageOrgUsers(appUser);

  const verificadorChildren = useMemo<NavChild[]>(
    () => [
      {
        href: '/verificadorDTE/verificador',
        label: 'sidebar.verificadorLinks',
        routeKey: 'verificador',
      },
      {
        href: '/verificadorDTE/verificarodyfecha',
        label: 'sidebar.verificadorCodigoFecha',
        routeKey: 'verificarodyfecha',
      },
      {
        href: '/verificadorDTE/verificadorjson',
        label: 'sidebar.verificadorJSON',
        routeKey: 'verificadorjson',
      },
      {
        href: '/verificadorDTE/verificacion_individual',
        label: 'sidebar.verificacionIndividual',
        routeKey: 'verificacion_individual',
      },
      {
        href: '/verificadorDTE/verificador-qr',
        label: 'sidebar.verificadorQR',
        routeKey: 'verificador_qr',
      },
    ],
    [],
  );

  const consultasLotesChildren = useMemo<NavChild[]>(
    () => [
      {
        href: '/consultas-lotes/codigo-lote',
        label: 'Consulta por codigo de lote',
        routeKey: 'consulta_lote_codigo',
      },
      {
        href: '/consultas-lotes/excel-codigo-fecha',
        label: 'Excel codigo y fecha',
        routeKey: 'consultas_lotes_excel_codigo_fecha',
      },
      {
        href: '/consultas-lotes/json',
        label: 'Subir JSON',
        routeKey: 'consultas_lotes_json',
      },
      {
        href: '/consultas-lotes/individual',
        label: 'Consulta individual',
        routeKey: 'consultas_lotes_individual',
      },
      {
        href: '/consultas-lotes/qr-pdf',
        label: 'QR PDF',
        routeKey: 'consultas_lotes_qr_pdf',
      },
    ],
    [],
  );

  const extraerChildren = useMemo<NavChild[]>(
    () => [
      {
        href: '/extraer/compras-json',
        label: 'Compras JSON',
        routeKey: 'compras-json',
      },
      {
        href: '/extraer/ventas-json',
        label: 'Ventas JSON',
        routeKey: 'ventas-json',
      },
      {
        href: '/extraer/sujetos-excluidos',
        label: 'Sujetos Excluidos JSON',
        routeKey: 'sujetos-excluidos',
      },
      {
        href: '/extraer/liquidacion-json',
        label: 'Liquidaciones JSON',
        routeKey: 'liquidacion-json',
      },
      {
        href: '/extraer/qr-pdf',
        label: 'QR PDF',
        routeKey: 'qr-pdf',
      },
    ],
    [],
  );

  const facturacionChildren = useMemo<NavChild[]>(
    () => [
      {
        href: '/facturacion/consumidor-final',
        label: 'Facturar consumidor final',
      },
      {
        href: '/facturacion/credito-fiscal',
        label: 'Emitir credito fiscal',
      },
      {
        href: '/facturacion/exportacion',
        label: 'Factura de exportacion',
      },
      {
        href: '/facturacion/nota-credito',
        label: 'Nota de credito',
      },
      {
        href: '/facturacion/nota-debito',
        label: 'Nota de debito',
      },
      {
        href: '/facturacion/sujeto-excluido',
        label: 'Facturar sujeto excluido',
      },
      {
        href: '/facturacion/envio-lotes',
        label: 'Envio de lotes',
      },
      {
        href: '/facturacion/reporte',
        label: 'Reporte',
      },
      {
        href: '/facturacion/prueba-emision',
        label: 'Prueba de emision',
      },
      {
        href: '/facturacion/receptores',
        label: 'Receptores',
      },
    ],
    [],
  );

  const baseItems = useMemo<Item[]>(
    () => [
      {
        href: '/dashboard',
        label: 'sidebar.inicio',
        icon: Home,
      },
      {
        href: '/verificadorDTE',
        label: 'sidebar.verificarDTEs',
        icon: FileText,
        children: verificadorChildren,
      },
      {
        href: '/consultas-lotes',
        label: 'Consultas lotes',
        icon: ClipboardList,
        children: consultasLotesChildren,
      },
      {
        href: '/extraer',
        label: 'sidebar.extraer',
        icon: FileText,
        children: extraerChildren,
      },
      {
        href: '/plantillas-pdf',
        label: 'Plantillas PDF',
        icon: Palette,
        routeKey: 'plantillas-pdf',
      },
      {
        href: '/escaneos-mobile',
        label: 'Escaneo desde la app',
        icon: Smartphone,
        routeKey: 'escaneos-mobile',
      },
      {
        href: '/tributario',
        label: 'Tributario',
        icon: CalendarDays,
      },
      {
        href: '/integraciones/gmail',
        label: 'Importar desde Gmail',
        icon: Mail,
        routeKey: 'integraciones-gmail',
      },
      {
        href: '/integraciones/correo-imap',
        label: 'Importar desde correo (IMAP)',
        icon: Mail,
        routeKey: 'integraciones-imap',
      },
      {
        href: '/configuraciones',
        label: 'sidebar.configuracion',
        icon: Settings,
      },
    ],
    [consultasLotesChildren, extraerChildren, verificadorChildren],
  );

  const adminItem = useMemo<Item>(
    () => ({
      href: '/admin/users',
      label: 'sidebar.usuarios',
      icon: Users,
    }),
    [],
  );

  const accessRequestsItem = useMemo<Item>(
    () => ({
      href: '/admin/access-requests',
      label: 'sidebar.accessRequests',
      icon: UserCheck,
    }),
    [],
  );

  const facturacionItem = useMemo<Item>(
    () => ({
      href: '/facturacion',
      label: 'Facturacion',
      icon: ReceiptText,
      children: facturacionChildren,
    }),
    [facturacionChildren],
  );

  const facturacionReceptoresItem = useMemo<Item>(
    () => ({
      href: '/facturacion',
      label: 'Facturacion',
      icon: ReceiptText,
      children: [
        {
          href: '/facturacion/receptores',
          label: 'Receptores',
        },
      ],
    }),
    [],
  );

  const orgUsersItem = useMemo<Item>(
    () => ({
      href: '/usuarios',
      label: 'Usuarios org.',
      icon: Users,
    }),
    [],
  );

  const orgKycItem = useMemo<Item>(
    () => ({
      href: '/organizacion/kyc',
      label: 'Datos fiscales (KYC)',
      icon: ClipboardList,
    }),
    [],
  );

  const notificationsItem = useMemo<Item>(
    () => ({
      href: '/notificaciones',
      label: 'Notificaciones',
      icon: Bell,
    }),
    [],
  );

  const planesItem = useMemo<Item>(
    () => ({
      href: '/admin/planes',
      label: 'sidebar.planes',
      icon: CreditCard,
    }),
    [],
  );

  const avisosItem = useMemo<Item>(
    () => ({
      href: '/admin/avisos',
      label: 'Avisos',
      icon: Bell,
    }),
    [],
  );

  const obligacionesItem = useMemo<Item>(
    () => ({
      href: '/admin/obligacion',
      label: 'Obligaciones',
      icon: CalendarDays,
    }),
    [],
  );

  const monitoringChildren = useMemo<NavChild[]>(
    () => [
      {
        href: '/admin/monitoreo/visitantes',
        label: 'Visitantes landing',
      },
      {
        href: '/admin/monitoreo/procesamiento',
        label: 'Procesamiento de archivos',
      },
      {
        href: '/admin/monitoreo/inicios-sesion',
        label: 'Inicios de sesion',
      },
      {
        href: '/admin/monitoreo/licencias',
        label: 'sidebar.gestionLicencias',
      },
      {
        href: '/admin/obligacion',
        label: 'Obligaciones',
      },
    ],
    [],
  );

  const monitoringItem = useMemo<Item>(
    () => ({
      href: '/admin/monitoreo',
      label: 'Monitoreo',
      icon: Activity,
      children: monitoringChildren,
    }),
    [monitoringChildren],
  );

  const planFilteredBaseItems = useMemo(() => {
    if (isSuperadmin) return baseItems;

    const allowed = new Set(allowedRoutes);
    return baseItems
      .map((item) => {
        if (item.children) {
          const children = item.children.filter((child) => {
            return !child.routeKey || allowed.has(child.routeKey);
          });
          return children.length > 0 ? { ...item, children } : null;
        }

        if (item.routeKey && !allowed.has(item.routeKey)) {
          return null;
        }

        return item;
      })
      .filter((item): item is Item => Boolean(item));
  }, [allowedRoutes, baseItems, isSuperadmin]);

  const items = useMemo(() => {
    if (isSuperadmin) {
      return [
        ...planFilteredBaseItems,
        accessRequestsItem,
        facturacionItem,
        adminItem,
        planesItem,
        avisosItem,
        obligacionesItem,
        monitoringItem,
        notificationsItem,
      ];
    }

    if (showOrgUsers) {
      return isCliente
        ? [
            ...planFilteredBaseItems,
            orgKycItem,
            facturacionItem,
            orgUsersItem,
            notificationsItem,
          ]
        : [
            ...planFilteredBaseItems,
            facturacionReceptoresItem,
            orgUsersItem,
            notificationsItem,
          ];
    }

    if (isCliente) {
      return [
        ...planFilteredBaseItems,
        orgKycItem,
        facturacionItem,
        notificationsItem,
      ];
    }

    return [...planFilteredBaseItems, facturacionReceptoresItem, notificationsItem];
  }, [
    isSuperadmin,
    showOrgUsers,
    isCliente,
    planFilteredBaseItems,
    accessRequestsItem,
    facturacionItem,
    facturacionReceptoresItem,
    adminItem,
    planesItem,
    avisosItem,
    obligacionesItem,
    monitoringItem,
    notificationsItem,
    orgKycItem,
    orgUsersItem,
  ]);

  useEffect(() => {
    setOpenFlyoutHref(null);
  }, [pathname]);

  useEffect(() => {
    const activeParent = items.find((item) =>
      item.children?.some((child) =>
        isActivePath(pathname, child.href)
      )
    );

    if (activeParent) {
      setOpenHref(activeParent.href);
    }
  }, [items, pathname]);

  const toggleOpen = (href: string) => {
    setOpenHref((current) => (current === href ? null : href));
  };

  const brandName = t('app.brandName', 'KAYDTE');

  return (
    <div
      className={cn(
        'flex h-full w-full flex-col bg-black text-white',
        collapsed ? 'px-2.5 py-3' : 'p-4',
      )}
    >
      <div
        className={cn(
          'border-b border-white/10',
          collapsed ? 'mb-3 flex justify-center pb-3' : 'mb-6 pb-5',
        )}
      >
        <div className={cn(collapsed && collapsedItemWrap)}>
          <SidebarTooltip collapsed={collapsed} label={brandName}>
          <Link
            href="/dashboard"
            onClick={onNavigate}
            className={cn(
              'transition',
              collapsed
                ? 'relative mx-0.5 block size-10 shrink-0 overflow-hidden rounded-xl border border-white/15 bg-white/5 hover:bg-white/10'
                : 'flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-white/10',
            )}
            title={collapsed ? undefined : brandName}
          >
            {collapsed ? (
              <Image
                src="/TemaDarkLogo.png"
                alt={brandName}
                fill
                sizes="44px"
                className="object-cover"
                priority
              />
            ) : (
              <>
                <div className="relative size-11 shrink-0 overflow-hidden rounded-xl border border-white/15 bg-white/5">
                  <Image
                    src="/TemaDarkLogo.png"
                    alt={brandName}
                    fill
                    sizes="44px"
                    className="object-cover"
                    priority
                  />
                </div>
                <span className="text-base font-semibold tracking-[0.18em] text-white">
                  {brandName}
                </span>
              </>
            )}
          </Link>
        </SidebarTooltip>
        </div>
      </div>

      {collapsed ? (
        <CollapsedNavRail>
          {items.map(({ href, label, icon: Icon, children }) => {
            const isParentActive = isActivePath(pathname, href);
            const isChildActive = children?.some((c) =>
              isActivePath(pathname, c.href),
            );
            const active = isChildActive || isParentActive;
            const itemLabel = t(label);

            if (!children) {
              const link = (
                <Link
                  href={href}
                  onClick={onNavigate}
                  aria-current={active ? 'page' : undefined}
                  className={collapsedItemClass(active)}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                </Link>
              );

              return (
                <div key={href} className={collapsedItemWrap}>
                  <SidebarTooltip collapsed label={itemLabel}>
                    {link}
                  </SidebarTooltip>
                </div>
              );
            }

            return (
              <SidebarSubmenuFlyout
                key={href}
                itemLabel={itemLabel}
                active={active}
                icon={Icon}
                pathname={pathname}
                onNavigate={onNavigate}
                t={t}
                open={openFlyoutHref === href}
                onOpenChange={(next) => setOpenFlyoutHref(next ? href : null)}
              >
                {children}
              </SidebarSubmenuFlyout>
            );
          })}
        </CollapsedNavRail>
      ) : (
      <nav className="flex-1 min-h-0 space-y-2 overflow-y-auto overflow-x-hidden pr-1">
        {items.map(({ href, label, icon: Icon, children }) => {
          const isParentActive = isActivePath(pathname, href);

          const isChildActive = children?.some((c) =>
            isActivePath(pathname, c.href)
          );

          const active = isChildActive || isParentActive;
          const itemLabel = t(label);

          if (!children) {
            const link = (
              <Link
                href={href}
                onClick={onNavigate}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition',
                  active
                    ? 'bg-yellow-400 text-black shadow-sm shadow-yellow-400/20'
                    : 'text-zinc-300 hover:bg-white/10 hover:text-white',
                )}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span>{itemLabel}</span>
              </Link>
            );

            return <div key={href}>{link}</div>;
          }

          const isOpen = openHref === href;

          return (
            <div key={href}>
              <button
                type="button"
                onClick={() => toggleOpen(href)}
                className={`flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-sm font-medium transition ${
                  active
                    ? 'bg-yellow-400 text-black shadow-sm shadow-yellow-400/20'
                    : 'text-zinc-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className="h-5 w-5 shrink-0" />
                  <span>{itemLabel}</span>
                </div>

                {isOpen ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>

              {isOpen && (
                <div className="ml-4 mt-2 space-y-1 border-l border-yellow-400/30 pl-3">
                  {children.map((c) => {
                    const childActive = isActivePath(
                      pathname,
                      c.href
                    );

                    return (
                      <Link
                        key={c.href}
                        href={c.href}
                        onClick={onNavigate}
                        aria-current={
                          childActive ? 'page' : undefined
                        }
                        className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition ${
                          childActive
                            ? 'text-yellow-300'
                            : 'text-zinc-300 hover:bg-yellow-400/10 hover:text-yellow-200'
                        }`}
                      >
                        <span
                          className={`h-2 w-2 rounded-full transition ${
                            childActive
                              ? 'bg-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.7)]'
                              : 'bg-white/20'
                          }`}
                          aria-hidden
                        />

                        <span>{t(c.label)}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>
      )}
    </div>
  );
}
