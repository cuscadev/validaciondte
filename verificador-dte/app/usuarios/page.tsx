'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { UserPlus } from 'lucide-react';
import { toast } from 'sonner';

import { auth } from '@/lib/firebase';
import { useAuth } from '@/components/AuthProvider';
import { canManageOrgUsers, type AccountStatus, type OrgRole } from '@/lib/firestoreUser';
import { isValidEmailFormat } from '@/lib/email-invite';
import { getOrgRoleLabel } from '@/lib/org-display';
import { useOrganizationUsers } from '@/hooks/useOrganizationUsers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { BrandLoader } from '@/components/ui/brand-loader';

export default function UsuariosOrgPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { appUser, authChecked } = useAuth();
  const { data, isLoading, isError, error } = useOrganizationUsers();
  const [modalOpen, setModalOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [inviteSentEmail, setInviteSentEmail] = useState('');
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [deletingUid, setDeletingUid] = useState<string | null>(null);

  const organization = data?.organization;
  const owner = data?.owner;
  const collaborators = data?.collaborators ?? [];
  const seats = data?.seats ?? { used: 0, max: 0, domain: '' };

  useEffect(() => {
    if (!authChecked) return;
    if (!canManageOrgUsers(appUser)) {
      router.replace('/dashboard');
    }
  }, [authChecked, appUser?.role, appUser?.orgRole, router]);

  useEffect(() => {
    if (isError && error) {
      toast.error(error instanceof Error ? error.message : 'Error al cargar');
    }
  }, [isError, error]);

  function openInviteModal() {
    setEmail('');
    setDisplayName('');
    setInviteError(null);
    setInviteSentEmail('');
    setModalOpen(true);
  }

  function closeInviteModal() {
    if (inviteSubmitting) return;
    setModalOpen(false);
    setEmail('');
    setDisplayName('');
    setInviteError(null);
    setInviteSentEmail('');
  }

  async function createInvitation(e: React.FormEvent) {
    e.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    const cleanName = displayName.trim();
    if (!isValidEmailFormat(normalizedEmail)) {
      toast.error('Correo electronico invalido');
      return;
    }
    if (!cleanName) {
      toast.error('Ingresa el nombre del delegado');
      return;
    }

    const ownerEmail = owner?.email?.trim().toLowerCase();
    if (ownerEmail && normalizedEmail === ownerEmail) {
      toast.error('No puedes invitar el correo del titular. Usa otro correo para el delegado.');
      return;
    }

    setInviteSubmitting(true);
    setInviteError(null);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/organization/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email: normalizedEmail, displayName: cleanName }),
      });
      const resData = await res.json();
      if (!res.ok) {
        const message = String(resData.error || 'Error');
        setInviteError(message);
        toast.error(message);
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ['organization', 'users'] });
      setInviteSentEmail(resData.email || normalizedEmail);
      setEmail('');
      setDisplayName('');
      toast.success('Invitacion enviada');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error';
      setInviteError(message);
      toast.error(message);
    } finally {
      setInviteSubmitting(false);
    }
  }

  async function deleteCollaborator(uid: string, label: string) {
    if (!confirm(`Eliminar a ${label || 'este delegado'}? Podras volver a invitar el mismo correo despues.`)) {
      return;
    }
    setDeletingUid(uid);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/organization/users/${uid}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || 'Error');
      await queryClient.invalidateQueries({ queryKey: ['organization', 'users'] });
      toast.success('Delegado eliminado');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error');
    } finally {
      setDeletingUid(null);
    }
  }

  async function patchUser(uid: string, patch: { orgRole?: OrgRole; accountStatus?: AccountStatus }) {
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/organization/users/${uid}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(patch),
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || 'Error');
      await queryClient.invalidateQueries({ queryKey: ['organization', 'users'] });
      toast.success('Usuario actualizado');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error');
    }
  }

  if (!authChecked || !canManageOrgUsers(appUser)) return null;

  const displayTitle = organization?.displayTitle || 'Tu organizacion';
  const displaySubtitle = organization?.displaySubtitle;

  return (
    <main className="min-h-[calc(100vh-5rem)] p-4 md:p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">{displayTitle}</h1>
            {displaySubtitle && <p className="mt-1 text-sm text-muted-foreground">{displaySubtitle}</p>}
            <p className="mt-2 text-sm text-muted-foreground">
              Cupos delegados: {seats.used} / {seats.max}
            </p>
          </div>
          <Button
            className="shrink-0 bg-yellow-400 font-bold text-black hover:bg-yellow-300"
            onClick={openInviteModal}
            disabled={seats.used >= seats.max}
          >
            <UserPlus className="size-4" />
            Invitar delegado
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <BrandLoader size="lg" label="Cargando usuarios" />
          </div>
        ) : (
          <div className="space-y-6">
            <section className="rounded-lg border bg-card">
              <div className="border-b px-4 py-3">
                <h2 className="text-sm font-semibold">Cuenta titular</h2>
                <p className="text-xs text-muted-foreground">
                  Persona que contrata la membresia y administra la organizacion
                </p>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Correo</TableHead>
                    <TableHead>Funcion</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell>{owner?.displayName || '-'}</TableCell>
                    <TableCell>{owner?.email || '-'}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{getOrgRoleLabel('cliente')}</Badge>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </section>

            <section className="rounded-lg border bg-card">
              <div className="border-b px-4 py-3">
                <h2 className="text-sm font-semibold">Personas delegadas</h2>
                <p className="text-xs text-muted-foreground">
                  Usuarios que realizan verificaciones en nombre del titular
                </p>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Correo</TableHead>
                    <TableHead>Funcion</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {collaborators.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        No hay delegados. Invita al primer usuario.
                      </TableCell>
                    </TableRow>
                  ) : (
                    collaborators.map((c) => {
                      const status = c.accountStatus ?? (c.disabled ? 'blocked' : 'active');
                      return (
                        <TableRow key={c.uid}>
                          <TableCell>{c.displayName || '-'}</TableCell>
                          <TableCell>{c.email}</TableCell>
                          <TableCell>{getOrgRoleLabel('colaborador', c.orgRole)}</TableCell>
                          <TableCell className="capitalize">{status}</TableCell>
                          <TableCell className="space-x-2 text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                patchUser(c.uid, {
                                  orgRole: c.orgRole === 'administrador' ? 'miembro' : 'administrador',
                                })
                              }
                            >
                              Permisos
                            </Button>
                            {status !== 'active' && (
                              <Button size="sm" variant="outline" onClick={() => patchUser(c.uid, { accountStatus: 'active' })}>
                                Activar
                              </Button>
                            )}
                            {status === 'active' && (
                              <Button size="sm" variant="outline" onClick={() => patchUser(c.uid, { accountStatus: 'inactive' })}>
                                Inactivar
                              </Button>
                            )}
                            {status !== 'blocked' && (
                              <Button size="sm" variant="destructive" onClick={() => patchUser(c.uid, { accountStatus: 'blocked' })}>
                                Bloquear
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={deletingUid === c.uid}
                              onClick={() => deleteCollaborator(c.uid, c.displayName || c.email)}
                            >
                              {deletingUid === c.uid ? 'Eliminando...' : 'Eliminar'}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </section>
          </div>
        )}
      </div>

      <Modal open={modalOpen} onClose={closeInviteModal} disableClose={inviteSubmitting}>
        {inviteSentEmail ? (
          <div className="space-y-4 p-2">
            <h2 className="text-lg font-bold">Invitacion enviada</h2>
            <p className="text-sm text-muted-foreground">
              Enviamos un enlace a {inviteSentEmail}. El delegado debe abrirlo, establecer su contrasena y confirmar para activar su usuario.
            </p>
            <Button onClick={closeInviteModal}>Cerrar</Button>
          </div>
        ) : (
          <form onSubmit={createInvitation} className="space-y-5 p-2">
            <h2 className="text-lg font-bold">Invitar delegado</h2>

            <div className="space-y-2">
              <Label htmlFor="delegate-email" className="block">Correo electronico</Label>
              <Input
                id="delegate-email"
                type="email"
                required
                value={email}
                onChange={(e) => {
                  setInviteError(null);
                  setEmail(e.target.value);
                }}
                placeholder="delegado@correo.com"
                disabled={inviteSubmitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="delegate-name" className="block">Nombre</Label>
              <Input
                id="delegate-name"
                required
                value={displayName}
                onChange={(e) => {
                  setInviteError(null);
                  setDisplayName(e.target.value);
                }}
                placeholder="Nombre del delegado"
                disabled={inviteSubmitting}
              />
            </div>

            {inviteError && (
              <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {inviteError}
              </p>
            )}

            <Button
              type="submit"
              disabled={inviteSubmitting || isLoading}
              aria-busy={inviteSubmitting}
              className="w-full bg-yellow-400 font-bold text-black hover:bg-yellow-300"
            >
              {inviteSubmitting ? 'Enviando invitacion...' : 'Enviar invitacion'}
            </Button>
          </form>
        )}
      </Modal>
    </main>
  );
}
