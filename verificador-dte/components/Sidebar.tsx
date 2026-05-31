'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import React, { useMemo, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  type LucideIcon,
  Home,
  FileText,
  Settings,
  ChevronDown,
  ChevronRight,
  Users,
  ClipboardList,
  CreditCard,
  CalendarDays,
  Activity,
  Bell,
  Palette,
  Smartphone,
} from 'lucide-react';

import { useAuth } from '@/components/AuthProvider';
import { canManageOrgUsers } from '@/lib/firestoreUser';

type NavChild = {
  href: string;
  label: string;
};

type Item = {
  href: string;
  label: string;
  icon: LucideIcon;
  children?: NavChild[];
};

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
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

  const { appUser } = useAuth();

  const isSuperadmin = appUser?.role === 'superadmin';
  const isCliente = appUser?.role === 'cliente';
  const showOrgUsers = canManageOrgUsers(appUser);

  const verificadorChildren: NavChild[] = [
    {
      href: '/verificadorDTE/verificador',
      label: 'sidebar.verificadorLinks',
    },
    {
      href: '/verificadorDTE/verificarodyfecha',
      label: 'sidebar.verificadorCodigoFecha',
    },
    {
      href: '/verificadorDTE/verificadorjson',
      label: 'sidebar.verificadorJSON',
    },
    {
      href: '/verificadorDTE/verificacion_individual',
      label: 'sidebar.verificacionIndividual',
    },
  ];

  const consultasLotesChildren: NavChild[] = [
    {
      href: '/consultas-lotes/codigo-lote',
      label: 'Consulta por codigo de lote',
    },
    {
      href: '/consultas-lotes/excel-codigo-fecha',
      label: 'Excel codigo y fecha',
    },
    {
      href: '/consultas-lotes/json',
      label: 'Subir JSON',
    },
    {
      href: '/consultas-lotes/individual',
      label: 'Consulta individual',
    },
    {
      href: '/consultas-lotes/qr-pdf',
      label: 'QR PDF',
    },
  ];

  const extraerChildren: NavChild[] = [
    {
      href: '/extraer/compras-json',
      label: 'Compras JSON',
    },
    {
      href: '/extraer/ventas-json',
      label: 'Ventas JSON',
    },
    {
      href: '/extraer/sujetos-excluidos',
      label: 'Sujetos Excluidos JSON',
    },
    {
      href: '/extraer/liquidacion-json',
      label: 'Liquidaciones JSON',
    },
    {
      href: '/extraer/qr-pdf',
      label: 'QR PDF',
    },
  ];

  const baseItems: Item[] = [
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
    },
    {
      href: '/escaneos-mobile',
      label: 'Escaneo desde la app',
      icon: Smartphone,
    },
    {
      href: '/tributario',
      label: 'Tributario',
      icon: CalendarDays,
    },
    {
      href: '/configuraciones',
      label: 'sidebar.configuracion',
      icon: Settings,
    },
  ];

  const adminItem: Item = {
    href: '/admin/users',
    label: 'sidebar.usuarios',
    icon: Users,
  };

  const orgUsersItem: Item = {
    href: '/usuarios',
    label: 'Usuarios org.',
    icon: Users,
  };

  const orgKycItem: Item = {
    href: '/organizacion/kyc',
    label: 'Datos fiscales (KYC)',
    icon: ClipboardList,
  };

  const organizacionesItem: Item = {
    href: '/admin/organizaciones',
    label: 'Organizaciones',
    icon: ClipboardList,
  };

  const planesItem: Item = {
    href: '/admin/planes',
    label: 'sidebar.planes',
    icon: CreditCard,
  };

  const avisosItem: Item = {
    href: '/admin/avisos',
    label: 'Avisos',
    icon: Bell,
  };

  const obligacionesItem: Item = {
    href: '/admin/obligacion',
    label: 'Obligaciones',
    icon: CalendarDays,
  };

  const monitoringChildren: NavChild[] = [
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
  ];

  const monitoringItem: Item = {
    href: '/admin/monitoreo',
    label: 'Monitoreo',
    icon: Activity,
    children: monitoringChildren,
  };

  const items = useMemo(() => {
    if (isSuperadmin) {
      return [
        ...baseItems,
        adminItem,
        organizacionesItem,
        planesItem,
        avisosItem,
        obligacionesItem,
        monitoringItem,
      ];
    }

    if (showOrgUsers) {
      return isCliente
        ? [...baseItems, orgKycItem, orgUsersItem]
        : [...baseItems, orgUsersItem];
    }

    if (isCliente) {
      return [...baseItems, orgKycItem];
    }

    return baseItems;
  }, [isSuperadmin, showOrgUsers, isCliente]);

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
    setOpenHref(openHref === href ? null : href);
  };

  return (
    <div
      className={[
        'flex h-full w-full flex-col bg-black text-white transition-[padding] duration-300',
        collapsed ? 'p-3' : 'p-4',
      ].join(' ')}
    >
      <div className="mb-6 flex items-center justify-center border-b border-white/10 pb-5">
        <Link
          href="/dashboard"
          onClick={onNavigate}
          className="rounded-md px-2 py-1 transition hover:bg-white/10"
          title="Kaiser DTE"
        >
          <Image
            src="/TemaDarkLogo.png"
            alt="Kaiser DTE"
            width={collapsed ? 34 : 140}
            height={48}
            className="object-contain"
            priority
          />
        </Link>
      </div>

      <nav className="flex-1 space-y-2 overflow-y-auto overflow-x-hidden pr-1">
        {items.map(({ href, label, icon: Icon, children }) => {
          const isParentActive = isActivePath(pathname, href);

          const isChildActive = children?.some((c) =>
            isActivePath(pathname, c.href)
          );

          const active = isChildActive || isParentActive;

          if (!children) {
            return (
              <Link
                key={href}
                href={href}
                onClick={onNavigate}
                aria-current={active ? 'page' : undefined}
                title={collapsed ? t(label) : undefined}
                className={`flex items-center rounded-md text-sm font-medium transition ${
                  active
                    ? 'bg-yellow-400 text-black shadow-sm shadow-yellow-400/20'
                    : 'text-zinc-300 hover:bg-white/10 hover:text-white'
                } ${
                  collapsed
                    ? 'h-11 justify-center px-0'
                    : 'gap-3 px-3 py-2'
                }`}
              >
                <Icon className="h-5 w-5 shrink-0" />

                {!collapsed && <span>{t(label)}</span>}
              </Link>
            );
          }

          const isOpen = openHref === href;

          return (
            <div key={href}>
              <button
                type="button"
                onClick={() => toggleOpen(href)}
                title={collapsed ? t(label) : undefined}
                className={`flex w-full items-center rounded-md text-sm font-medium transition ${
                  active
                    ? 'bg-yellow-400 text-black shadow-sm shadow-yellow-400/20'
                    : 'text-zinc-300 hover:bg-white/10 hover:text-white'
                } ${
                  collapsed
                    ? 'h-11 justify-center px-0'
                    : 'justify-between gap-3 px-3 py-2'
                }`}
              >
                <div
                  className={`flex items-center ${
                    collapsed ? 'justify-center' : 'gap-3'
                  }`}
                >
                  <Icon className="h-5 w-5 shrink-0" />

                  {!collapsed && <span>{t(label)}</span>}
                </div>

                {!collapsed &&
                  (isOpen ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  ))}
              </button>

              {isOpen && !collapsed && (
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
    </div>
  );
}
