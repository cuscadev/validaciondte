'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  type LucideIcon,
  Settings,
  ChevronDown,
  ChevronUp,
  Users,
  ClipboardList,
  CreditCard,
  CalendarDays,
  Activity,
  Bell,
  Palette,
  Mail,
  UserCheck,
  ReceiptText,
  FileSearch,
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
  group?: string;
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
      ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm shadow-primary/20'
      : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground',
  );
}

function SidebarTooltip({
  collapsed,
  label,
  children,
  side,
}: {
  collapsed: boolean;
  label: string;
  children: React.ReactElement;
  side?: 'left' | 'right';
}) {
  const tooltipSide = side ?? (collapsed ? 'right' : 'left');

  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={tooltipSide} sideOffset={8}>
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
                    ? 'bg-sidebar-accent text-primary'
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
  'mx-0.5 flex h-6 w-10 shrink-0 items-center justify-center rounded-lg text-sidebar-foreground/50 transition hover:bg-sidebar-accent hover:text-sidebar-foreground disabled:pointer-events-none disabled:opacity-25';

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

function insertItemAfterVerificarConsultar(items: Item[], insert: Item): Item[] {
  const index = items.findIndex((item) => item.href === '/verificar-consultar');
  if (index === -1) return [...items, insert];
  return [...items.slice(0, index + 1), insert, ...items.slice(index + 1)];
}

function findActiveSectionHref(items: Item[], pathname: string): string | null {
  for (const item of items) {
    if (item.children?.some((c) => isActivePath(pathname, c.href))) {
      return item.href;
    }
  }

  for (const item of items) {
    if (pathname === item.href) {
      return item.href;
    }
  }

  for (const item of items) {
    if (!item.children && isActivePath(pathname, item.href)) {
      return item.href;
    }
  }

  return items[0]?.href ?? null;
}

function SidebarSectionPanel({
  item,
  pathname,
  onNavigate,
  t,
}: {
  item: Item;
  pathname: string;
  onNavigate?: () => void;
  t: (key: string) => string;
}) {
  const itemLabel = t(item.label);
  const { icon: Icon, children, href } = item;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="mb-2 flex shrink-0 items-center gap-2 px-1">
        <Icon className="size-3.5 shrink-0 text-sidebar-foreground/50" aria-hidden />
        <p className="truncate text-[11px] font-semibold uppercase tracking-[0.14em] text-sidebar-foreground/50">
          {itemLabel}
        </p>
      </div>

      <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto overflow-x-hidden pr-1">
        {children ? (
          children.map((c, index) => {
            const childActive = isActivePath(pathname, c.href);
            const prevGroup = index > 0 ? children[index - 1]?.group : undefined;
            const showGroupHeader = Boolean(c.group && c.group !== prevGroup);

            return (
              <React.Fragment key={c.href}>
                {showGroupHeader ? (
                  <p className="mt-2 px-2 pt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-sidebar-foreground/40 first:mt-0 first:pt-0">
                    {c.group}
                  </p>
                ) : null}
                <Link
                  href={c.href}
                  onClick={onNavigate}
                  aria-current={childActive ? 'page' : undefined}
                  className={cn(
                    'flex items-center gap-2 rounded-md py-1.5 pl-2 pr-2 text-sm transition',
                    childActive
                      ? 'bg-sidebar-accent font-medium text-primary'
                      : 'text-sidebar-foreground/75 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground',
                  )}
                >
                  <span
                    className={cn(
                      'size-1.5 shrink-0 rounded-full',
                      childActive ? 'bg-primary shadow-[0_0_8px_rgba(0,209,255,0.6)]' : 'bg-sidebar-foreground/25',
                    )}
                    aria-hidden
                  />
                  <span className="min-w-0 truncate">{t(c.label)}</span>
                </Link>
              </React.Fragment>
            );
          })
        ) : (
          <Link
            href={href}
            onClick={onNavigate}
            aria-current={isActivePath(pathname, href) ? 'page' : undefined}
            className={cn(
              'flex items-center gap-2 rounded-md py-1.5 pl-2 pr-2 text-sm transition',
              isActivePath(pathname, href)
                ? 'bg-sidebar-accent font-medium text-primary'
                : 'text-sidebar-foreground/75 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground',
            )}
          >
            <span
              className={cn(
                'size-1.5 shrink-0 rounded-full',
                isActivePath(pathname, href)
                  ? 'bg-primary shadow-[0_0_8px_rgba(0,209,255,0.6)]'
                  : 'bg-sidebar-foreground/25',
              )}
              aria-hidden
            />
            <span>{itemLabel}</span>
          </Link>
        )}
      </nav>
    </div>
  );
}

function SidebarShortcutBar({
  items,
  pathname,
  collapsed,
  selectedHref,
  openFlyoutHref,
  onNavigate,
  onSelectSection,
  onFlyoutChange,
  t,
}: {
  items: Item[];
  pathname: string;
  collapsed: boolean;
  selectedHref: string | null;
  openFlyoutHref: string | null;
  onNavigate?: () => void;
  onSelectSection: (href: string) => void;
  onFlyoutChange: (href: string | null) => void;
  t: (key: string) => string;
}) {
  if (items.length === 0) return null;

  const renderShortcut = (item: Item) => {
    const { href, label, icon: Icon, children } = item;
    const active = selectedHref === href || openFlyoutHref === href;
    const itemLabel = t(label);

    const className = cn(
      collapsed ? collapsedItemClass(active) : 'inline-flex size-9 shrink-0 items-center justify-center rounded-lg transition',
      !collapsed &&
        (active
          ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm shadow-primary/20'
          : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'),
    );

    const wrapWithTooltip = (node: React.ReactElement) => (
      <SidebarTooltip collapsed={collapsed} label={itemLabel} side={collapsed ? 'right' : 'right'}>
        {node}
      </SidebarTooltip>
    );

    if (collapsed && children) {
      return (
        <div key={href} className={collapsedItemWrap}>
          <SidebarSubmenuFlyout
            itemLabel={itemLabel}
            active={active}
            icon={Icon}
            pathname={pathname}
            onNavigate={onNavigate}
            t={t}
            open={openFlyoutHref === href}
            onOpenChange={(next) => onFlyoutChange(next ? href : null)}
          >
            {children}
          </SidebarSubmenuFlyout>
        </div>
      );
    }

    if (collapsed && !children) {
      return (
        <div key={href} className={collapsedItemWrap}>
          {wrapWithTooltip(
            <Link
              href={href}
              onClick={() => {
                onSelectSection(href);
                onNavigate?.();
              }}
              aria-current={active ? 'page' : undefined}
              aria-label={itemLabel}
              className={className}
            >
              <Icon className="size-[1.15rem] shrink-0" />
            </Link>,
          )}
        </div>
      );
    }

    return (
      <div key={href} className="flex shrink-0 justify-center">
        {wrapWithTooltip(
          <button
            type="button"
            className={className}
            aria-label={itemLabel}
            aria-current={active ? 'true' : undefined}
            aria-expanded={selectedHref === href}
            onClick={() => onSelectSection(href)}
          >
            <Icon className="size-[1.15rem] shrink-0" />
          </button>,
        )}
      </div>
    );
  };

  const rail = (
    <div
      className={cn(
        'flex shrink-0 flex-col border-sidebar-border',
        collapsed
          ? 'min-h-0 w-full flex-1 items-start pl-0.5'
          : 'w-11 border-r py-1 pr-1',
      )}
      role="toolbar"
      aria-label="Atajos de navegación"
    >
      <div
        className={cn(
          'flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overflow-x-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
          collapsed ? 'items-start' : 'items-center',
        )}
      >
        {items.map(renderShortcut)}
      </div>
    </div>
  );

  if (collapsed) {
    return (
      <CollapsedNavRail>
        <div className="flex w-full flex-col items-start gap-1.5">
          {items.map(renderShortcut)}
        </div>
      </CollapsedNavRail>
    );
  }

  return rail;
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

  const [activeSectionHref, setActiveSectionHref] = useState<string | null>(
    '/verificar-consultar',
  );
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
        group: 'Verificar DTEs',
      },
      {
        href: '/verificadorDTE/verificarodyfecha',
        label: 'sidebar.verificadorCodigoFecha',
        routeKey: 'verificarodyfecha',
        group: 'Verificar DTEs',
      },
      {
        href: '/verificadorDTE/verificadorjson',
        label: 'sidebar.verificadorJSON',
        routeKey: 'verificadorjson',
        group: 'Verificar DTEs',
      },
      {
        href: '/verificadorDTE/verificacion_individual',
        label: 'sidebar.verificacionIndividual',
        routeKey: 'verificacion_individual',
        group: 'Verificar DTEs',
      },
      {
        href: '/verificadorDTE/verificador-qr',
        label: 'sidebar.verificadorQR',
        routeKey: 'verificador_qr',
        group: 'Verificar DTEs',
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
        group: 'Consultas lotes',
      },
      {
        href: '/consultas-lotes/excel-codigo-fecha',
        label: 'Excel codigo y fecha',
        routeKey: 'consultas_lotes_excel_codigo_fecha',
        group: 'Consultas lotes',
      },
      {
        href: '/consultas-lotes/json',
        label: 'Subir JSON',
        routeKey: 'consultas_lotes_json',
        group: 'Consultas lotes',
      },
      {
        href: '/consultas-lotes/individual',
        label: 'Consulta individual',
        routeKey: 'consultas_lotes_individual',
        group: 'Consultas lotes',
      },
      {
        href: '/consultas-lotes/qr-pdf',
        label: 'QR PDF',
        routeKey: 'consultas_lotes_qr_pdf',
        group: 'Consultas lotes',
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
        group: 'Extraer datos',
      },
      {
        href: '/extraer/ventas-json',
        label: 'Ventas JSON',
        routeKey: 'ventas-json',
        group: 'Extraer datos',
      },
      {
        href: '/extraer/sujetos-excluidos',
        label: 'Sujetos Excluidos JSON',
        routeKey: 'sujetos-excluidos',
        group: 'Extraer datos',
      },
      {
        href: '/extraer/liquidacion-json',
        label: 'Liquidaciones JSON',
        routeKey: 'liquidacion-json',
        group: 'Extraer datos',
      },
      {
        href: '/escaneos-mobile',
        label: 'Escaneo desde la app',
        routeKey: 'escaneos-mobile',
        group: 'Escaneo movil',
      },
    ],
    [],
  );

  const verificarConsultarChildren = useMemo(
    () => [...verificadorChildren, ...consultasLotesChildren, ...extraerChildren],
    [consultasLotesChildren, extraerChildren, verificadorChildren],
  );

  const facturacionChildren = useMemo<NavChild[]>(
    () => [
      {
        href: '/facturacion/consumidor-final',
        label: 'Facturar consumidor final',
        routeKey: 'facturacion-consumidor-final',
      },
      {
        href: '/facturacion/credito-fiscal',
        label: 'Emitir credito fiscal',
        routeKey: 'facturacion-credito-fiscal',
      },
      {
        href: '/facturacion/exportacion',
        label: 'Factura de exportacion',
        routeKey: 'facturacion-exportacion',
      },
      {
        href: '/facturacion/nota-credito',
        label: 'Nota de credito',
        routeKey: 'facturacion-nota-credito',
      },
      {
        href: '/facturacion/nota-debito',
        label: 'Nota de debito',
        routeKey: 'facturacion-nota-debito',
      },
      {
        href: '/facturacion/sujeto-excluido',
        label: 'Facturar sujeto excluido',
        routeKey: 'facturacion-sujeto-excluido',
      },
      {
        href: '/facturacion/envio-lotes',
        label: 'Envio de lotes',
        routeKey: 'facturacion-envio-lotes',
      },
      {
        href: '/facturacion/reporte',
        label: 'Reporte',
        routeKey: 'facturacion-reporte',
      },
      {
        href: '/facturacion/prueba-emision',
        label: 'Prueba de emision',
        routeKey: 'facturacion-prueba-emision',
      },
      {
        href: '/facturacion/receptores',
        label: 'Receptores',
        routeKey: 'facturacion-receptores',
      },
    ],
    [],
  );

  const baseItems = useMemo<Item[]>(
    () => [
      {
        href: '/verificar-consultar',
        label: 'Verificar y consultar',
        icon: FileSearch,
        children: verificarConsultarChildren,
      },
      {
        href: '/plantillas-pdf',
        label: 'Plantillas PDF',
        icon: Palette,
        routeKey: 'plantillas-pdf',
      },
      {
        href: '/tributario',
        label: 'Tributario',
        icon: CalendarDays,
      },
      {
        href: '/integraciones/correo-imap',
        label: 'Importar desde correo',
        icon: Mail,
        routeKey: 'integraciones-imap',
      },
      {
        href: '/configuraciones',
        label: 'sidebar.configuracion',
        icon: Settings,
      },
    ],
    [verificarConsultarChildren],
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
          routeKey: 'facturacion-receptores',
        },
      ],
    }),
    [],
  );

  const filterItemByPlan = useCallback(
    (item: Item): Item | null => {
      if (isSuperadmin) return item;

      const allowed = new Set(allowedRoutes);
      if (item.children) {
        const children = item.children.filter(
          (child) => !child.routeKey || allowed.has(child.routeKey),
        );
        return children.length > 0 ? { ...item, children } : null;
      }

      if (item.routeKey && !allowed.has(item.routeKey)) {
        return null;
      }

      return item;
    },
    [allowedRoutes, isSuperadmin],
  );

  const filteredFacturacionItem = useMemo(
    () => filterItemByPlan(facturacionItem),
    [facturacionItem, filterItemByPlan],
  );

  const filteredFacturacionReceptoresItem = useMemo(
    () => filterItemByPlan(facturacionReceptoresItem),
    [facturacionReceptoresItem, filterItemByPlan],
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
    const withFacturacion = (list: Item[], facturacion: Item | null) =>
      facturacion ? insertItemAfterVerificarConsultar(list, facturacion) : list;

    if (isSuperadmin) {
      return [
        ...withFacturacion(planFilteredBaseItems, filteredFacturacionItem),
        accessRequestsItem,
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
            ...withFacturacion(
              [...planFilteredBaseItems, orgKycItem, orgUsersItem],
              filteredFacturacionItem,
            ),
            notificationsItem,
          ]
        : [
            ...withFacturacion(
              [...planFilteredBaseItems, orgUsersItem],
              filteredFacturacionReceptoresItem,
            ),
            notificationsItem,
          ];
    }

    if (isCliente) {
      return [
        ...withFacturacion(planFilteredBaseItems, filteredFacturacionItem),
        orgKycItem,
        notificationsItem,
      ];
    }

    return [
      ...withFacturacion(planFilteredBaseItems, filteredFacturacionReceptoresItem),
      notificationsItem,
    ];
  }, [
    isSuperadmin,
    showOrgUsers,
    isCliente,
    planFilteredBaseItems,
    accessRequestsItem,
    filteredFacturacionItem,
    filteredFacturacionReceptoresItem,
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
    if (pathname === '/dashboard') {
      setActiveSectionHref('/verificar-consultar');
      return;
    }
    const matched = findActiveSectionHref(items, pathname);
    if (matched) {
      setActiveSectionHref(matched);
    }
  }, [pathname, items]);

  const activeSection = useMemo(() => {
    if (!activeSectionHref) return null;
    return items.find((item) => item.href === activeSectionHref) ?? null;
  }, [activeSectionHref, items]);

  const selectSection = useCallback((href: string) => {
    setActiveSectionHref(href);
    setOpenFlyoutHref(null);
  }, []);

  const brandName = t('app.brandName', 'KAYDTE');

  return (
    <div
      className={cn(
        'flex h-full w-full flex-col bg-sidebar text-sidebar-foreground',
        collapsed ? 'px-2.5 py-3' : 'p-4',
      )}
    >
      <div
        className={cn(
          'border-b border-sidebar-border',
          collapsed ? 'mb-3 flex justify-center pb-3' : 'mb-4 pb-4',
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
                ? 'relative mx-0.5 block size-10 shrink-0 overflow-hidden rounded-xl border border-sidebar-border bg-sidebar-accent hover:bg-sidebar-accent/80'
                : 'flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-sidebar-accent',
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

      <div className="flex min-h-0 flex-1 flex-row overflow-hidden">
        <SidebarShortcutBar
          items={items}
          pathname={pathname}
          collapsed={collapsed}
          selectedHref={activeSectionHref}
          openFlyoutHref={openFlyoutHref}
          onNavigate={onNavigate}
          onSelectSection={selectSection}
          onFlyoutChange={setOpenFlyoutHref}
          t={t}
        />

        {!collapsed && activeSection ? (
          <div className="min-w-0 flex-1 overflow-hidden pl-2">
            <SidebarSectionPanel
              item={activeSection}
              pathname={pathname}
              onNavigate={onNavigate}
              t={t}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
