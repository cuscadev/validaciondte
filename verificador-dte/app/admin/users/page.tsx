'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { onAuthStateChanged } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import {
  Activity,
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CheckCircle2,
  FileText,
  Percent,
  ShieldCheck,
  SlidersHorizontal,
  UserPlus,
  Users,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';

import { UserForm } from '@/components/admin/UserForm';
import { PlanRouteSelector } from '@/components/admin/PlanRouteSelector';
import { UserTable, type UserTableRow } from '@/components/admin/UserTable';
import { UserTableSearch } from '@/components/admin/UserTableExtras';
import {
  OrgMembersPanel,
  type OrgMembersDetail,
} from '@/components/admin/OrgMembersPanel';
import { Modal } from '@/components/ui/modal';
import { TABLE_HEAD } from '@/lib/ui/table-classes';
import { Button } from '@/components/ui/button';
import {
  AppUser,
  MembershipType,
  UsageLimits,
  UserRole,
  getAllUsers,
  getUser,
} from '@/lib/firestoreUser';
import { PLAN_ROUTE_GROUPS, getFallbackRoutesForPlan } from '@/lib/plan-routes';
import type { RouteAccessOverride } from '@/lib/route-access-overrides';
import { auth } from '@/lib/firebase';
import { QUERY_CACHE_MS } from '@/components/QueryProvider';
import {
  invalidateGetQueries,
  useGetQuery,
} from '@/lib/tanstack-query';
import type {
  DashboardModuleStat,
  DashboardRecentLog,
  DashboardStatsTotals,
} from '@/lib/dashboard-stats';

type UserFormState = Partial<AppUser> & { password?: string };
type LimitDraft = Record<string, string>;

type ClientApiRow = {
  uid: string;
  email: string;
  displayName?: string;
  organizationId: string;
  organization: {
    name: string;
    displayTitle?: string;
    displaySubtitle?: string | null;
    allowedEmailDomain: string;
    membershipType: string;
    maxCollaborators: number;
    collaboratorCount: number;
    status: string;
    kycCompleted: boolean;
  } | null;
};

type AdminOrganizationsResponse = {
  clients: ClientApiRow[];
};

type AdminOrganizationDetailResponse = {
  organization: OrgMembersDetail['organization'];
  owner: OrgMembersDetail['owner'];
  collaborators: OrgMembersDetail['collaborators'];
};

const LIMIT_ROUTES = PLAN_ROUTE_GROUPS.flatMap((group) => group.routes);
const INHERIT_LIMIT_VALUE = '';
const UNLIMITED_LIMIT_VALUE = 'unlimited';
const RENEWAL_DATE_DRAFT_KEY = '__renewalDate';
const AUTOMATIC_RESET_DRAFT_KEY = '__automaticReset';

function batchDraftKey(routeKey: string) {
  return `batch:${routeKey}`;
}

type AdminOrganizationStatsMember = {
  uid: string;
  email: string;
  displayName: string;
  role: 'cliente' | 'colaborador';
  orgRole?: string;
  totals: DashboardStatsTotals;
  byModule: DashboardModuleStat[];
  recent: DashboardRecentLog[];
};

type AdminOrganizationStatsResponse = {
  period: { from: string; to: string };
  organization: {
    id: string;
    name: string;
    displayTitle?: string;
    displaySubtitle?: string | null;
    collaboratorCount: number;
    maxCollaborators: number;
    membershipType: string;
    status: string;
  };
  totals: DashboardStatsTotals;
  byModule: DashboardModuleStat[];
  recent: DashboardRecentLog[];
  members: AdminOrganizationStatsMember[];
};

type UsageRouteRow = {
  key: string;
  label: string;
  groupKey: string;
  groupLabel: string;
  limit: number | null;
  used: number;
  fromLogs: number;
  adjustment: number;
  remaining: number | null;
};

type AdminUsageLimitsResponse = {
  uid: string;
  monthKey: string;
  resetDayOfMonth: number;
  renewalDate?: string;
  automaticReset: boolean;
  periodStart: string;
  routes: UsageRouteRow[];
};

const ORGANIZATIONS_QUERY_KEY = ['admin', 'organizations'] as const;
const PLANS_QUERY_KEY = ['admin', 'plans'] as const;
const ROLE_FILTERS = [
  { id: 'all', label: 'Todos' },
  { id: 'superadmin', label: 'Superadmin' },
  { id: 'cliente', label: 'Clientes' },
  { id: 'colaborador', label: 'Colaboradores' },
] as const;

type RoleFilter = (typeof ROLE_FILTERS)[number]['id'];

function getErrorMessage(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}

function limitValueToDraft(value: number | null | undefined) {
  if (value === null) return UNLIMITED_LIMIT_VALUE;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return INHERIT_LIMIT_VALUE;
}

function limitsToDraft(limits?: UsageLimits): LimitDraft {
  const draft: LimitDraft = {};
  draft[RENEWAL_DATE_DRAFT_KEY] = limits?.renewalDate || INHERIT_LIMIT_VALUE;
  draft[AUTOMATIC_RESET_DRAFT_KEY] =
    typeof limits?.automaticReset === 'boolean'
      ? String(limits.automaticReset)
      : INHERIT_LIMIT_VALUE;
  for (const route of LIMIT_ROUTES) {
    const hasMobileLimit =
      route.key === 'escaneos-mobile' &&
      Object.prototype.hasOwnProperty.call(limits || {}, 'mobileScanFolderLimit');
    const value = hasMobileLimit
      ? limits?.mobileScanFolderLimit
      : limits?.routeLimits?.[route.key];
    draft[route.key] = limitValueToDraft(value);
    draft[batchDraftKey(route.key)] = limitValueToDraft(limits?.batchLimits?.[route.key]);
  }
  return draft;
}

function draftToLimits(draft: LimitDraft): UsageLimits {
  const routeLimits: Record<string, number | null> = {};
  const batchLimits: Record<string, number | null> = {};
  let mobileScanFolderLimit: number | null | undefined;
  const renewalDate = String(draft[RENEWAL_DATE_DRAFT_KEY] || '').trim() || undefined;
  const automaticResetRaw = String(draft[AUTOMATIC_RESET_DRAFT_KEY] || '').trim();
  const automaticReset =
    automaticResetRaw === 'true' ? true : automaticResetRaw === 'false' ? false : undefined;
  const resetDayOfMonth = renewalDate
    ? Math.min(31, Math.max(1, Number(renewalDate.slice(8, 10)) || 1))
    : undefined;

  for (const route of LIMIT_ROUTES) {
    const raw = String(draft[route.key] ?? '').trim();
    if (raw) {
      const value = raw === UNLIMITED_LIMIT_VALUE ? null : Math.max(1, Number(raw) || 1);
      if (route.key === 'escaneos-mobile') {
        mobileScanFolderLimit = value;
      } else {
        routeLimits[route.key] = value;
      }
    }

    const batchRaw = String(draft[batchDraftKey(route.key)] ?? '').trim();
    if (batchRaw) {
      batchLimits[route.key] =
        batchRaw === UNLIMITED_LIMIT_VALUE ? null : Math.max(1, Number(batchRaw) || 1);
    }
  }

  return {
    ...(Object.keys(routeLimits).length ? { routeLimits } : {}),
    ...(Object.keys(batchLimits).length ? { batchLimits } : {}),
    ...(mobileScanFolderLimit !== undefined ? { mobileScanFolderLimit } : {}),
    ...(resetDayOfMonth !== undefined ? { resetDayOfMonth } : {}),
    ...(renewalDate !== undefined ? { renewalDate } : {}),
    ...(automaticReset !== undefined ? { automaticReset } : {}),
  };
}

export default function UsersAdminPage() {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [error, setError] = useState('');
  const [checkingRole, setCheckingRole] = useState(true);
  const [form, setForm] = useState<UserFormState>({});
  const [editMode, setEditMode] = useState<string | null>(null);
  const [delegateUser, setDelegateUser] = useState<UserTableRow | null>(null);
  const [statsUser, setStatsUser] = useState<UserTableRow | null>(null);
  const [limitsUser, setLimitsUser] = useState<UserTableRow | null>(null);
  const [permissionsUser, setPermissionsUser] = useState<UserTableRow | null>(null);
  const [delegateLimit, setDelegateLimit] = useState('');
  const [orgLimitDraft, setOrgLimitDraft] = useState<LimitDraft>({});
  const [userLimitDraft, setUserLimitDraft] = useState<LimitDraft>({});
  const [userRouteAccessDraft, setUserRouteAccessDraft] = useState<RouteAccessOverride | undefined>();
  const [usageAdjustments, setUsageAdjustments] = useState<Record<string, string>>({});
  const router = useRouter();
  const queryClient = useQueryClient();

  const orgsQuery = useGetQuery<AdminOrganizationsResponse, ClientApiRow[]>({
    queryKey: ORGANIZATIONS_QUERY_KEY,
    path: '/api/admin/organizations',
    enabled: !checkingRole,
    overrides: {
      select: (data) => data.clients ?? [],
    },
  });

  const plansQuery = useGetQuery<Record<string, { allowedRoutes?: string[] }>>({
    queryKey: PLANS_QUERY_KEY,
    path: '/api/planes',
    enabled: !checkingRole,
  });

  const orgClients = orgsQuery.data ?? [];
  const detailOrgId = delegateUser?.organizationId || delegateUser?.uid || null;
  const orgDetailQuery = useGetQuery<
    AdminOrganizationDetailResponse,
    OrgMembersDetail
  >({
    queryKey: ['admin', 'organizations', detailOrgId],
    path: `/api/admin/organizations/${detailOrgId}`,
    enabled: !checkingRole && detailOrgId !== null,
    overrides: {
      select: (data): OrgMembersDetail => ({
        organization: data.organization,
        owner: data.owner,
        collaborators: data.collaborators ?? [],
      }),
    },
  });
  const orgByOwnerUid = useMemo(() => {
    const map = new Map<string, ClientApiRow>();
    orgClients.forEach((client) => map.set(client.uid, client));
    return map;
  }, [orgClients]);
  const statsOrgId = statsUser?.organizationId || statsUser?.uid || null;
  const orgStatsQuery = useGetQuery<AdminOrganizationStatsResponse>({
    queryKey: ['admin', 'organizations', statsOrgId, 'stats'],
    path: statsOrgId
      ? `/api/admin/organizations/${statsOrgId}/stats`
      : '/api/admin/organizations/_/stats',
    enabled: !checkingRole && statsOrgId !== null,
  });
  const usageQuery = useGetQuery<AdminUsageLimitsResponse>({
    queryKey: ['admin', 'usage-limits', limitsUser?.uid || ''],
    path: limitsUser?.uid
      ? `/api/admin/usage-limits?uid=${encodeURIComponent(limitsUser.uid)}`
      : '/api/admin/usage-limits',
    enabled: !checkingRole && limitsUser !== null,
  });
  const delegateUsageUid = delegateUser?.uid || '';
  const delegateUsageQuery = useGetQuery<AdminUsageLimitsResponse>({
    queryKey: ['admin', 'usage-limits', delegateUsageUid],
    path: delegateUsageUid
      ? `/api/admin/usage-limits?uid=${encodeURIComponent(delegateUsageUid)}`
      : '/api/admin/usage-limits',
    enabled: !checkingRole && delegateUser !== null,
  });

  const fetchUsers = useCallback(async () => {
    try {
      const data = await queryClient.fetchQuery({
        queryKey: ['users'],
        queryFn: getAllUsers,
        staleTime: QUERY_CACHE_MS,
        gcTime: QUERY_CACHE_MS * 4,
      });
      setUsers(data);
    } catch (err) {
      setError(getErrorMessage(err, 'No se pudieron cargar los usuarios.'));
    }
  }, [queryClient]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push('/login');
        return;
      }

      const appUser = await queryClient.fetchQuery({
        queryKey: ['users', user.uid],
        queryFn: () => getUser(user.uid),
        staleTime: QUERY_CACHE_MS,
        gcTime: QUERY_CACHE_MS * 4,
      });
      if (!appUser || appUser.role !== 'superadmin') {
        router.push('/');
        return;
      }

      setCheckingRole(false);
      await fetchUsers();
    });
    return () => unsubscribe();
  }, [fetchUsers, queryClient, router]);

  useEffect(() => {
    if (orgsQuery.error) {
      setError(getErrorMessage(orgsQuery.error, 'No se pudieron cargar los cupos de clientes.'));
    }
  }, [orgsQuery.error]);

  useEffect(() => {
    if (orgDetailQuery.error) {
      setError(getErrorMessage(orgDetailQuery.error, 'No se pudo cargar el detalle del cliente.'));
    }
  }, [orgDetailQuery.error]);

  useEffect(() => {
    if (orgDetailQuery.data?.organization?.limits) {
      setOrgLimitDraft(limitsToDraft(orgDetailQuery.data.organization.limits));
    } else if (delegateUser) {
      setOrgLimitDraft(limitsToDraft());
    }
  }, [delegateUser, orgDetailQuery.data?.organization?.limits]);

  useEffect(() => {
    if (orgStatsQuery.error) {
      setError(getErrorMessage(orgStatsQuery.error, 'No se pudieron cargar las estadisticas del cliente.'));
    }
  }, [orgStatsQuery.error]);

  function openCreateModal() {
    setForm({});
    setEditMode(null);
    setModalOpen(true);
  }

  function openEditModal(row: UserTableRow) {
    const user = users.find((u) => u.uid === row.uid);
    setForm({
      uid: row.uid,
      email: row.email,
      role: row.role as UserRole,
      membership: {
        type: (user?.membership?.type ?? row.membershipType ?? 'free') as MembershipType,
        expiresAt: user?.membership?.expiresAt ?? row.membershipExpiresAt ?? '',
      },
    });
    setEditMode(row.uid);
    setModalOpen(true);
  }

  function handleFormChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  function handleMembershipTypeChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setForm({
      ...form,
      membership: {
        type: e.target.value as MembershipType,
        expiresAt: form.membership?.expiresAt || '',
      },
    });
  }

  function handleMembershipExpiresChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm({
      ...form,
      membership: {
        type: form.membership?.type || 'free',
        expiresAt: e.target.value,
      },
    });
  }

  async function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.uid || !form.email || !form.role || !form.membership?.type) return;
    const token = await auth.currentUser?.getIdToken();
    if (!token) throw new Error('No autorizado');

    const userData: AppUser = {
      uid: form.uid,
      email: form.email,
      role: form.role as UserRole,
      membership: {
        type: form.membership.type as MembershipType,
        expiresAt: form.membership.expiresAt || '',
      },
    };

    const res = await fetch('/api/users/save', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(userData),
    });

    const data = await res.json() as { error?: string };
    if (!res.ok) {
      throw new Error(data.error || 'No se pudo guardar el usuario');
    }

    setForm({});
    setEditMode(null);
    setModalOpen(false);
    await queryClient.invalidateQueries({ queryKey: ['users'] });
    await queryClient.invalidateQueries({ queryKey: ['users', userData.uid] });
    await invalidateGetQueries(queryClient, ORGANIZATIONS_QUERY_KEY);
    await fetchUsers();
    toast.success('Usuario guardado');
  }

  async function handleDelete(uid: string) {
    if (!confirm('Eliminar este usuario?')) return;
    const token = await auth.currentUser?.getIdToken();
    const res = await fetch('/api/users/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ uid }),
    });
    const data = await res.json().catch(() => ({})) as { error?: string };
    if (!res.ok) {
      toast.error(data.error || 'No se pudo eliminar');
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ['users'] });
    await invalidateGetQueries(queryClient, ORGANIZATIONS_QUERY_KEY);
    await fetchUsers();
    toast.success('Usuario eliminado');
  }

  async function handleSessionAction(uid: string, action: 'forceLogout' | 'block' | 'unblock') {
    const token = await auth.currentUser?.getIdToken();
    const res = await fetch('/api/users/session-control', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ uid, action }),
    });
    const data = await res.json().catch(() => ({})) as { error?: string };
    if (!res.ok) {
      toast.error(data.error || 'No se pudo actualizar el usuario');
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ['users'] });
    await fetchUsers();
    toast.success('Usuario actualizado');
  }

  function openDelegateLimit(row: UserTableRow) {
    if (row.role !== 'cliente') return;
    setDelegateUser(row);
    setDelegateLimit(String(row.maxCollaborators ?? 0));
    setOrgLimitDraft(limitsToDraft());
    setUsageAdjustments({});
  }

  function openClientStats(row: UserTableRow) {
    if (row.role !== 'cliente') return;
    setStatsUser(row);
  }

  function openUserLimits(row: UserTableRow) {
    setLimitsUser(row);
    setUserLimitDraft(limitsToDraft(row.limits));
    setUsageAdjustments({});
  }

  function openUserPermissions(row: UserTableRow) {
    if (row.role === 'superadmin') return;
    setPermissionsUser(row);
    const user = users.find((item) => item.uid === row.uid);
    setUserRouteAccessDraft(user?.routeAccess);
  }

  function handleEditDetailMember(uid: string) {
    const row = tableRows.find((item) => item.uid === uid);
    if (!row) {
      toast.error('No se encontro el usuario para editar.');
      return;
    }
    setDelegateUser(null);
    openEditModal(row);
  }

  async function saveDelegateLimit() {
    if (!delegateUser) return;
    const orgId = delegateUser.organizationId || delegateUser.uid;
    const maxCollaborators = Math.max(0, Number(delegateLimit) || 0);
    const token = await auth.currentUser?.getIdToken();
    const res = await fetch(`/api/admin/organizations/${orgId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ maxCollaborators }),
    });
    const data = await res.json().catch(() => ({})) as { error?: string };
    if (!res.ok) {
      toast.error(data.error || 'No se pudo actualizar el cupo');
      return;
    }
    await invalidateGetQueries(queryClient, ORGANIZATIONS_QUERY_KEY);
    await invalidateGetQueries(queryClient, ['admin', 'organizations', orgId]);
    setDelegateUser(null);
    setDelegateLimit('');
    toast.success('Cupo de delegados actualizado');
  }

  async function saveOrganizationLimits() {
    if (!delegateUser) return;
    const orgId = delegateUser.organizationId || delegateUser.uid;
    const token = await auth.currentUser?.getIdToken();
    const res = await fetch(`/api/admin/organizations/${orgId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ limits: draftToLimits(orgLimitDraft) }),
    });
    const data = await res.json().catch(() => ({})) as { error?: string };
    if (!res.ok) {
      toast.error(data.error || 'No se pudieron actualizar los limites');
      return;
    }
    await invalidateGetQueries(queryClient, ORGANIZATIONS_QUERY_KEY);
    await invalidateGetQueries(queryClient, ['admin', 'organizations', orgId]);
    toast.success('Limites de organizacion actualizados');
  }

  async function saveUserLimits() {
    if (!limitsUser) return;
    const user = users.find((item) => item.uid === limitsUser.uid);
    if (!user) {
      toast.error('No se encontro el usuario.');
      return;
    }

    const token = await auth.currentUser?.getIdToken();
    const res = await fetch('/api/users/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        uid: user.uid,
        email: user.email,
        role: user.role,
        membership: user.membership,
        limits: draftToLimits(userLimitDraft),
      }),
    });
    const data = await res.json().catch(() => ({})) as { error?: string };
    if (!res.ok) {
      toast.error(data.error || 'No se pudieron actualizar los limites');
      return;
    }
    if (user.role === 'cliente') {
      const orgId = user.organizationId || user.uid;
      const orgRes = await fetch(`/api/admin/organizations/${orgId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ limits: draftToLimits(userLimitDraft) }),
      });
      const orgData = await orgRes.json().catch(() => ({})) as { error?: string };
      if (!orgRes.ok) {
        toast.error(orgData.error || 'Limite guardado en usuario, pero no en organizacion');
        return;
      }
      await invalidateGetQueries(queryClient, ORGANIZATIONS_QUERY_KEY);
      await invalidateGetQueries(queryClient, ['admin', 'organizations', orgId]);
    }
    await queryClient.invalidateQueries({ queryKey: ['users'] });
    await queryClient.invalidateQueries({ queryKey: ['users', user.uid] });
    await fetchUsers();
    setLimitsUser(null);
    setUserLimitDraft({});
    toast.success('Limites de usuario actualizados');
  }

  const planRoutesForPermissionsUser = useMemo(() => {
    if (!permissionsUser) return [];
    const planType = permissionsUser.membershipType || 'free';
    const planConfig = plansQuery.data?.[planType];
    return planConfig?.allowedRoutes ?? getFallbackRoutesForPlan(planType);
  }, [permissionsUser, plansQuery.data]);

  async function saveUserRouteAccess() {
    if (!permissionsUser) return;
    const user = users.find((item) => item.uid === permissionsUser.uid);
    if (!user) {
      toast.error('No se encontro el usuario.');
      return;
    }

    const token = await auth.currentUser?.getIdToken();
    const res = await fetch('/api/users/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        uid: user.uid,
        email: user.email,
        role: user.role,
        membership: user.membership,
        routeAccess: userRouteAccessDraft ?? null,
      }),
    });
    const data = await res.json().catch(() => ({})) as { error?: string };
    if (!res.ok) {
      toast.error(data.error || 'No se pudieron actualizar los permisos');
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ['users'] });
    await queryClient.invalidateQueries({ queryKey: ['users', user.uid] });
    await fetchUsers();
    setPermissionsUser(null);
    setUserRouteAccessDraft(undefined);
    toast.success('Permisos de vistas actualizados');
  }

  async function adjustUserUsage(
    routeKey: string,
    action: 'increment' | 'decrement' | 'set',
    targetUid = limitsUser?.uid
  ) {
    if (!targetUid) return;
    const rawAmount = action === 'set' ? '0' : usageAdjustments[routeKey] || '0';
    const amount = Math.max(0, Number(rawAmount) || 0);
    const token = await auth.currentUser?.getIdToken();
    const res = await fetch('/api/admin/usage-limits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        uid: targetUid,
        routeKey,
        action,
        amount,
      }),
    });
    const data = await res.json().catch(() => ({})) as { error?: string };
    if (!res.ok) {
      toast.error(data.error || 'No se pudo ajustar el consumo');
      return;
    }
    setUsageAdjustments((current) => ({ ...current, [routeKey]: '' }));
    await invalidateGetQueries(queryClient, ['admin', 'usage-limits', targetUid]);
    toast.success('Consumo mensual actualizado');
  }

  const tableRows: UserTableRow[] = useMemo(
    () =>
      users.map((user) => {
        const org = user.role === 'cliente' ? orgByOwnerUid.get(user.uid) : null;
        return {
          uid: user.uid,
          email: user.email,
          role: user.role,
          membershipType: user.membership?.type ?? 'free',
          membershipExpiresAt: user.membership?.expiresAt ?? '',
          displayName: user.displayName || user.cliente,
          photoURL: user.photoURL,
          cliente: user.cliente,
          disabled: Boolean(user.disabled),
          organizationId: user.organizationId || org?.organizationId || user.uid,
          collaboratorCount: org?.organization?.collaboratorCount,
          maxCollaborators: org?.organization?.maxCollaborators,
          limits: user.limits,
          routeAccess: user.routeAccess,
        };
      }),
    [orgByOwnerUid, users]
  );

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tableRows.filter((row) => {
      if (roleFilter !== 'all' && row.role !== roleFilter) return false;
      if (!q) return true;
      return [
        row.email,
        row.displayName,
        row.uid,
        row.role,
        row.membershipType,
        row.cliente,
      ].some((value) => String(value || '').toLowerCase().includes(q));
    });
  }, [roleFilter, search, tableRows]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / rowsPerPage));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    setCurrentPage(1);
  }, [roleFilter, rowsPerPage, search]);

  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filteredRows.slice(start, start + rowsPerPage);
  }, [currentPage, filteredRows, rowsPerPage]);

  const totals = useMemo(
    () => ({
      all: users.length,
      cliente: users.filter((user) => user.role === 'cliente').length,
      colaborador: users.filter((user) => user.role === 'colaborador').length,
      superadmin: users.filter((user) => user.role === 'superadmin').length,
    }),
    [users]
  );

  if (checkingRole) {
    return <div className="p-8 text-muted-foreground">Verificando permisos...</div>;
  }

  return (
    <main className="min-w-0 bg-background text-foreground">
      <div className="flex w-full min-w-0 flex-col gap-3 sm:gap-4">
        <section className="rounded-lg border border-border bg-card p-4 shadow-sm sm:p-5">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-5">
            <div className="min-w-0">
              <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary sm:mb-3 sm:text-sm sm:tracking-[0.24em]">
                <Users className="size-4 shrink-0" />
                Gestion de usuarios
              </p>
              <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl lg:text-5xl">
                Usuarios, roles y cupos delegados
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground sm:mt-4 md:text-base">
                Administra superadmins, clientes y colaboradores desde una sola vista.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-3 sm:grid-cols-3 lg:w-full lg:max-w-[34rem]">
              <StatCard icon={BadgeCheck} label="Clientes" value={totals.cliente} />
              <StatCard icon={Users} label="Colaboradores" value={totals.colaborador} />
              <StatCard icon={ShieldCheck} label="Superadmins" value={totals.superadmin} />
            </div>
          </div>
        </section>

        <section className="min-w-0 rounded-lg border border-border bg-card p-3 shadow-sm sm:p-4">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h2 className="text-lg font-bold sm:text-xl">Todos los usuarios</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {filteredRows.length} de {totals.all} usuario{totals.all === 1 ? '' : 's'}.
              </p>
            </div>

            <Button
              className="w-full bg-primary font-bold text-black hover:bg-primary/90 sm:w-auto"
              onClick={openCreateModal}
            >
              <UserPlus className="size-4" />
              Crear usuario
            </Button>
          </div>

          <div className="mb-4 flex flex-col gap-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <UserTableSearch
                value={search}
                onChange={setSearch}
                placeholder="Buscar por nombre, correo, UID, rol o membresia..."
              />
              <label className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground">
                Filas
                <select
                  value={rowsPerPage}
                  onChange={(event) => setRowsPerPage(Number(event.target.value))}
                  className="h-9 rounded-md border border-border bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                >
                  {[10, 25, 50, 100].map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
              {ROLE_FILTERS.map((filter) => (
                <Button
                  key={filter.id}
                  type="button"
                  size="sm"
                  className="shrink-0"
                  variant={roleFilter === filter.id ? 'default' : 'outline'}
                  onClick={() => setRoleFilter(filter.id)}
                >
                  {filter.label} ({filter.id === 'all' ? totals.all : totals[filter.id]})
                </Button>
              ))}
            </div>
          </div>

          {error ? (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
              {error}
            </div>
          ) : null}

          <UserTable
            rows={paginatedRows}
            onEdit={openEditModal}
            onDelete={handleDelete}
            onViewDetails={openDelegateLimit}
            onViewStats={openClientStats}
            onEditLimits={openUserLimits}
            onEditPermissions={openUserPermissions}
            onForceLogout={(uid) => handleSessionAction(uid, 'forceLogout')}
            onToggleBlock={(row) => handleSessionAction(row.uid, row.disabled ? 'unblock' : 'block')}
          />

          <div className="mt-3 flex flex-col items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2 sm:mt-0 sm:flex-row sm:rounded-b-lg sm:border-x sm:border-b sm:border-t-0">
            <span className="text-center text-sm text-muted-foreground sm:text-left">
              Pagina <span className="font-medium text-foreground">{currentPage}</span> de {totalPages}
            </span>

            <div className="flex w-full items-center justify-center gap-1 sm:w-auto sm:gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
              >
                <ChevronsLeft className="size-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="size-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
              >
                <ChevronsRight className="size-4" />
              </Button>
            </div>
          </div>
        </section>
      </div>

      <Modal
        open={modalOpen || !!editMode}
        onClose={() => {
          setModalOpen(false);
          setForm({});
          setEditMode(null);
        }}
        className="w-[min(100%,24rem)] max-w-md sm:w-[min(100%,28rem)] sm:max-w-lg"
      >
        <UserForm
          form={form}
          editMode={editMode}
          onChange={handleFormChange}
          onMembershipTypeChange={handleMembershipTypeChange}
          onMembershipExpiresChange={handleMembershipExpiresChange}
          onSubmit={handleFormSubmit}
          onCancel={() => {
            setModalOpen(false);
            setForm({});
            setEditMode(null);
          }}
        />
      </Modal>

      <Modal
        open={delegateUser !== null}
        onClose={() => {
          setDelegateUser(null);
          setUsageAdjustments({});
        }}
        className="max-h-[90vh] w-[min(96vw,72rem)] overflow-y-auto"
      >
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-bold">Detalle del cliente</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Revisa sus colaboradores y configura cuantas personas delegadas puede tener.
            </p>
          </div>

          <div className="grid gap-4 rounded-lg border border-border bg-background p-4 text-sm md:grid-cols-[minmax(0,1fr)_18rem] md:items-end">
            <div>
              <p className="font-semibold">{delegateUser?.displayName || delegateUser?.email}</p>
              <p className="text-muted-foreground">{delegateUser?.email}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                Uso actual: {delegateUser?.collaboratorCount ?? 0} / {delegateUser?.maxCollaborators ?? 0}
              </p>
            </div>
            <div className="grid gap-2">
              <label className="grid gap-1 text-sm font-medium">
                Maximo de personas delegadas
                <input
                  type="number"
                  min={0}
                  value={delegateLimit}
                  onChange={(event) => setDelegateLimit(event.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40 border-border"
                />
              </label>
              <Button type="button" className="bg-primary font-bold text-black hover:bg-primary/90" onClick={saveDelegateLimit}>
                Guardar cupo
              </Button>
            </div>
          </div>

          <LimitEditor
            title="Limites de la organizacion"
            description="Aplican al titular y a todos sus colaboradores, salvo que un usuario tenga un limite propio."
            draft={orgLimitDraft}
            onChange={setOrgLimitDraft}
            onSave={saveOrganizationLimits}
          />

          <UsageAdjustmentPanel
            loading={delegateUsageQuery.isFetching && !delegateUsageQuery.data}
            data={delegateUsageQuery.data ?? null}
            drafts={usageAdjustments}
            onDraftChange={(routeKey, value) =>
              setUsageAdjustments((current) => ({ ...current, [routeKey]: value }))
            }
            onAdjust={(routeKey, action) => adjustUserUsage(routeKey, action, delegateUser?.uid)}
          />

          <OrgMembersPanel
            loading={orgDetailQuery.isFetching && !orgDetailQuery.data}
            detail={orgDetailQuery.data ?? null}
            onEditMember={handleEditDetailMember}
          />
        </div>
      </Modal>

      <Modal
        open={statsUser !== null}
        onClose={() => setStatsUser(null)}
        className="max-h-[90vh] w-[min(96vw,76rem)] overflow-y-auto"
      >
        <ClientStatsPanel
          client={statsUser}
          data={orgStatsQuery.data ?? null}
          loading={orgStatsQuery.isFetching && !orgStatsQuery.data}
        />
      </Modal>

      <Modal
        open={permissionsUser !== null}
        onClose={() => {
          setPermissionsUser(null);
          setUserRouteAccessDraft(undefined);
        }}
        className="max-h-[90vh] w-[min(96vw,42rem)] overflow-y-auto"
      >
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-bold">Permisos de vistas</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {permissionsUser?.displayName || permissionsUser?.email} · plan{' '}
              <span className="font-semibold capitalize">{permissionsUser?.membershipType || 'free'}</span>
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Marca o desmarca cada vista. Los cambios se aplican sobre lo que incluye el plan del usuario.
            </p>
          </div>

          <PlanRouteSelector
            mode="override"
            planRoutes={planRoutesForPermissionsUser}
            override={userRouteAccessDraft}
            onOverrideChange={setUserRouteAccessDraft}
          />

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setPermissionsUser(null);
                setUserRouteAccessDraft(undefined);
              }}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              className="bg-primary font-bold text-black hover:bg-primary/90"
              onClick={saveUserRouteAccess}
            >
              Guardar permisos
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={limitsUser !== null}
        onClose={() => {
          setLimitsUser(null);
          setUserLimitDraft({});
          setUsageAdjustments({});
        }}
        className="max-h-[90vh] w-[min(96vw,72rem)] overflow-y-auto"
      >
        <div className="space-y-4">
          <LimitEditor
            title={`Limites de ${limitsUser?.displayName || limitsUser?.email || 'usuario'}`}
            description="Estos valores tienen prioridad sobre los limites de la organizacion y del plan."
            draft={userLimitDraft}
            onChange={setUserLimitDraft}
            onSave={saveUserLimits}
          />
          <UsageAdjustmentPanel
            loading={usageQuery.isFetching && !usageQuery.data}
            data={usageQuery.data ?? null}
            drafts={usageAdjustments}
            onDraftChange={(routeKey, value) =>
              setUsageAdjustments((current) => ({ ...current, [routeKey]: value }))
            }
            onAdjust={adjustUserUsage}
          />
        </div>
      </Modal>
    </main>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/40 p-4">
      <Icon className="mb-3 size-5 text-primary text-primary" />
      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-bold">{value}</p>
    </div>
  );
}

function LimitEditor({
  title,
  description,
  draft,
  onChange,
  onSave,
}: {
  title: string;
  description: string;
  draft: LimitDraft;
  onChange: (next: LimitDraft) => void;
  onSave: () => void;
}) {
  const updateLimit = (routeKey: string, value: string) => {
    onChange({ ...draft, [routeKey]: value });
  };

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-bold">
            <SlidersHorizontal className="size-5 text-primary text-primary" />
            {title}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        <Button type="button" className="w-full bg-primary font-bold text-black hover:bg-primary/90 sm:w-auto" onClick={onSave}>
          Guardar limites
        </Button>
      </div>

      <div className="mt-4 grid gap-3 rounded-lg border border-border bg-background p-3 md:grid-cols-2">
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Fecha de renovacion</span>
          <input
            type="date"
            value={draft[RENEWAL_DATE_DRAFT_KEY] || ''}
            onChange={(event) => updateLimit(RENEWAL_DATE_DRAFT_KEY, event.target.value)}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40 border-border"
          />
          <span className="text-xs text-muted-foreground">
            Si es automatica, se renovara cada mes usando el dia de esta fecha.
          </span>
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Renovacion</span>
          <select
            value={draft[AUTOMATIC_RESET_DRAFT_KEY] || INHERIT_LIMIT_VALUE}
            onChange={(event) => updateLimit(AUTOMATIC_RESET_DRAFT_KEY, event.target.value)}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40 border-border"
          >
            <option value={INHERIT_LIMIT_VALUE}>Heredar</option>
            <option value="true">Automatica mensual</option>
            <option value="false">Manual</option>
          </select>
          <span className="text-xs text-muted-foreground">
            En manual el ciclo no cambia solo; el admin decide cuando resetear.
          </span>
        </label>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {PLAN_ROUTE_GROUPS.map((group) => (
          <div key={group.key} className="rounded-lg border border-border bg-background p-3">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {group.label}
            </p>
            <div className="grid gap-2">
              {group.routes.map((route) => (
                <div key={route.key} className="grid gap-2 rounded-md border border-border bg-card p-2">
                  <p className="text-sm font-medium">{route.label}</p>
                  <label className="grid gap-1 text-xs text-muted-foreground">
                    Limite mensual
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_8rem]">
                      <input
                        type="number"
                        min={1}
                        value={draft[route.key] === UNLIMITED_LIMIT_VALUE ? '' : draft[route.key] || ''}
                        onChange={(event) => updateLimit(route.key, event.target.value)}
                        placeholder="Heredar"
                        disabled={draft[route.key] === UNLIMITED_LIMIT_VALUE}
                        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-60"
                      />
                      <select
                        value={draft[route.key] === UNLIMITED_LIMIT_VALUE ? UNLIMITED_LIMIT_VALUE : draft[route.key] ? 'custom' : INHERIT_LIMIT_VALUE}
                        onChange={(event) => {
                          const value = event.target.value;
                          updateLimit(route.key, value === 'custom' ? '1' : value);
                        }}
                        className="rounded-md border border-border bg-background px-2 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40 border-border"
                      >
                        <option value={INHERIT_LIMIT_VALUE}>Heredar</option>
                        <option value="custom">Fijo</option>
                        <option value={UNLIMITED_LIMIT_VALUE}>Ilimitado</option>
                      </select>
                    </div>
                  </label>
                  <label className="grid gap-1 text-xs text-muted-foreground">
                    Limite por proceso
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_8rem]">
                      <input
                        type="number"
                        min={1}
                        value={
                          draft[batchDraftKey(route.key)] === UNLIMITED_LIMIT_VALUE
                            ? ''
                            : draft[batchDraftKey(route.key)] || ''
                        }
                        onChange={(event) => updateLimit(batchDraftKey(route.key), event.target.value)}
                        placeholder="Heredar"
                        disabled={draft[batchDraftKey(route.key)] === UNLIMITED_LIMIT_VALUE}
                        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-60"
                      />
                      <select
                        value={
                          draft[batchDraftKey(route.key)] === UNLIMITED_LIMIT_VALUE
                            ? UNLIMITED_LIMIT_VALUE
                            : draft[batchDraftKey(route.key)]
                              ? 'custom'
                              : INHERIT_LIMIT_VALUE
                        }
                        onChange={(event) => {
                          const value = event.target.value;
                          updateLimit(batchDraftKey(route.key), value === 'custom' ? '1' : value);
                        }}
                        className="rounded-md border border-border bg-background px-2 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40 border-border"
                      >
                        <option value={INHERIT_LIMIT_VALUE}>Heredar</option>
                        <option value="custom">Fijo</option>
                        <option value={UNLIMITED_LIMIT_VALUE}>Ilimitado</option>
                      </select>
                    </div>
                  </label>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function UsageAdjustmentPanel({
  loading,
  data,
  drafts,
  onDraftChange,
  onAdjust,
}: {
  loading: boolean;
  data: AdminUsageLimitsResponse | null;
  drafts: Record<string, string>;
  onDraftChange: (routeKey: string, value: string) => void;
  onAdjust: (routeKey: string, action: 'increment' | 'decrement' | 'set') => void;
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-bold">
            <Activity className="size-5 text-primary text-primary" />
            Consumo mensual
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Cada usuario tiene su propio conteo. Los ajustes modifican el saldo del mes sin borrar el historial.
          </p>
        </div>
        <div className="rounded-md border border-border px-3 py-2 text-sm font-semibold sm:max-w-md">
          {data
            ? `${data.automaticReset ? 'Automatico' : 'Manual'} · ciclo desde ${formatDate(data.periodStart)}${data.renewalDate ? ` · renovacion ${formatDate(data.renewalDate)}` : ` · dia ${data.resetDayOfMonth}`}`
            : 'Ciclo actual'}
        </div>
      </div>

      {loading ? (
        <div className="mt-4 rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Cargando consumo...
        </div>
      ) : (
        <>
          <div className="mt-4 space-y-3 md:hidden">
            {data?.routes.map((route) => (
              <article key={route.key} className="rounded-lg border border-border bg-background p-3 text-sm">
                <div className="font-semibold">{route.label}</div>
                <div className="text-xs text-muted-foreground">{route.groupLabel}</div>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <dt className="text-muted-foreground">Usado</dt>
                    <dd className="font-bold">{route.used}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Limite</dt>
                    <dd>{route.limit === null ? 'Ilimitado' : route.limit}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Restante</dt>
                    <dd>{route.remaining === null ? '-' : route.remaining}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Ajuste</dt>
                    <dd>{route.adjustment}</dd>
                  </div>
                </dl>
                <div className="mt-3 flex flex-col gap-2">
                  <input
                    type="number"
                    min={0}
                    value={drafts[route.key] || ''}
                    onChange={(event) => onDraftChange(route.key, event.target.value)}
                    placeholder="Cantidad"
                    className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                  />
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <Button type="button" variant="outline" size="sm" onClick={() => onAdjust(route.key, 'increment')}>
                      Sumar
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => onAdjust(route.key, 'decrement')}>
                      Restar
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => onAdjust(route.key, 'set')}>
                      Resetear a cero
                    </Button>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <div className="mt-4 hidden overflow-x-auto md:block">
          <table className="w-full min-w-[860px] text-sm">
            <thead className={TABLE_HEAD}>
              <tr>
                <th className="px-3 py-2 text-left">Modulo</th>
                <th className="px-3 py-2 text-right">Usado</th>
                <th className="px-3 py-2 text-right">Limite</th>
                <th className="px-3 py-2 text-right">Restante</th>
                <th className="px-3 py-2 text-right">Logs</th>
                <th className="px-3 py-2 text-right">Ajuste</th>
                <th className="px-3 py-2 text-left">Modificar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data?.routes.map((route) => (
                <tr key={route.key}>
                  <td className="px-3 py-3">
                    <div className="font-semibold">{route.label}</div>
                    <div className="text-xs text-muted-foreground">{route.groupLabel}</div>
                  </td>
                  <td className="px-3 py-3 text-right font-bold">{route.used}</td>
                  <td className="px-3 py-3 text-right">{route.limit === null ? 'Ilimitado' : route.limit}</td>
                  <td className="px-3 py-3 text-right">{route.remaining === null ? '-' : route.remaining}</td>
                  <td className="px-3 py-3 text-right">{route.fromLogs}</td>
                  <td className="px-3 py-3 text-right">{route.adjustment}</td>
                  <td className="px-3 py-3">
                    <div className="flex min-w-[18rem] items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        value={drafts[route.key] || ''}
                        onChange={(event) => onDraftChange(route.key, event.target.value)}
                        placeholder="Cantidad"
                        className="w-24 rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/40 border-border"
                      />
                      <Button type="button" variant="outline" size="sm" onClick={() => onAdjust(route.key, 'increment')}>
                        Sumar
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => onAdjust(route.key, 'decrement')}>
                        Restar
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => onAdjust(route.key, 'set')}>
                        Resetear a cero
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </>
      )}
    </section>
  );
}

function ClientStatsPanel({
  client,
  data,
  loading,
}: {
  client: UserTableRow | null;
  data: AdminOrganizationStatsResponse | null;
  loading: boolean;
}) {
  const totals = data?.totals ?? {
    processes: 0,
    records: 0,
    successCount: 0,
    errorCount: 0,
    successRate: 0,
  };
  const errorRate = getErrorRate(totals);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary text-primary">
            Estadisticas
          </p>
          <h2 className="mt-2 text-xl font-bold sm:text-2xl">
            {data?.organization.displayTitle || client?.displayName || client?.email || 'Cliente'}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Metricas de DTE procesados por la organizacion y sus colaboradores.
          </p>
        </div>
        <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
          <p className="font-semibold">Ultimos 30 dias</p>
          <p className="text-xs text-muted-foreground">
            {data ? `${formatDate(data.period.from)} - ${formatDate(data.period.to)}` : 'Cargando periodo'}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="rounded-lg border border-border bg-muted/40 p-8 text-center text-sm text-muted-foreground">
          Cargando estadisticas...
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <StatsMetricCard icon={Activity} label="Procesos" value={totals.processes} />
            <StatsMetricCard icon={FileText} label="DTE procesados" value={totals.records} />
            <StatsMetricCard icon={CheckCircle2} label="Exitosos" value={totals.successCount} />
            <StatsMetricCard icon={XCircle} label="Fallidos" value={totals.errorCount} />
            <StatsMetricCard icon={Percent} label="Tasa error" value={`${errorRate}%`} />
          </div>

          <section className="rounded-lg border border-border bg-card">
            <div className="border-b border-border px-4 py-3">
              <h3 className="font-bold">Actividad por usuario</h3>
              <p className="text-sm text-muted-foreground">
                Titular y colaboradores asociados a este cliente.
              </p>
            </div>
            <div className="overflow-x-auto md:hidden">
              <div className="space-y-3 p-3">
                {data?.members.length ? (
                  data.members.map((member) => (
                    <article key={member.uid} className="rounded-lg border border-border bg-background p-3 text-sm">
                      <div className="font-semibold">{member.displayName || member.email}</div>
                      <div className="text-xs text-muted-foreground">{member.email}</div>
                      <span className="mt-2 inline-flex rounded-full bg-muted px-2 py-1 text-xs font-semibold capitalize text-muted-foreground">
                        {member.role === 'cliente' ? 'Cliente' : member.orgRole === 'administrador' ? 'Delegado admin' : 'Colaborador'}
                      </span>
                      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                        <div><dt className="text-muted-foreground">Procesos</dt><dd className="font-semibold">{member.totals.processes}</dd></div>
                        <div><dt className="text-muted-foreground">DTE</dt><dd>{member.totals.records}</dd></div>
                        <div><dt className="text-muted-foreground">Exitosos</dt><dd className="text-emerald-600 dark:text-emerald-300">{member.totals.successCount}</dd></div>
                        <div><dt className="text-muted-foreground">Fallidos</dt><dd className="text-red-600 dark:text-red-300">{member.totals.errorCount}</dd></div>
                        <div><dt className="text-muted-foreground">Error</dt><dd>{getErrorRate(member.totals)}%</dd></div>
                      </dl>
                    </article>
                  ))
                ) : (
                  <div className="py-8 text-center text-muted-foreground">
                    Sin actividad registrada en este periodo.
                  </div>
                )}
              </div>
            </div>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[760px] text-sm">
                <thead className={TABLE_HEAD}>
                  <tr>
                    <th className="px-4 py-3 text-left">Usuario</th>
                    <th className="px-4 py-3 text-left">Rol</th>
                    <th className="px-4 py-3 text-right">Procesos</th>
                    <th className="px-4 py-3 text-right">DTE</th>
                    <th className="px-4 py-3 text-right">Exitosos</th>
                    <th className="px-4 py-3 text-right">Fallidos</th>
                    <th className="px-4 py-3 text-right">Error</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data?.members.length ? (
                    data.members.map((member) => (
                      <tr key={member.uid} className="hover:bg-muted/30">
                        <td className="px-4 py-3">
                          <div className="font-semibold">{member.displayName || member.email}</div>
                          <div className="text-xs text-muted-foreground">{member.email}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="rounded-full bg-muted px-2 py-1 text-xs font-semibold capitalize text-muted-foreground">
                            {member.role === 'cliente' ? 'Cliente' : member.orgRole === 'administrador' ? 'Delegado admin' : 'Colaborador'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold">{member.totals.processes}</td>
                        <td className="px-4 py-3 text-right">{member.totals.records}</td>
                        <td className="px-4 py-3 text-right text-emerald-600 dark:text-emerald-300">
                          {member.totals.successCount}
                        </td>
                        <td className="px-4 py-3 text-right text-red-600 dark:text-red-300">
                          {member.totals.errorCount}
                        </td>
                        <td className="px-4 py-3 text-right">{getErrorRate(member.totals)}%</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                        Sin actividad registrada en este periodo.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <section className="rounded-lg border border-border bg-card">
              <div className="border-b border-border px-4 py-3">
                <h3 className="font-bold">DTE por opcion de validacion</h3>
                <p className="text-sm text-muted-foreground">Modulos mas utilizados por toda la organizacion.</p>
              </div>
              <div className="space-y-3 p-3 md:hidden">
                {data?.byModule.length ? (
                  data.byModule.map((module) => (
                    <article key={module.routeKey || module.moduleName} className="rounded-lg border border-border bg-background p-3 text-sm">
                      <div className="font-semibold">{module.moduleName}</div>
                      <dl className="mt-2 grid grid-cols-2 gap-2 text-xs">
                        <div><dt className="text-muted-foreground">Procesos</dt><dd>{module.count}</dd></div>
                        <div><dt className="text-muted-foreground">DTE</dt><dd>{module.records}</dd></div>
                        <div><dt className="text-muted-foreground">Exitosos</dt><dd className="text-emerald-600 dark:text-emerald-300">{module.successCount}</dd></div>
                        <div><dt className="text-muted-foreground">Fallidos</dt><dd className="text-red-600 dark:text-red-300">{module.errorCount}</dd></div>
                      </dl>
                    </article>
                  ))
                ) : (
                  <div className="py-8 text-center text-muted-foreground">Sin modulos procesados todavia.</div>
                )}
              </div>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[620px] text-sm">
                  <thead className={TABLE_HEAD}>
                    <tr>
                      <th className="px-4 py-3 text-left">Modulo</th>
                      <th className="px-4 py-3 text-right">Procesos</th>
                      <th className="px-4 py-3 text-right">DTE</th>
                      <th className="px-4 py-3 text-right">Exitosos</th>
                      <th className="px-4 py-3 text-right">Fallidos</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data?.byModule.length ? (
                      data.byModule.map((module) => (
                        <tr key={module.routeKey || module.moduleName}>
                          <td className="px-4 py-3 font-semibold">{module.moduleName}</td>
                          <td className="px-4 py-3 text-right">{module.count}</td>
                          <td className="px-4 py-3 text-right">{module.records}</td>
                          <td className="px-4 py-3 text-right text-emerald-600 dark:text-emerald-300">
                            {module.successCount}
                          </td>
                          <td className="px-4 py-3 text-right text-red-600 dark:text-red-300">
                            {module.errorCount}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                          Sin modulos procesados todavia.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-lg border border-border bg-muted/40 p-4">
              <h3 className="font-bold">Procesos recientes</h3>
              <div className="mt-3 space-y-3">
                {data?.recent.length ? (
                  data.recent.map((log) => (
                    <div key={log.id} className="rounded-lg border border-border bg-card p-3 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-semibold">{log.moduleName}</p>
                        <span className={getOutcomeClass(log.outcome)}>{getOutcomeLabel(log.outcome)}</span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(log.createdAt)}</p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {log.totalRecords} DTE, {log.successCount} exitosos, {log.errorCount} fallidos
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-lg border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
                    Sin procesos recientes.
                  </div>
                )}
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}

function StatsMetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/40 p-4">
      <Icon className="mb-3 size-5 text-primary text-primary" />
      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-extrabold">{value}</p>
    </div>
  );
}

function getErrorRate(totals: Pick<DashboardStatsTotals, 'successCount' | 'errorCount'>) {
  const total = totals.successCount + totals.errorCount;
  return total > 0 ? Math.round((totals.errorCount / total) * 100) : 0;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('es-SV', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatDateTime(value: string | null) {
  if (!value) return 'Sin fecha';
  return new Date(value).toLocaleString('es-SV', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getOutcomeLabel(outcome: DashboardRecentLog['outcome']) {
  if (outcome === 'error') return 'Fallido';
  if (outcome === 'partial') return 'Parcial';
  return 'Exitoso';
}

function getOutcomeClass(outcome: DashboardRecentLog['outcome']) {
  const base = 'rounded-full px-2 py-1 text-xs font-semibold';
  if (outcome === 'error') return `${base} bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-200`;
  if (outcome === 'partial') return `${base} bg-primary/15 text-primary dark:bg-primary/15 text-primary`;
  return `${base} bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200`;
}
