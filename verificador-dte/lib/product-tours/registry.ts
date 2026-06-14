import type { DriveStep } from 'driver.js';

import type { SidebarTourItem } from '@/lib/product-tours/sidebar-tour-registry';
import { buildDashboardTourSteps, DASHBOARD_TOUR_ID } from '@/lib/product-tours/tours/dashboard';
import { VERIFICADOR_TOURS } from '@/lib/product-tours/tours/verificador-tours';

export type ProductTourBuildContext = {
  sidebarItems: SidebarTourItem[];
  dashboard?: {
    totpEnabled: boolean;
  };
};

export type ProductTourDefinition = {
  id: string;
  pathname: string;
  label: string;
  steps: DriveStep[];
  deferredSteps?: DriveStep[];
  getSteps?: (context: ProductTourBuildContext) => DriveStep[];
};

export const PRODUCT_TOURS: ProductTourDefinition[] = [
  {
    id: DASHBOARD_TOUR_ID,
    pathname: '/dashboard',
    label: 'Guia del dashboard',
    steps: [],
    getSteps: ({ sidebarItems, dashboard }) =>
      buildDashboardTourSteps(sidebarItems, dashboard?.totpEnabled ?? false),
  },
  ...VERIFICADOR_TOURS,
];

export function resolveTourSteps(
  tour: ProductTourDefinition,
  context: ProductTourBuildContext,
): DriveStep[] {
  if (tour.getSteps) {
    return tour.getSteps(context);
  }
  return tour.steps;
}

export function getTourByPathname(pathname: string) {
  return PRODUCT_TOURS.find((tour) => tour.pathname === pathname) ?? null;
}

export function getTourById(tourId: string) {
  return PRODUCT_TOURS.find((tour) => tour.id === tourId) ?? null;
}
