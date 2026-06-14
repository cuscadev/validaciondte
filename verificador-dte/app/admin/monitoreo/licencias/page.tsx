'use client';

import { type ChangeEvent, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { auth } from '@/lib/firebase';
import { invalidateGetQueries, useGetQuery } from '@/lib/tanstack-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Ban, MoreHorizontal, Pencil, Trash2, Unlock } from 'lucide-react';
import { toast } from 'sonner';

type DesktopLicense = {
  id: string;
  active?: boolean;
  plan?: string;
  userId?: string;
  userEmail?: string;
  expiresAt?: string;
  allowedDevices?: string[];
};

type DesktopLicensesResponse = {
  licenses?: DesktopLicense[];
};

const LICENSES_QUERY_KEY = ['desktop-licenses'] as const;

const DEFAULT_FORM = {
  licenseKey: '',
  active: true,
  plan: 'desktop',
  userEmail: '',
  expiresAt: '',
  allowedDevices: '',
  generatedPassword: '',
};

export default function DesktopLicensesPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);

  const { data: licenses = [], isFetching, error } = useGetQuery<
    DesktopLicensesResponse,
    DesktopLicense[]
  >({
    queryKey: [...LICENSES_QUERY_KEY, filter],
    path: '/api/desktop/licenses',
    params: { q: filter || undefined },
    overrides: {
      select: (data) => data.licenses ?? [],
    },
  });

  const refreshLicenses = () => invalidateGetQueries(queryClient, LICENSES_QUERY_KEY);

  const handleInputChange = (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const target = event.target;
    const { name, value, type } = target;
    const checked = 'checked' in target ? target.checked : false;
    setForm((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSaveLicense = async () => {
    if (!form.licenseKey.trim()) {
      toast.warning('La clave de licencia es obligatoria');
      return;
    }

    setSaving(true);

    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('No autorizado');

      const payload = {
        licenseKey: form.licenseKey.trim(),
        active: form.active,
        plan: form.plan || 'desktop',
        userEmail: form.userEmail.trim() || null,
        expiresAt: form.expiresAt || null,
        allowedDevices: form.allowedDevices
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean),
      };

      const res = await fetch('/api/desktop/licenses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json() as { success?: boolean; passwordSent?: boolean; generatedPassword?: string | null; error?: string };
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'No se pudo guardar la licencia');
      }

      if (data.generatedPassword) {
        setForm((current) => ({ ...current, generatedPassword: data.generatedPassword || '' }));
      }
      setEditingId(null);
      toast.success(
        data.passwordSent
          ? 'Licencia guardada y contraseña enviada por correo.'
          : 'Licencia guardada correctamente'
      );
      await refreshLicenses();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error guardando la licencia');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActiveLicense = async (license: DesktopLicense) => {
    if (!license.id) return;
    if (!confirm(license.active ? 'Bloquear esta licencia?' : 'Activar esta licencia?')) return;

    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('No autorizado');

      const res = await fetch('/api/desktop/licenses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          licenseKey: license.id,
          active: !license.active,
          plan: license.plan || 'desktop',
          userEmail: license.userEmail || null,
          expiresAt: license.expiresAt || null,
          allowedDevices: license.allowedDevices || [],
        }),
      });

      const data = await res.json() as { success?: boolean; error?: string };
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'No se pudo actualizar la licencia');
      }

      await refreshLicenses();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error actualizando licencia');
    }
  };

  const handleDeleteLicense = async (licenseKey: string) => {
    if (!confirm('Eliminar esta licencia? Esto no se puede deshacer.')) return;

    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('No autorizado');

      const res = await fetch('/api/desktop/licenses', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ licenseKey }),
      });

      const data = await res.json() as { success?: boolean; error?: string };
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'No se pudo eliminar la licencia');
      }

      await refreshLicenses();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error eliminando licencia');
    }
  };

  return (
    <main className="space-y-5">
      <section className="rounded-lg border bg-background p-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">Monitoreo</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">Gestión de licencias desktop</h1>
            <p className="mt-1 text-sm text-muted-foreground">Administra licencias, controla dispositivos autorizados y revisa vencimientos.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => {
              setEditingId(null);
              setForm(DEFAULT_FORM);
              setShowModal(true);
            }}>Nueva licencia</Button>
            <Button onClick={() => refreshLicenses()} disabled={isFetching}>
              {isFetching ? 'Cargando...' : 'Actualizar'}
            </Button>
          </div>
        </div>
      </section>
      <Modal open={showModal} onClose={() => {
        setShowModal(false);
        setEditingId(null);
        setForm(DEFAULT_FORM);
      }}>
        <div className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold">{editingId ? 'Editar licencia desktop' : 'Crear licencia desktop'}</h2>
            <p className="text-sm text-muted-foreground">{editingId ? 'Actualiza datos de la licencia desktop.' : 'Registra una nueva licencia para autorizar equipos y usuarios desktop.'}</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Clave de licencia</label>
              <Input name="licenseKey" value={form.licenseKey} onChange={handleInputChange} placeholder="KAISER-XXXX" />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Usuario asignado</label>
              <Input name="userEmail" value={form.userEmail} onChange={handleInputChange} placeholder="cliente@empresa.com" />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Plan</label>
              <select name="plan" value={form.plan} onChange={handleInputChange} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                <option value="desktop">desktop</option>
                <option value="enterprise">enterprise</option>
                <option value="premium">premium</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                <input type="checkbox" name="active" checked={form.active} onChange={handleInputChange} className="h-4 w-4 rounded border" />
                Activa
              </label>
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Expira</label>
              <Input type="date" name="expiresAt" value={form.expiresAt} onChange={handleInputChange} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Dispositivos autorizados</label>
              <Input
                name="allowedDevices"
                value={form.allowedDevices}
                onChange={handleInputChange}
                placeholder="device-1, device-2"
              />
              <p className="text-xs text-muted-foreground">Separa los deviceId con comas.</p>
            </div>
            {form.generatedPassword && (
              <div className="space-y-2 md:col-span-2 rounded-lg bg-primary/10 p-3 dark:bg-primary/100/10">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Contraseña generada</label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded bg-muted px-2 py-2 font-mono text-sm">{form.generatedPassword}</code>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(form.generatedPassword);
                      alert('Contraseña copiada al portapapeles');
                    }}
                  >
                    Copiar
                  </Button>
                </div>
                <p className="text-xs text-primary">Esta contraseña fue enviada por correo. Muéstrala al usuario si es necesario.</p>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => {
              setShowModal(false);
              setEditingId(null);
              setForm(DEFAULT_FORM);
            }} disabled={saving}>Cancelar</Button>
            {!form.generatedPassword && (
              <Button onClick={handleSaveLicense} disabled={saving}>{saving ? 'Guardando...' : 'Guardar licencia'}</Button>
            )}
          </div>
        </div>
      </Modal>

      <section className="rounded-lg border bg-muted/30 p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <Input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Buscar por licencia o correo" />
          <div className="flex gap-2">
            <Button type="button" onClick={() => setFilter('')}>Limpiar</Button>
            <Button type="button" onClick={() => refreshLicenses()} disabled={isFetching}>Buscar</Button>
          </div>
        </div>
      </section>

      {error ? (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error instanceof Error ? error.message : 'No se pudieron cargar las licencias'}</div>
      ) : (
        <div className="overflow-auto rounded-md border bg-background">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="px-3 py-2 text-left">Licencia</th>
                <th className="px-3 py-2 text-left">Usuario</th>
                <th className="px-3 py-2 text-left">Activo</th>
                <th className="px-3 py-2 text-left">Plan</th>
                <th className="px-3 py-2 text-left">Expira</th>
                <th className="px-3 py-2 text-left">Dispositivos</th>
                <th className="px-3 py-2 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {licenses.map((license) => (
                <tr key={license.id} className="border-t">
                  <td className="px-3 py-2 font-medium">{license.id}</td>
                  <td className="px-3 py-2">{license.userEmail || license.userId || '-'}</td>
                  <td className="px-3 py-2">{license.active ? 'Sí' : 'No'}</td>
                  <td className="px-3 py-2">{license.plan || '-'}</td>
                  <td className="px-3 py-2">{license.expiresAt ? new Date(license.expiresAt).toLocaleDateString() : '-'}</td>
                  <td className="px-3 py-2">{license.allowedDevices?.length || 0}</td>
                  <td className="px-3 py-2 text-center">
                    <div className="flex justify-center">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" title="Más acciones">
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          <DropdownMenuItem onClick={() => {
                            setEditingId(license.id);
                            setForm({
                              ...DEFAULT_FORM,
                              licenseKey: license.id,
                              active: license.active ?? true,
                              plan: license.plan || 'desktop',
                              userEmail: license.userEmail || '',
                              expiresAt: license.expiresAt ? new Date(license.expiresAt).toISOString().slice(0, 10) : '',
                              allowedDevices: (license.allowedDevices || []).join(', '),
                            });
                            setShowModal(true);
                          }}>
                            <Pencil className="size-4" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleToggleActiveLicense(license)}>
                            {license.active ? <Ban className="size-4" /> : <Unlock className="size-4" />}
                            {license.active ? 'Bloquear' : 'Activar'}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem variant="destructive" onClick={() => handleDeleteLicense(license.id)}>
                            <Trash2 className="size-4" />
                            Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </td>
                </tr>
              ))}
              {licenses.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">No se encontraron licencias.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
