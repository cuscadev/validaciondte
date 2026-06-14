'use client';

import 'driver.js/dist/driver.css';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import { usePathname } from 'next/navigation';

import { useAuth } from '@/components/AuthProvider';
import {
  getTourById,
  getTourByPathname,
  resolveTourSteps,
  type ProductTourDefinition,
} from '@/lib/product-tours/registry';
import { runProductTour, runReactivationHint, type ProductTourHandle } from '@/lib/product-tours/run-product-tour';
import {
  PageTourRegistryProvider,
  useDashboardTourContext,
} from '@/lib/product-tours/page-tour-registry';
import {
  SidebarTourRegistryProvider,
  useSidebarTourItems,
  type SidebarTourItem,
} from '@/lib/product-tours/sidebar-tour-registry';
import { ensureSidebarExpandedForTour } from '@/lib/product-tours/sidebar-tour-events';
import { DASHBOARD_TOUR_ID } from '@/lib/product-tours/tours/dashboard';
import { UPLOAD_VERIFIER_RESULTS_READY_EVENT } from '@/lib/product-tours/tours/upload-verifier-tour';
import {
  clearTourAwaitingResults,
  getProductTourStatus,
  isTourAwaitingResults,
  resetProductTourStatus,
  setProductTourStatus,
  setTourAwaitingResults,
} from '@/lib/product-tours/storage';
import { waitForTourTargets } from '@/lib/product-tours/wait-for-tour-targets';

type ProductTourContextValue = {
  currentTour: ProductTourDefinition | null;
  restartCurrentTour: () => void;
};

const ProductTourContext = createContext<ProductTourContextValue | null>(null);

export function useProductTour() {
  return useContext(ProductTourContext);
}

async function waitForSidebarTourItems(
  readItems: () => SidebarTourItem[],
  timeoutMs = 8000,
) {
  const startedAt = Date.now();

  return new Promise<void>((resolve) => {
    function check() {
      if (readItems().length > 0 || Date.now() - startedAt >= timeoutMs) {
        resolve();
        return;
      }
      window.setTimeout(check, 200);
    }

    check();
  });
}

function ProductTourProviderInner({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { firebaseUser } = useAuth();
  const userId = firebaseUser?.uid ?? null;
  const sidebarItems = useSidebarTourItems();
  const dashboardTourContext = useDashboardTourContext();
  const sidebarItemsRef = useRef(sidebarItems);
  sidebarItemsRef.current = sidebarItems;
  const dashboardTourContextRef = useRef(dashboardTourContext);
  dashboardTourContextRef.current = dashboardTourContext;

  const activeTourRef = useRef<ProductTourHandle | null>(null);
  const autostartSessionRef = useRef<string | null>(null);
  const awaitingResultsTourIdRef = useRef<string | null>(null);
  const pathnameRef = useRef(pathname);

  const currentTour = useMemo(() => getTourByPathname(pathname), [pathname]);

  const resolveSteps = useCallback(
    (tour: ProductTourDefinition) =>
      resolveTourSteps(tour, {
        sidebarItems: sidebarItemsRef.current,
        dashboard: dashboardTourContextRef.current ?? undefined,
      }),
    [],
  );

  const destroyActiveTour = useCallback((silent = true) => {
    activeTourRef.current?.destroy({ silent });
    activeTourRef.current = null;
  }, []);

  const finishTour = useCallback(
    (tourId: string, result: 'completed' | 'dismissed') => {
      if (!userId) return;
      setProductTourStatus(userId, tourId, result);
      clearTourAwaitingResults(userId, tourId);
      awaitingResultsTourIdRef.current = null;
      activeTourRef.current = null;
    },
    [userId],
  );

  const prepareTourLaunch = useCallback(async (tour: ProductTourDefinition) => {
    if (tour.id === DASHBOARD_TOUR_ID) {
      await waitForSidebarTourItems(() => sidebarItemsRef.current);
      ensureSidebarExpandedForTour();
      await new Promise((resolve) => window.setTimeout(resolve, 450));
    }
  }, []);

  const showDeferredSteps = useCallback(
    (tour: ProductTourDefinition) => {
      if (!userId || !tour.deferredSteps?.length) return;

      destroyActiveTour(true);

      void waitForTourTargets(tour.deferredSteps).then((ready) => {
        if (!ready || pathnameRef.current !== tour.pathname) return;

        activeTourRef.current = runProductTour({
          steps: tour.deferredSteps!,
          onFinished: (result) => {
            finishTour(tour.id, result === 'completed' ? 'completed' : 'dismissed');
          },
          onDismissed: () => {
            window.setTimeout(() => {
              activeTourRef.current = runReactivationHint();
            }, 350);
          },
        });
      });
    },
    [destroyActiveTour, finishTour, userId],
  );

  const startTour = useCallback(
    async (tour: ProductTourDefinition, { force = false }: { force?: boolean } = {}) => {
      if (!userId || typeof window === 'undefined') return;

      destroyActiveTour(true);
      awaitingResultsTourIdRef.current = null;
      clearTourAwaitingResults(userId, tour.id);

      if (!force && getProductTourStatus(userId, tour.id) !== 'pending') {
        return;
      }

      await prepareTourLaunch(tour);

      const steps = resolveSteps(tour);
      if (steps.length === 0) return;

      const hasDeferredSteps = Boolean(tour.deferredSteps?.length);

      activeTourRef.current = runProductTour({
        steps,
        onDeferRemaining: hasDeferredSteps
          ? () => {
              awaitingResultsTourIdRef.current = tour.id;
              setTourAwaitingResults(userId, tour.id);
            }
          : undefined,
        onFinished: (result) => {
          finishTour(tour.id, result === 'completed' ? 'completed' : 'dismissed');
        },
        onDismissed: () => {
          window.setTimeout(() => {
            activeTourRef.current = runReactivationHint();
          }, 350);
        },
      });
    },
    [destroyActiveTour, finishTour, prepareTourLaunch, resolveSteps, userId],
  );

  const restartCurrentTour = useCallback(() => {
    if (!currentTour || !userId) return;
    resetProductTourStatus(userId, currentTour.id);
    autostartSessionRef.current = null;
    awaitingResultsTourIdRef.current = null;
    void (async () => {
      await prepareTourLaunch(currentTour);
      const steps = resolveSteps(currentTour);
      await waitForTourTargets(steps);
      startTour(currentTour, { force: true });
    })();
  }, [currentTour, prepareTourLaunch, resolveSteps, startTour, userId]);

  useEffect(() => {
    pathnameRef.current = pathname;
    autostartSessionRef.current = null;
    awaitingResultsTourIdRef.current = null;
    if (userId && currentTour) clearTourAwaitingResults(userId, currentTour.id);
    destroyActiveTour(true);
  }, [pathname, destroyActiveTour, userId, currentTour]);

  useEffect(() => {
    if (!currentTour || !userId) return;

    const sessionKey = `${userId}:${currentTour.id}:${pathname}`;
    if (autostartSessionRef.current === sessionKey) return;

    const status = getProductTourStatus(userId, currentTour.id);
    if (status !== 'pending') {
      autostartSessionRef.current = sessionKey;
      return;
    }

    let cancelled = false;

    const launch = async () => {
      await prepareTourLaunch(currentTour);
      const steps = resolveSteps(currentTour);
      await waitForTourTargets(steps);
      if (cancelled || pathnameRef.current !== pathname) return;

      autostartSessionRef.current = sessionKey;
      startTour(currentTour);
    };

    const timer = window.setTimeout(() => {
      void launch();
    }, 500);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [currentTour, pathname, prepareTourLaunch, resolveSteps, startTour, userId]);

  useEffect(() => {
    function handleResultsReady(event: Event) {
      if (!currentTour?.deferredSteps?.length || !userId) return;

      const tourId = (event as CustomEvent<{ tourId?: string }>).detail?.tourId;
      if (!tourId || tourId !== currentTour.id) return;
      if (!isTourAwaitingResults(userId, currentTour.id)) return;

      clearTourAwaitingResults(userId, currentTour.id);
      awaitingResultsTourIdRef.current = null;
      showDeferredSteps(currentTour);
    }

    window.addEventListener(UPLOAD_VERIFIER_RESULTS_READY_EVENT, handleResultsReady);
    return () => window.removeEventListener(UPLOAD_VERIFIER_RESULTS_READY_EVENT, handleResultsReady);
  }, [currentTour, showDeferredSteps, userId]);

  useEffect(() => {
    return () => {
      destroyActiveTour(true);
    };
  }, [destroyActiveTour]);

  useEffect(() => {
    function handleRestart(event: Event) {
      const tourId = (event as CustomEvent<{ tourId?: string }>).detail?.tourId;
      const tour = tourId ? getTourById(tourId) : currentTour;
      if (!tour || !userId) return;
      resetProductTourStatus(userId, tour.id);
      autostartSessionRef.current = null;
      awaitingResultsTourIdRef.current = null;
      void (async () => {
        await prepareTourLaunch(tour);
        const steps = resolveSteps(tour);
        await waitForTourTargets(steps);
        startTour(tour, { force: true });
      })();
    }

    window.addEventListener('product-tour:restart', handleRestart);
    return () => window.removeEventListener('product-tour:restart', handleRestart);
  }, [currentTour, prepareTourLaunch, resolveSteps, startTour, userId]);

  const value = useMemo(
    () => ({
      currentTour,
      restartCurrentTour,
    }),
    [currentTour, restartCurrentTour],
  );

  return <ProductTourContext.Provider value={value}>{children}</ProductTourContext.Provider>;
}

export function ProductTourProvider({ children }: { children: ReactNode }) {
  return (
    <PageTourRegistryProvider>
      <SidebarTourRegistryProvider>
        <ProductTourProviderInner>{children}</ProductTourProviderInner>
      </SidebarTourRegistryProvider>
    </PageTourRegistryProvider>
  );
}
