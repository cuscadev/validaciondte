'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { onAuthStateChanged } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { BadgeCheck, ShieldCheck, UserPlus, Users } from 'lucide-react';
import { toast } from 'sonner';

import { UserForm } from '@/components/admin/UserForm';
import { UserTable, type UserTableRow } from '@/components/admin/UserTable';
import { UserTableSearch } from '@/components/admin/UserTableExtras';
import {
  OrgMembersPanel,
  type OrgMembersDetail,
} from '@/components/admin/OrgMembersPanel';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import {
  AppUser,
  MembershipType,
  UserRole,
  getAllUsers,
  getUser,
} from '@/lib/firestoreUser';
import { auth } from '@/lib/firebase';
import { QUERY_CACHE_MS } from '@/components/QueryProvider';
import {
  invalidateGetQueries,
  useGetQuery,
} from '@/lib/tanstack-query';

type UserFormState = Partial<AppUser> & { password?: string };

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

const ORGANIZATIONS_QUERY_KEY = ['admin', 'organizations'] as const;
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

export default function UsersAdminPage() {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [error, setError] = useState('');
  const [checkingRole, setCheckingRole] = useState(true);
  const [form, setForm] = useState<UserFormState>({});
  const [editMode, setEditMode] = useState<string | null>(null);
  const [delegateUser, setDelegateUser] = useState<UserTableRow | null>(null);
  const [delegateLimit, setDelegateLimit] = useState('');
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
    <main className="min-h-screen bg-slate-50 text-slate-950 dark:bg-black dark:text-white">
      <div className="flex w-full flex-col gap-4 p-0">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-zinc-950">
          <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.24em] text-amber-600 dark:text-yellow-300">
                <Users className="size-4" />
                Gestion de usuarios
              </p>
              <h1 className="text-3xl font-extrabold tracking-tight md:text-5xl">
                Usuarios, roles y cupos delegados
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-600 md:text-base dark:text-zinc-300">
                Administra superadmins, clientes y colaboradores desde una sola vista.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[34rem]">
              <StatCard icon={BadgeCheck} label="Clientes" value={totals.cliente} />
              <StatCard icon={Users} label="Colaboradores" value={totals.colaborador} />
              <StatCard icon={ShieldCheck} label="Superadmins" value={totals.superadmin} />
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-zinc-950">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-bold">Todos los usuarios</h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-zinc-300">
                {filteredRows.length} de {totals.all} usuario{totals.all === 1 ? '' : 's'}.
              </p>
            </div>

            <Button className="bg-yellow-400 font-bold text-black hover:bg-yellow-300" onClick={openCreateModal}>
              <UserPlus className="size-4" />
              Crear usuario
            </Button>
          </div>

          <div className="mb-4 flex flex-col gap-3">
            <UserTableSearch
              value={search}
              onChange={setSearch}
              placeholder="Buscar por nombre, correo, UID, rol o membresia..."
            />
            <div className="flex flex-wrap gap-2">
              {ROLE_FILTERS.map((filter) => (
                <Button
                  key={filter.id}
                  type="button"
                  size="sm"
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
            rows={filteredRows}
            onEdit={openEditModal}
            onDelete={handleDelete}
            onViewDetails={openDelegateLimit}
            onForceLogout={(uid) => handleSessionAction(uid, 'forceLogout')}
            onToggleBlock={(row) => handleSessionAction(row.uid, row.disabled ? 'unblock' : 'block')}
          />
        </section>
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
        onClose={() => setDelegateUser(null)}
        className="max-h-[90vh] w-[min(96vw,72rem)] overflow-y-auto"
      >
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-bold">Detalle del cliente</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Revisa sus colaboradores y configura cuantas personas delegadas puede tener.
            </p>
          </div>

          <div className="grid gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm dark:border-white/10 dark:bg-black md:grid-cols-[minmax(0,1fr)_18rem] md:items-end">
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
                  className="w-full rounded-md border border-slate-200 bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-yellow-400/40 dark:border-white/10"
                />
              </label>
              <Button type="button" className="bg-yellow-400 font-bold text-black hover:bg-yellow-300" onClick={saveDelegateLimit}>
                Guardar cupo
              </Button>
            </div>
          </div>

          <OrgMembersPanel
            loading={orgDetailQuery.isFetching && !orgDetailQuery.data}
            detail={orgDetailQuery.data ?? null}
            onEditMember={handleEditDetailMember}
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
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-black">
      <Icon className="mb-3 size-5 text-amber-600 dark:text-yellow-300" />
      <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-zinc-500">{label}</p>
      <p className="mt-1 text-sm font-bold">{value}</p>
    </div>
  );
}
