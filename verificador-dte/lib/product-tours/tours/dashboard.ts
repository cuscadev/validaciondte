import type { DriveStep } from 'driver.js';

import type { SidebarTourItem } from '@/lib/product-tours/sidebar-tour-registry';
import {
  selectSidebarSectionForTour,
  sidebarNavTourSelector,
} from '@/lib/product-tours/sidebar-tour-events';

export const DASHBOARD_TOUR_ID = 'dashboard';

const SIDEBAR_SECTION_INTRO: Record<string, string> = {
  '/verificar-consultar': 'Zona principal para validar y consultar tus documentos tributarios.',
  '/facturacion': 'Todo lo relacionado con emitir facturas electrónicas.',
  '/plantillas-pdf': 'Personaliza cómo se ven tus PDF.',
  '/tributario': 'Fechas y obligaciones con Hacienda.',
  '/integraciones/correo-imap': 'Trae DTEs desde tu correo automáticamente.',
  '/configuraciones': 'Tu cuenta, plan y preferencias.',
  '/notificaciones': 'Avisos importantes de tu cuenta.',
  '/organizacion/kyc': 'Datos fiscales de tu empresa.',
  '/usuarios': 'Gestiona tu equipo.',
  '/admin/users': 'Administración de usuarios.',
  '/admin/access-requests': 'Solicitudes de acceso pendientes.',
  '/admin/planes': 'Configuración de planes.',
  '/admin/avisos': 'Avisos para usuarios.',
  '/admin/obligacion': 'Calendario tributario.',
  '/admin/monitoreo': 'Estadísticas y monitoreo.',
};

const CHILD_OPTION_HINTS: Record<string, string> = {
  '/verificadorDTE/verificador': 'valida DTEs desde un Excel con enlaces',
  '/verificadorDTE/verificarodyfecha': 'verifica por código y fecha',
  '/verificadorDTE/verificadorjson': 'revisa archivos JSON',
  '/verificadorDTE/verificacion_individual': 'consulta un DTE a la vez',
  '/verificadorDTE/verificador-qr': 'escanea códigos QR',
  '/consultas-lotes/codigo-lote': 'consulta por código de lote',
  '/consultas-lotes/excel-codigo-fecha': 'consulta masiva con Excel',
  '/consultas-lotes/json': 'sube archivos JSON',
  '/consultas-lotes/individual': 'consulta individual de lote',
  '/consultas-lotes/qr-pdf': 'lee QR desde PDF',
  '/extraer/compras-json': 'extrae datos de compras',
  '/extraer/ventas-json': 'extrae datos de ventas',
  '/extraer/sujetos-excluidos': 'extrae sujetos excluidos',
  '/extraer/liquidacion-json': 'extrae liquidaciones',
  '/escaneos-mobile': 'revisa escaneos de la app móvil',
  '/facturacion/consumidor-final': 'emite factura consumidor final',
  '/facturacion/credito-fiscal': 'emite crédito fiscal',
  '/facturacion/exportacion': 'emite factura de exportación',
  '/facturacion/nota-credito': 'emite nota de crédito',
  '/facturacion/nota-debito': 'emite nota de débito',
  '/facturacion/sujeto-excluido': 'emite sujeto excluido',
  '/facturacion/envio-lotes': 'envía lotes a Hacienda',
  '/facturacion/reporte': 'consulta reportes de emisión',
  '/facturacion/prueba-emision': 'prueba antes de emitir en producción',
  '/facturacion/receptores': 'administra tus clientes receptores',
  '/admin/monitoreo/visitantes': 'visitas a la página pública',
  '/admin/monitoreo/procesamiento': 'archivos procesados',
  '/admin/monitoreo/inicios-sesion': 'inicios de sesión',
  '/admin/monitoreo/licencias': 'gestión de licencias',
  '/admin/obligacion': 'obligaciones fiscales',
};

const NAVBAR_SECTIONS: Array<{
  selector: string;
  title: string;
  description: string;
  optional?: boolean;
}> = [
  {
    selector: '[data-tour="navbar-sidebar-toggle"]',
    title: 'Mostrar u ocultar menú',
    description:
      'Con este botón abres o cierras el panel lateral. En móvil despliega el menú completo; en escritorio lo hace más compacto para ganar espacio.',
  },
  {
    selector: '[data-tour="navbar-breadcrumb"]',
    title: 'Dónde estás',
    description:
      'La ruta superior te indica en qué sección te encuentras. Puedes pulsar los enlaces para volver a páginas anteriores.',
    optional: true,
  },
  {
    selector: '[data-tour="navbar-language"]',
    title: 'Idioma',
    description:
      'Elige español (ES) o inglés (EN) para ver la aplicación en el idioma que prefieras.',
    optional: true,
  },
  {
    selector: '[data-tour="navbar-theme"]',
    title: 'Modo claro u oscuro',
    description:
      'Cambia el aspecto de la aplicación entre modo claro y oscuro según tu comodidad.',
    optional: true,
  },
  {
    selector: '[data-tour="navbar-notifications"]',
    title: 'Notificaciones',
    description:
      'Revisa avisos importantes de tu cuenta. El punto rojo indica que tienes mensajes sin leer; también puedes ver el historial completo.',
  },
  {
    selector: '[data-tour="user-menu-trigger"]',
    title: 'Tu cuenta',
    description:
      'Desde aquí accedes a tu perfil, configuración, guías de ayuda de cada página y cerrar sesión. En móvil también cambias idioma y tema.',
  },
];

const DASHBOARD_SECTIONS: Array<{
  selector: string;
  title: string;
  description: string;
  optional?: boolean;
  dynamic?: 'mfa';
}> = [
  {
    selector: '[data-tour="dashboard-activity"]',
    title: 'Tu actividad de un vistazo',
    description:
      'Este gráfico muestra cuántos procesos hiciste y cuántos salieron bien. Puedes verlo por día, semana o mes, y actualizar cuando quieras.',
  },
  {
    selector: '[data-tour="dashboard-hero"]',
    title: 'Tu resumen personal',
    description:
      'Aquí ves cuántos registros llevas, cuántos procesos has hecho y cómo va tu perfil. También aparece tu plan actual.',
  },
  {
    selector: '[data-tour="dashboard-modules"]',
    title: '¿Qué herramientas usas más?',
    description:
      'Te mostramos en cuáles secciones has trabajado más, para que sepas dónde concentras tu actividad.',
  },
  {
    selector: '[data-tour="dashboard-actions"]',
    title: 'Tu actividad reciente',
    description:
      'Aquí ves lo último que procesaste: qué herramienta usaste, cuándo y cómo salió. Te ayuda a retomar tu trabajo rápidamente.',
  },
  {
    selector: '[data-tour="dashboard-mfa"]',
    title: 'Protege tu cuenta (2FA)',
    description: '', // se rellena según totpEnabled
    dynamic: 'mfa' as const,
  },
  {
    selector: '[data-tour="dashboard-mobile-app"]',
    title: 'Descarga la app móvil',
    description:
      'Lleva el escaneo de DTEs en tu bolsillo.\n\n• Escanea el código QR con tu celular Android\n• O pulsa "Descargar APK" para instalar KaiserQRmobile directamente\n\nCon la app puedes escanear documentos y enviarlos a tu cuenta.',
  },
  {
    selector: '[data-tour="dashboard-users"]',
    title: 'Tu equipo',
    description:
      'Si administras usuarios, aquí ves quién está activo y si hay invitaciones pendientes por aceptar.',
    optional: true,
  },
];

function sectionIntro(item: SidebarTourItem) {
  return SIDEBAR_SECTION_INTRO[item.href] ?? `Acceso a ${item.label}.`;
}

function formatPermittedOptions(item: SidebarTourItem) {
  if (!item.children?.length) {
    return `Tu plan incluye acceso directo a ${item.label}. Pulsa el icono cuando quieras entrar.`;
  }

  const lines: string[] = [
    'Estas son las opciones incluidas en tu plan y permisos actuales:',
    '',
  ];

  let currentGroup: string | undefined;

  for (const child of item.children) {
    if (child.group && child.group !== currentGroup) {
      currentGroup = child.group;
      lines.push(`${currentGroup}:`);
    }

    const hint = CHILD_OPTION_HINTS[child.href];
    lines.push(hint ? `• ${child.label} — ${hint}` : `• ${child.label}`);
  }

  lines.push('', 'Pulsa cualquiera en el panel de la derecha para abrirla.');

  return lines.join('\n');
}

function refreshDriverHighlight(_element: Element | undefined, _step: DriveStep, opts: { driver: { refresh: () => void } }) {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      opts.driver.refresh();
    });
  });
}

function buildSidebarSteps(items: SidebarTourItem[]): DriveStep[] {
  const steps: DriveStep[] = [];

  for (const item of items) {
    const hasChildren = Boolean(item.children?.length);

    steps.push({
      element: sidebarNavTourSelector(item.href),
      onHighlightStarted: () => {
        selectSidebarSectionForTour(item.href);
      },
      popover: {
        title: item.label,
        description: hasChildren
          ? `${sectionIntro(item)} Pulsa "Ver mis opciones" para conocer qué herramientas tienes disponibles.`
          : sectionIntro(item),
        side: 'right',
        align: 'start',
        ...(hasChildren ? { nextBtnText: 'Ver mis opciones' } : {}),
      },
    });

    if (hasChildren) {
      steps.push({
        element: '[data-tour="sidebar-submenu-panel"]',
        onHighlightStarted: (_element, _step, opts) => {
          selectSidebarSectionForTour(item.href);
          refreshDriverHighlight(_element, _step, opts);
        },
        popover: {
          title: `Tus opciones en ${item.label}`,
          description: formatPermittedOptions(item),
          side: 'right',
          align: 'start',
        },
      });
    }
  }

  return steps;
}

function mfaTourDescription(totpEnabled: boolean) {
  if (totpEnabled) {
    return [
      '¡Ya tienes la verificación en dos pasos activa! Tu cuenta está más protegida.',
      '',
      'Para revisar o cambiar la configuración:',
      '1. Pulsa "Gestionar seguridad"',
      '2. En tu perfil puedes ver el estado del 2FA o desactivarlo si lo necesitas',
    ].join('\n');
  }

  return [
    'Te recomendamos activar la verificación en dos pasos (2FA) para proteger tu cuenta.',
    '',
    'Pasos para activarla:',
    '1. Pulsa "Activar TOTP" en esta tarjeta',
    '2. En tu perfil, escanea el código QR con Google Authenticator, Authy u otra app similar',
    '3. Escribe el código de 6 dígitos que te muestra la app',
    '4. ¡Listo! La próxima vez que entres te pediremos ese código',
  ].join('\n');
}

function buildNavbarSteps(): DriveStep[] {
  if (typeof document === 'undefined') return [];

  return NAVBAR_SECTIONS.flatMap((section) => {
    if (section.optional && !document.querySelector(section.selector)) {
      return [];
    }

    return [
      {
        element: section.selector,
        popover: {
          title: section.title,
          description: section.description,
          side: 'bottom' as const,
          align: 'end' as const,
        },
      },
    ];
  });
}

function buildDashboardSectionSteps(totpEnabled: boolean): DriveStep[] {
  if (typeof document === 'undefined') return [];

  return DASHBOARD_SECTIONS.flatMap((section) => {
    if (section.optional && !document.querySelector(section.selector)) {
      return [];
    }

    const description =
      section.dynamic === 'mfa' ? mfaTourDescription(totpEnabled) : section.description;

    return [
      {
        element: section.selector,
        popover: {
          title: section.title,
          description,
          side: 'bottom' as const,
          align: 'start' as const,
        },
      },
    ];
  });
}

export function buildDashboardTourSteps(
  sidebarItems: SidebarTourItem[],
  totpEnabled = false,
): DriveStep[] {
  const steps: DriveStep[] = [
    {
      popover: {
        title: '¡Bienvenido a tu inicio!',
        description:
          'Te hacemos un recorrido rápido por el menú y las secciones de esta página. Solo te tomará un minuto y puedes saltarlo cuando quieras.',
        side: 'over',
        align: 'center',
      },
    },
    {
      element: '[data-tour="sidebar-nav-rail"]',
      popover: {
        title: 'Tu menú principal',
        description:
          'Cada icono es una sección distinta. En algunas te mostraremos, al pulsar Siguiente, las herramientas que tienes habilitadas según tu plan.',
        side: 'right',
        align: 'start',
      },
    },
    ...buildSidebarSteps(sidebarItems),
    {
      popover: {
        title: 'Barra superior',
        description:
          'Arriba tienes accesos rápidos: menú, idioma, notificaciones y tu cuenta. Veamos cada uno.',
        side: 'over',
        align: 'center',
      },
    },
    ...buildNavbarSteps(),
    {
      popover: {
        title: 'Ahora, tu página de inicio',
        description: 'Veamos qué información tienes aquí para seguir tu trabajo del día a día.',
        side: 'over',
        align: 'center',
      },
    },
    ...buildDashboardSectionSteps(totpEnabled),
  ];

  return steps;
}
