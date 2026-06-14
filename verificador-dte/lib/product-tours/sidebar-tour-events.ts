export const SIDEBAR_TOUR_ENSURE_EXPANDED_EVENT = 'sidebar-tour:ensure-expanded';
export const SIDEBAR_TOUR_SELECT_SECTION_EVENT = 'sidebar-tour:select-section';

export function ensureSidebarExpandedForTour() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(SIDEBAR_TOUR_ENSURE_EXPANDED_EVENT));
}

export function selectSidebarSectionForTour(href: string) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(SIDEBAR_TOUR_SELECT_SECTION_EVENT, { detail: { href } }));
}

export function sidebarTourSlug(href: string) {
  return href.replace(/^\//, '').replace(/\//g, '-');
}

export function sidebarNavTourSelector(href: string) {
  return `[data-tour="sidebar-nav-${sidebarTourSlug(href)}"]`;
}
