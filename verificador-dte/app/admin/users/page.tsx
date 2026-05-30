'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { onAuthStateChanged } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { BadgeCheck, ShieldCheck, UserPlus, Users } from 'lucide-react';

import { UserForm } from '@/components/admin/UserForm';
import {
  OrgDirectoryAccordion,
  type OrgDirectoryRow,
} from '@/components/admin/OrgDirectoryAccordion';
import type { OrgMembersDetail } from '@/components/admin/OrgMembersPanel';
import { UserTableSearch } from '@/components/admin/UserTableExtras';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import {
  AppUser,
  MembershipType,
  UserRole,
  getAllUsers,
  getUser,
} from '@/lib/firestoreUser';
import {
  getOrgDirectorySegmentFromDisplay,
  type OrgDirectorySegment,
} from '@/lib/org-display';
import { auth } from '@/lib/firebase';
import { QUERY_CACHE_MS } from '@/components/QueryProvider';

type UserFormState = Partial<AppUser> & { password?: string };

type OrgSegmentFilter = 'all' | OrgDirectorySegment;

type ClientApiRow = {
  uid: string;
  email: string;
  displayName?: string;
  organizationId: string;
  organization: OrgDirectoryRow['organization'];
};

const SEGMENT_FILTERS: { id: OrgSegmentFilter; label: string }[] = [
  { id: 'all', label: 'Todas' },
  { id: 'juridica', label: 'Jurídicas' },
  { id: 'natural', label: 'Naturales' },
  { id: 'natural_with_group', label: 'Natural con grupo' },
];

function getErrorMessage(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}

export default function UsersAdminPage() {
  const [search, setSearch] = useState('');
  const [orgSegmentFilter, setOrgSegmentFilter] = useState<OrgSegmentFilter>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [orgClients, setOrgClients] = useState<ClientApiRow[]>([]);
  const [orgsLoading, setOrgsLoading] = useState(false);
  const [error, setError] = useState('');
  const [checkingRole, setCheckingRole] = useState(true);
  const [form, setForm] = useState<UserFormState>({});
  const [editMode, setEditMode] = useState<string | null>(null);
  const [expandedOrgId, setExpandedOrgId] = useState<string | null>(null);
  const [expandingOrgId, setExpandingOrgId] = useState<string | null>(null);
  const [orgDetailsCache, setOrgDetailsCache] = useState<Record<string, OrgMembersDetail>>({});
  const router = useRouter();
  const queryClient = useQueryClient();

  const fetchUsers = useCallback(async () => {
    try {
      const data = await queryClient.fetchQuery({
        queryKey: ['users'],
        queryFn: getAllUsers,
        staleTime: QUERY_CACHE_MS,
        gcTime: QUERY_CACHE_MS,
      });
      setUsers(data);
    } catch {
      // Contadores del header; no bloquear la vista principal
    }
  }, [queryClient]);

  const fetchOrganizations = useCallback(async () => {
    setOrgsLoading(true);
    setError('');
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/admin/organizations', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al cargar organizaciones');
      setOrgClients(data.clients ?? []);
    } catch (err) {
      setError(getErrorMessage(err, 'No se pudieron cargar las organizaciones.'));
    } finally {
      setOrgsLoading(false);
    }
  }, []);

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
        gcTime: QUERY_CACHE_MS,
      });
      if (!appUser || appUser.role !== 'superadmin') {
        router.push('/');
        return;
      }

      setCheckingRole(false);
      await Promise.all([fetchUsers(), fetchOrganizations()]);
    });
    return () => unsubscribe();
  }, [fetchOrganizations, fetchUsers, queryClient, router]);

  async function fetchOrgDetail(organizationId: string): Promise<OrgMembersDetail> {
    const token = await auth.currentUser?.getIdToken();
    const res = await fetch(`/api/admin/organizations/${organizationId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al cargar detalle');
    return {
      organization: data.organization,
      owner: data.owner,
      collaborators: data.collaborators ?? [],
    };
  }

  async function refreshExpandedOrgDetail(organizationId: string) {
    setExpandingOrgId(organizationId);
    try {
      const detail = await fetchOrgDetail(organizationId);
      setOrgDetailsCache((prev) => ({ ...prev, [organizationId]: detail }));
    } catch (err) {
      setError(getErrorMessage(err, 'No se pudo cargar el detalle de la organización.'));
    } finally {
      setExpandingOrgId(null);
    }
  }

  async function toggleOrg(organizationId: string) {
    if (expandedOrgId === organizationId) {
      setExpandedOrgId(null);
      return;
    }

    setExpandedOrgId(organizationId);
    setError('');

    if (orgDetailsCache[organizationId]) {
      return;
    }

    await refreshExpandedOrgDetail(organizationId);
  }

  async function handleEditMember(uid: string) {
    let user = users.find((u) => u.uid === uid);
    if (!user) {
      try {
        user = await queryClient.fetchQuery({
          queryKey: ['users', uid],
          queryFn: () => getUser(uid),
          staleTime: QUERY_CACHE_MS,
          gcTime: QUERY_CACHE_MS,
        });
      } catch {
        setError('No se pudo cargar el usuario para editar.');
        return;
      }
    }
    if (!user) {
      setError('Usuario no encontrado.');
      return;
    }
    setForm({
      uid: user.uid,
      email: user.email,
      role: user.role,
      membership: {
        type: user.membership?.type ?? '',
        expiresAt: user.membership?.expiresAt ?? '',
      },
    });
    setEditMode(user.uid);
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
    await queryClient.invalidateQueries({ queryKey: ['users'] });
    await queryClient.invalidateQueries({ queryKey: ['users', userData.uid] });
    await Promise.all([fetchUsers(), fetchOrganizations()]);
    if (expandedOrgId) {
      await refreshExpandedOrgDetail(expandedOrgId);
    }
  }

  const expandedDetail = expandedOrgId ? orgDetailsCache[expandedOrgId] ?? null : null;

  const orgDirectoryRows: OrgDirectoryRow[] = useMemo(
    () =>
      orgClients.map((c) => ({
        organizationId: c.organizationId,
        ownerUid: c.uid,
        ownerEmail: c.email,
        ownerDisplayName: c.displayName,
        organization: c.organization,
      })),
    [orgClients]
  );

  const segmentCounts = useMemo(() => {
    const counts: Record<OrgDirectorySegment, number> = {
      juridica: 0,
      natural: 0,
      natural_with_group: 0,
    };
    for (const row of orgDirectoryRows) {
      const org = row.organization;
      if (!org) continue;
      const segment = getOrgDirectorySegmentFromDisplay({
        personType: org.personType,
        groupName: org.groupName,
        legalName: org.legalName,
      });
      counts[segment]++;
    }
    return counts;
  }, [orgDirectoryRows]);

  const filteredOrgs = useMemo(() => {
    const q = search.toLowerCase();
    return orgDirectoryRows.filter((row) => {
      const org = row.organization;
      if (orgSegmentFilter !== 'all') {
        if (!org) return false;
        const segment = getOrgDirectorySegmentFromDisplay({
          personType: org.personType,
          groupName: org.groupName,
          legalName: org.legalName,
        });
        if (segment !== orgSegmentFilter) return false;
      }

      if (!q) return true;

      return (
        (org?.displayTitle?.toLowerCase().includes(q) ?? false) ||
        (org?.displaySubtitle?.toLowerCase().includes(q) ?? false) ||
        (org?.name?.toLowerCase().includes(q) ?? false) ||
        (org?.allowedEmailDomain?.toLowerCase().includes(q) ?? false) ||
        row.ownerEmail.toLowerCase().includes(q) ||
        (row.ownerDisplayName?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [orgDirectoryRows, orgSegmentFilter, search]);

  const totalClients = users.filter((user) => user.role === 'cliente').length;
  const totalEmployees = users.filter((user) => user.role === 'colaborador').length;
  const totalAdmins = users.filter((user) => user.role === 'superadmin').length;

  if (checkingRole) {
    return <div className="p-8 text-muted-foreground">Verificando permisos...</div>;
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950 dark:bg-black dark:text-white">
      <div className="mx-auto flex w-full max-w-[92rem] flex-col gap-4 p-0">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-zinc-950">
          <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.24em] text-amber-600 dark:text-yellow-300">
                <Users className="size-4" />
                Gestion de usuarios
              </p>
              <h1 className="text-3xl font-extrabold tracking-tight md:text-5xl">
                Usuarios, roles y membresias
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-600 md:text-base dark:text-zinc-300">
                Busca por organizacion, filtra por tipo y revisa titular y delegados en el detalle.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[34rem]">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-black">
                <BadgeCheck className="mb-3 size-5 text-amber-600 dark:text-yellow-300" />
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-zinc-500">Clientes</p>
                <p className="mt-1 text-sm font-bold">{totalClients}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-black">
                <Users className="mb-3 size-5 text-amber-600 dark:text-yellow-300" />
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-zinc-500">Colaboradores</p>
                <p className="mt-1 text-sm font-bold">{totalEmployees}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-black">
                <ShieldCheck className="mb-3 size-5 text-amber-600 dark:text-yellow-300" />
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-zinc-500">Admins</p>
                <p className="mt-1 text-sm font-bold">{totalAdmins}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-zinc-950">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-bold">Organizaciones</h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-zinc-300">
                {filteredOrgs.length} resultado{filteredOrgs.length === 1 ? '' : 's'} encontrado
                {filteredOrgs.length === 1 ? '' : 's'}.
              </p>
            </div>

            <Button
              className="bg-yellow-400 font-bold text-black hover:bg-yellow-300"
              onClick={() => {
                setForm({});
                setEditMode(null);
                setModalOpen(true);
              }}
            >
              <UserPlus className="size-4" />
              Crear usuario
            </Button>
          </div>

          <Modal
            open={modalOpen || !!editMode}
            onClose={() => {
              setModalOpen(false);
              setForm({});
              setEditMode(null);
            }}
          >
            <UserForm
              form={form}
              editMode={editMode}
              onChange={handleFormChange}
              onMembershipTypeChange={handleMembershipTypeChange}
              onMembershipExpiresChange={handleMembershipExpiresChange}
              onSubmit={(e) => {
                handleFormSubmit(e);
                setModalOpen(false);
              }}
              onCancel={() => {
                setModalOpen(false);
                setForm({});
                setEditMode(null);
              }}
            />
          </Modal>

          <div className="mb-4 flex flex-col gap-3">
            <UserTableSearch
              value={search}
              onChange={setSearch}
              placeholder="Buscar organización, titular o dominio..."
            />
            <div className="flex flex-wrap gap-2">
              {SEGMENT_FILTERS.map((filter) => {
                const count =
                  filter.id === 'all'
                    ? orgDirectoryRows.length
                    : segmentCounts[filter.id as OrgDirectorySegment];
                return (
                  <Button
                    key={filter.id}
                    type="button"
                    size="sm"
                    variant={orgSegmentFilter === filter.id ? 'default' : 'outline'}
                    onClick={() => setOrgSegmentFilter(filter.id)}
                  >
                    {filter.label} ({count})
                  </Button>
                );
              })}
            </div>
          </div>

          {orgsLoading ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-muted-foreground dark:border-white/10 dark:bg-black">
              Cargando...
            </div>
          ) : error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
              {error}
            </div>
          ) : (
            <OrgDirectoryAccordion
              rows={filteredOrgs}
              expandedOrgId={expandedOrgId}
              expandingOrgId={expandingOrgId}
              expandedDetail={expandedDetail}
              onToggle={toggleOrg}
              onEditMember={handleEditMember}
            />
          )}
        </section>
      </div>
    </main>
  );
}
