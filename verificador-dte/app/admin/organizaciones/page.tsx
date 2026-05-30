'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { Loader2, MoreVertical } from 'lucide-react';

type AccessRequest = {
  id: string;
  nombre: string;
  email: string;
  telefono?: string;
  mensaje?: string;
  status: string;
};

type ClientRow = {
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

type Collaborator = {
  uid: string;
  email: string;
  displayName?: string;
  orgRole?: string;
  accountStatus?: string;
};

export default function AdminOrganizacionesPage() {
  const [tab, setTab] = useState<'solicitantes' | 'clientes'>('solicitantes');
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [approving, setApproving] = useState<string | null>(null);
  const [detailOrgId, setDetailOrgId] = useState<string | null>(null);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadRequests = useCallback(async () => {
    const snap = await getDocs(collection(db, 'accessRequests'));
    const data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as AccessRequest));
    data.sort((a, b) => (b as { createdAt?: { seconds: number } }).createdAt?.seconds ?? 0 -
      ((a as { createdAt?: { seconds: number } }).createdAt?.seconds ?? 0));
    setRequests(data);
  }, []);

  const loadClients = useCallback(async () => {
    const token = await auth.currentUser?.getIdToken();
    const res = await fetch('/api/admin/organizations', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error');
    setClients(data.clients ?? []);
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([loadRequests(), loadClients()]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al cargar');
    } finally {
      setLoading(false);
    }
  }, [loadClients, loadRequests]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const pendingRequests = useMemo(() => {
    const q = search.toLowerCase();
    return requests.filter(
      (r) =>
        r.status === 'pending' &&
        (!q || r.nombre.toLowerCase().includes(q) || r.email.toLowerCase().includes(q))
    );
  }, [requests, search]);

  const filteredClients = useMemo(() => {
    const q = search.toLowerCase();
    return clients.filter(
      (c) =>
        !q ||
        c.email.toLowerCase().includes(q) ||
        (c.displayName?.toLowerCase().includes(q) ?? false) ||
        (c.organization?.displayTitle?.toLowerCase().includes(q) ?? false) ||
        (c.organization?.name?.toLowerCase().includes(q) ?? false)
    );
  }, [clients, search]);

  async function approveRequest(requestId: string, membershipType: 'free' | 'premium' | 'pro' = 'free') {
    setApproving(requestId);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/access-requests/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ requestId, membershipType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error');
      toast.success('Solicitud aprobada');
      await loadAll();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error');
    } finally {
      setApproving(null);
    }
  }

  async function rejectRequest(requestId: string) {
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/access-requests/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ requestId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error');
      toast.success('Solicitud rechazada');
      await loadRequests();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error');
    }
  }

  async function openCollaborators(orgId: string) {
    setDetailOrgId(orgId);
    setDetailLoading(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/admin/organizations/${orgId}/collaborators`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error');
      setCollaborators(data.collaborators ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error');
      setCollaborators([]);
    } finally {
      setDetailLoading(false);
    }
  }

  async function patchOrg(orgId: string, patch: { maxCollaborators?: number; status?: 'active' | 'suspended' }) {
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/admin/organizations/${orgId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error');
      toast.success('Organización actualizada');
      await loadClients();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error');
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 text-slate-950 dark:bg-black dark:text-white md:p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Organizaciones y solicitantes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Aprueba solicitudes, revisa KYC y gestiona colaboradores por cliente.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant={tab === 'solicitantes' ? 'default' : 'outline'}
            onClick={() => setTab('solicitantes')}
          >
            Solicitantes ({pendingRequests.length})
          </Button>
          <Button
            variant={tab === 'clientes' ? 'default' : 'outline'}
            onClick={() => setTab('clientes')}
          >
            Clientes activos ({clients.length})
          </Button>
          <Input
            className="max-w-xs"
            placeholder="Buscar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="size-8 animate-spin text-amber-500" />
          </div>
        ) : tab === 'solicitantes' ? (
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Correo</TableHead>
                  <TableHead>Teléfono</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingRequests.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      No hay solicitudes pendientes.
                    </TableCell>
                  </TableRow>
                ) : (
                  pendingRequests.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.nombre}</TableCell>
                      <TableCell>{r.email}</TableCell>
                      <TableCell>{r.telefono || '—'}</TableCell>
                      <TableCell className="space-x-2 text-right">
                        <Button
                          size="sm"
                          disabled={approving === r.id}
                          onClick={() => approveRequest(r.id, 'free')}
                        >
                          {approving === r.id ? <Loader2 className="size-4 animate-spin" /> : 'Aprobar (Free)'}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => approveRequest(r.id, 'premium')}>
                          Premium
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => approveRequest(r.id, 'pro')}>
                          Pro
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => rejectRequest(r.id)}>
                          Rechazar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Organización</TableHead>
                  <TableHead>KYC</TableHead>
                  <TableHead>Cupos</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">⋮</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClients.map((c) => {
                  const org = c.organization;
                  const orgId = c.organizationId;
                  return (
                    <TableRow key={c.uid}>
                      <TableCell>
                        <div className="font-medium">{c.displayName || c.email}</div>
                        <div className="text-xs text-muted-foreground">{c.email}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{org?.displayTitle || org?.name || '—'}</div>
                        {org?.displaySubtitle ? (
                          <div className="text-xs text-muted-foreground">{org.displaySubtitle}</div>
                        ) : null}
                        {org?.allowedEmailDomain ? (
                          <div className="text-xs text-muted-foreground">@{org.allowedEmailDomain}</div>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        {org?.kycCompleted ? (
                          <Badge className="bg-green-600">Completo</Badge>
                        ) : (
                          <Badge variant="outline">Pendiente</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {org ? `${org.collaboratorCount} / ${org.maxCollaborators}` : '—'}
                      </TableCell>
                      <TableCell className="capitalize">{org?.status ?? '—'}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          title="Usuarios asociados"
                          onClick={() => openCollaborators(orgId)}
                        >
                          <MoreVertical className="size-4" />
                        </Button>
                        {org && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="ml-1"
                              onClick={() =>
                                patchOrg(orgId, {
                                  status: org.status === 'suspended' ? 'active' : 'suspended',
                                })
                              }
                            >
                              {org.status === 'suspended' ? 'Activar' : 'Suspender'}
                            </Button>
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <Modal open={detailOrgId !== null} onClose={() => setDetailOrgId(null)}>
        <div className="min-w-[320px] space-y-4 p-2">
          <h2 className="text-lg font-bold">Colaboradores de la organización</h2>
          {detailLoading ? (
            <Loader2 className="mx-auto size-6 animate-spin" />
          ) : collaborators.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin colaboradores registrados.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {collaborators.map((col) => (
                <li key={col.uid} className="rounded border px-3 py-2">
                  <div className="font-medium">{col.displayName || col.email}</div>
                  <div className="text-muted-foreground">{col.email}</div>
                  <div className="text-xs capitalize">
                    {col.orgRole ?? 'miembro'} · {col.accountStatus ?? 'active'}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Modal>
    </main>
  );
}
