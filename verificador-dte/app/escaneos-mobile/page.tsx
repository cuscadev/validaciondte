'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import {
  ChevronDown,
  ChevronRight,
  Download,
  Folder,
  Loader2,
  Plus,
  QrCode,
  Trash2,
} from 'lucide-react';

import { useAuth } from '@/components/AuthProvider';
import PlanGate from '@/components/PlanGate';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
import { type DteResultRow } from '@/lib/dte-result-table';
import { formatDteResultDetail } from '@/lib/dte-result-normalize';

type Scan = {
  id?: string;
  value: string;
  scannedAt: string;
};

type Result = DteResultRow;

type ScanFolder = {
  id: string;
  code?: string;
  name: string;
  status?: 'pending' | 'processing' | 'processed' | 'error';
  scans?: Scan[];
  results?: Result[];
  createdAt?: string;
  updatedAt?: string;
};

type ScanSession = {
  id: string;
  code: string;
  folders: ScanFolder[];
  active?: boolean;
};

function statusLabel(status?: ScanFolder['status']) {
  if (status === 'processed') return 'Procesada';
  if (status === 'processing') return 'Procesando';
  if (status === 'error') return 'Error';
  return 'Pendiente';
}

function statusClass(status?: ScanFolder['status']) {
  if (status === 'processed') return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200';
  if (status === 'processing') return 'bg-primary/15 text-primary';
  if (status === 'error') return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200';
  return 'bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-200';
}

function estadoClass(value?: string) {
  if (value === 'EMITIDO') return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200';
  if (value === 'ANULADO') return 'bg-primary/15 text-primary bg-primary/15 text-primary';
  if (value === 'ERROR' || value === 'RECHAZADO') return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200';
  return 'bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-200';
}

function formatDate(value?: string) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function downloadExcel(base64: string, filename: string) {
  const link = document.createElement('a');
  link.href = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${base64}`;
  link.download = filename;
  link.click();
}

export default function EscaneosMobilePage() {
  const { firebaseUser, authChecked } = useAuth();
  const [session, setSession] = useState<ScanSession | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [clearingId, setClearingId] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});

  const folders = session?.folders || [];
  const totalScans = useMemo(
    () => folders.reduce((sum, folder) => sum + (folder.scans?.length || 0), 0),
    [folders]
  );

  const createSession = async () => {
    if (!firebaseUser) return;

    setCreating(true);

    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch('/api/mobile-scan-sessions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data?.error || 'No se pudo crear la sesión.');

      setSession(data.session);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error creando sesión.');
    } finally {
      setCreating(false);
      setSessionLoading(false);
    }
  };

  useEffect(() => {
    if (!authChecked) return;
    if (!firebaseUser) {
      setSessionLoading(false);
      return;
    }

    void createSession();
  }, [authChecked, firebaseUser]);

  useEffect(() => {
    if (!session?.id) return;

    const unsub = onSnapshot(
      doc(db, 'mobileScanSessions', session.id),
      (snap) => {
        if (!snap.exists()) return;
        setSession({ id: snap.id, ...(snap.data() as Omit<ScanSession, 'id'>) });
      },
      (error) => {
        toast.error(error.message || 'No se pudo escuchar la sesión en tiempo real.');
      }
    );

    return () => unsub();
  }, [session?.id]);

  const createFolder = async () => {
    if (!firebaseUser || !session?.id) return;

    setCreatingFolder(true);

    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch(`/api/mobile-scan-sessions/${session.id}/folders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: folderName.trim() || `Carpeta ${folders.length + 1}`,
        }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data?.error || 'No se pudo crear la carpeta.');

      setFolderName('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error creando carpeta.');
    } finally {
      setCreatingFolder(false);
    }
  };

  const clearFolder = async (folderId?: string, all = false) => {
    if (!firebaseUser || !session?.id) return;

    setClearingId(all ? 'all' : folderId || null);

    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch(`/api/mobile-scan-sessions/${session.id}/clear`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ folderId, all }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data?.error || 'No se pudo limpiar.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error limpiando.');
    } finally {
      setClearingId(null);
    }
  };

  const processFolder = async (folderId: string) => {
    if (!firebaseUser || !session?.id) return;

    setProcessingId(folderId);

    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch(`/api/mobile-scan-sessions/${session.id}/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ folderId, enrichCreditNotes: true }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data?.error || 'No se pudo procesar la carpeta.');

      if (data.excelBase64) {
        downloadExcel(data.excelBase64, data.filename || 'escaneos_mobile.xlsx');
      }

      toast.success('Carpeta procesada correctamente.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error procesando carpeta.');
    } finally {
      setProcessingId(null);
    }
  };

  const toggleFolder = (folderId: string) => {
    setExpandedFolders((current) => ({
      ...current,
      [folderId]: !current[folderId],
    }));
  };

  return (
    <PlanGate routeKey="escaneos-mobile">
    <main className="w-full max-w-full">
      <Card className="w-full max-w-full overflow-hidden border-border bg-card shadow-sm">
        <CardHeader className="border-b border-border bg-card/90">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-2xl text-foreground">
                <QrCode className="size-6 text-primary text-primary" />
                Escaneo desde la app
              </CardTitle>
              <CardDescription className="mt-2 text-muted-foreground">
                Crea carpetas con código propio para que mobile envíe cada escaneo a la carpeta correcta.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 p-4">
          <section className="grid gap-3 rounded-md border border-primary/30 bg-primary/10 p-4 dark:bg-primary/10 md:grid-cols-[1fr_auto]">
            <div>
              <label className="text-sm font-semibold text-foreground">
                Nueva carpeta
              </label>
              <input
                value={folderName}
                onChange={(event) => setFolderName(event.target.value)}
                placeholder="Ej. Compras viernes, auditoría, ruta 1"
                className="mt-2 h-10 w-full rounded-md border border-primary/30 bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary"
                maxLength={60}
              />
            </div>
            <div className="flex items-end">
              <Button
                className="bg-primary font-bold text-black hover:bg-primary/90"
                disabled={creatingFolder || !session?.id}
                onClick={createFolder}
              >
                {creatingFolder ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                Agregar carpeta
              </Button>
            </div>
          </section>

          <section className="grid gap-3 rounded-md border border-border bg-background p-4 text-sm md:grid-cols-3">
            <div>
              <div className="text-muted-foreground">Carpetas</div>
              <div className="mt-1 text-2xl font-bold">{folders.length}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Escaneos recibidos</div>
              <div className="mt-1 text-2xl font-bold">{totalScans}</div>
            </div>
            <div className="flex items-end justify-start md:justify-end">
              <div className="flex flex-wrap items-center justify-start gap-3 md:justify-end">
                <Button
                  variant="outline"
                  disabled={!session?.id || clearingId === 'all' || folders.length === 0 || !!processingId}
                  onClick={() => clearFolder(undefined, true)}
                >
                  {clearingId === 'all' ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                  Limpiar todas
                </Button>
              </div>
            </div>
          </section>

          <div className="overflow-hidden rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 bg-card">
                  <TableHead>Carpeta</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Links</TableHead>
                  <TableHead>Última actividad</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessionLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                      Preparando código...
                    </TableCell>
                  </TableRow>
                ) : folders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                      Crea una carpeta para obtener su código y empezar a recibir escaneos.
                    </TableCell>
                  </TableRow>
                ) : (
                  folders.map((folder) => {
                    const scanCount = folder.scans?.length || 0;
                    const isProcessing = processingId === folder.id;
                    const isClearing = clearingId === folder.id;
                    const isExpanded = !!expandedFolders[folder.id];

                    return (
                      <Fragment key={folder.id}>
                        <TableRow>
                          <TableCell>
                            <div className="space-y-1">
                              <button
                                type="button"
                                onClick={() => toggleFolder(folder.id)}
                                className="flex max-w-full items-center gap-2 text-left font-semibold hover:text-primary hover:text-primary"
                              >
                                {isExpanded ? (
                                  <ChevronDown className="size-4 shrink-0 text-primary text-primary" />
                                ) : (
                                  <ChevronRight className="size-4 shrink-0 text-primary text-primary" />
                                )}
                                <Folder className="size-4 shrink-0 text-primary text-primary" />
                                <span className="truncate">{folder.name}</span>
                              </button>
                              <div className="inline-flex rounded-md border border-primary/40 bg-primary/10 px-2 py-1 font-mono text-sm font-black tracking-[0.2em] text-foreground">
                                {folder.code || '------'}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={statusClass(folder.status)}>
                              {statusLabel(folder.status)}
                            </Badge>
                          </TableCell>
                          <TableCell>{scanCount}</TableCell>
                          <TableCell>{formatDate(folder.updatedAt || folder.createdAt)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => toggleFolder(folder.id)}
                              >
                                {isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                                {isExpanded ? 'Ocultar' : 'Ver'}
                              </Button>
                              <Button
                                size="sm"
                                className="bg-primary font-bold text-black hover:bg-primary/90"
                                disabled={!!processingId || scanCount === 0}
                                onClick={() => processFolder(folder.id)}
                              >
                                {isProcessing ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                                Procesar
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={isClearing || !!processingId}
                                onClick={() => clearFolder(folder.id)}
                              >
                                {isClearing ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                                Limpiar
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                        {isExpanded ? (
                          <TableRow>
                            <TableCell colSpan={5} className="bg-background/30 p-4">
                              <FolderDetails folder={folder} />
                            </TableCell>
                          </TableRow>
                        ) : null}
                      </Fragment>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Plus className="size-4" />
            Cada carpeta tiene su propio código para mobile. No hay límite de carpetas; el máximo de links por carpeta depende de la membresía.
          </div>
        </CardContent>
      </Card>
    </main>
    </PlanGate>
  );
}

function FolderDetails({ folder }: { folder: ScanFolder }) {
  const results = folder.results || [];
  const scans = folder.scans || [];
  const hasResults = results.length > 0;
  const rows = hasResults ? results : scans;

  return (
    <div className="max-h-[24rem] overflow-auto rounded-md border border-border bg-card">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-card text-foreground">
          <tr>
            <th className="p-2 text-left">#</th>
            <th className="p-2 text-left">{hasResults ? 'Código' : 'Link'}</th>
            <th className="p-2 text-left">{hasResults ? 'Estado' : 'Escaneado'}</th>
            <th className="p-2 text-left">Detalle</th>
            <th className="p-2 text-left">Abrir</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={5} className="p-4 text-center text-muted-foreground">
                Sin links en esta carpeta.
              </td>
            </tr>
          ) : (
            rows.map((row, index) => {
              const result = row as Result;
              const scan = row as Scan;
              const link = result.linkVisita || result.url || scan.value || '';

              return (
                <tr key={`${link}-${index}`} className="hover:bg-muted/40">
                  <td className="p-2 align-top text-muted-foreground">{index + 1}</td>
                  <td className="max-w-[28rem] truncate p-2 align-top font-mono text-xs">
                    {hasResults ? result.codGen || '-' : scan.value}
                  </td>
                  <td className="p-2 align-top">
                    {hasResults ? (
                      <span className={`rounded-full px-2 py-0.5 text-xs ${estadoClass(result.estado)}`}>
                        {result.estado || '-'}
                      </span>
                    ) : (
                      formatDate(scan.scannedAt)
                    )}
                  </td>
                  <td className="max-w-[24rem] p-2 align-top text-muted-foreground">
                    {hasResults ? (
                      <span className="line-clamp-3 whitespace-normal text-xs">
                        {formatDteResultDetail(result as DteResultRow)}
                      </span>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="p-2 align-top">
                    {link ? (
                      <a
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-semibold text-primary underline-offset-4 hover:underline text-primary"
                      >
                        Abrir
                      </a>
                    ) : (
                      '-'
                    )}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
