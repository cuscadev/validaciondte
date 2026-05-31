// Página para que administradores vean solicitudes de acceso
'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { collection, getDocs } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';

interface AccessRequest {
  id: string;
  nombre: string;
  email: string;
  telefono: string;
  mensaje: string;
  status: string;
  photoURL?: string;
  imageUrl?: string;
  createdAt?: { seconds: number; nanoseconds: number };
}

const PAGE_SIZE = 10;
const ACCESS_REQUESTS_QUERY_KEY = ['admin', 'access-requests'] as const;

function StatusBadge({ status, t }: { status: string; t: (key: string, options?: Record<string, unknown>) => string }) {
  if (status === 'approved') return <Badge className="bg-green-500 text-white">{t('accessRequests.statusApproved')}</Badge>;
  if (status === 'rejected') return <Badge variant="destructive">{t('accessRequests.statusRejected')}</Badge>;
  return <Badge variant="outline">{t('accessRequests.statusPending')}</Badge>;
}

function formatDate(createdAt: { seconds: number; nanoseconds: number } | undefined, locale: string) {
  if (!createdAt) return '—';
  return new Date(createdAt.seconds * 1000).toLocaleDateString(locale === 'en' ? 'en-US' : 'es-SV', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('') || '?';
}

export default function AccessRequestsPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/admin/organizaciones');
  }, [router]);

  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [requestToReject, setRequestToReject] = useState<AccessRequest | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const { t, i18n } = useTranslation();

  const statusOptions = [
    { value: 'all', label: t('accessRequests.filterAll') },
    { value: 'pending', label: t('accessRequests.statusPending') },
    { value: 'approved', label: t('accessRequests.statusApproved') },
    { value: 'rejected', label: t('accessRequests.statusRejected') },
  ];

  const { data: requests = [], isLoading: loading } = useQuery({
    queryKey: ACCESS_REQUESTS_QUERY_KEY,
    queryFn: async () => {
      const snap = await getDocs(collection(db, 'accessRequests'));
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as AccessRequest));
      data.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
      return data;
    },
  });

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [search, statusFilter]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return requests.filter(r => {
      const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
      const matchesSearch = !q || r.nombre.toLowerCase().includes(q) || r.email.toLowerCase().includes(q);
      return matchesStatus && matchesSearch;
    });
  }, [requests, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleApprove = async (req: AccessRequest) => {
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('No autorizado');
      const res = await fetch('/api/access-requests/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ requestId: req.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t('accessRequests.errorApprove'));
      toast.success('Solicitud aprobada. Se envio la contrasena temporal al correo del cliente.');
      queryClient.setQueryData<AccessRequest[]>(ACCESS_REQUESTS_QUERY_KEY, prev =>
        prev?.map(r => r.id === req.id ? { ...r, status: 'approved' } : r) ?? prev
      );
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('accessRequests.errorApprove'));
    }
  };

  const handleReject = async (req: AccessRequest) => {
    setRejecting(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('No autorizado');
      const res = await fetch('/api/access-requests/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ requestId: req.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t('accessRequests.errorReject'));
      toast.error(t('rejected'));
      queryClient.setQueryData<AccessRequest[]>(ACCESS_REQUESTS_QUERY_KEY, prev =>
        prev?.map(r => r.id === req.id ? { ...r, status: 'rejected' } : r) ?? prev
      );
      setRequestToReject(null);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('accessRequests.errorReject'));
    } finally {
      setRejecting(false);
    }
  };

  return (
    <main className="min-h-screen bg-background p-8">
      <Card>
        <CardHeader>
          <CardTitle>{t('accessRequestsTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Filtros */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={t('accessRequests.searchPlaceholder')}
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-1 flex-wrap">
              {statusOptions.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setStatusFilter(opt.value)}
                  className={[
                    'px-3 py-1.5 rounded-md text-sm font-medium border transition-colors',
                    statusFilter === opt.value
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background border-input text-muted-foreground hover:bg-muted',
                  ].join(' ')}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="text-muted-foreground py-4">{t('loading')}</div>
          ) : filtered.length === 0 ? (
            <div className="text-muted-foreground py-8 text-center">{t('accessRequests.noResults')}</div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('accessRequests.image')}</TableHead>
                    <TableHead>{t('name')}</TableHead>
                    <TableHead>{t('email')}</TableHead>
                    <TableHead>{t('phone')}</TableHead>
                    <TableHead>{t('message')}</TableHead>
                    <TableHead>{t('accessRequests.date')}</TableHead>
                    <TableHead>{t('status')}</TableHead>
                    <TableHead className="text-right">{t('accessRequests.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.map(req => (
                    <TableRow key={req.id}>
                      <TableCell>
                        <div className="flex items-center justify-center">
                          {req.photoURL || req.imageUrl ? (
                            <div className="relative h-10 w-10 overflow-hidden rounded-full border border-border bg-muted">
                              <Image
                                src={req.photoURL ?? req.imageUrl ?? ''}
                                alt={req.nombre}
                                fill
                                className="object-cover"
                              />
                            </div>
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-muted text-xs font-semibold text-muted-foreground">
                              {getInitials(req.nombre)}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{req.nombre}</TableCell>
                      <TableCell>{req.email}</TableCell>
                      <TableCell>{req.telefono}</TableCell>
                      <TableCell className="max-w-[200px] truncate" title={req.mensaje}>{req.mensaje}</TableCell>
                      <TableCell className="whitespace-nowrap">{formatDate(req.createdAt, i18n.language)}</TableCell>
                      <TableCell><StatusBadge status={req.status} t={t} /></TableCell>
                      <TableCell className="text-right">
                        {req.status === 'pending' && (
                          <div className="flex justify-end gap-2">
                            <Button size="sm" onClick={() => handleApprove(req)}>{t('approve')}</Button>
                            <Button size="sm" variant="destructive" onClick={() => setRequestToReject(req)}>{t('reject')}</Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Paginador */}
              <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
                <span>
                  {t('accessRequests.showing', {
                    from: Math.min((page - 1) * PAGE_SIZE + 1, filtered.length),
                    to: Math.min(page * PAGE_SIZE, filtered.length),
                    total: filtered.length,
                  })}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                    .reduce<(number | '...')[]>((acc, p, idx, arr) => {
                      if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('...');
                      acc.push(p);
                      return acc;
                    }, [])
                    .map((p, idx) =>
                      p === '...' ? (
                        <span key={`ellipsis-${idx}`} className="px-2">…</span>
                      ) : (
                        <Button
                          key={p}
                          variant={page === p ? 'default' : 'outline'}
                          size="icon"
                          onClick={() => setPage(p as number)}
                          className="w-8 h-8"
                        >
                          {p}
                        </Button>
                      )
                    )}
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Modal open={requestToReject !== null} onClose={() => !rejecting && setRequestToReject(null)}>
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold">{t('accessRequests.rejectModalTitle')}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {requestToReject
                ? t('accessRequests.rejectModalDescriptionNamed', { name: requestToReject.nombre })
                : t('accessRequests.rejectModalDescription')}
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setRequestToReject(null)}
              disabled={rejecting}
            >
              {t('usuarios_cancelar')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => requestToReject && handleReject(requestToReject)}
              disabled={rejecting}
            >
              {rejecting ? t('accessRequests.rejecting') : t('reject')}
            </Button>
          </div>
        </div>
      </Modal>
    </main>
  );
}
