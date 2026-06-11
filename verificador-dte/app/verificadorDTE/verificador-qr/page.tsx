'use client';

import PlanGate from '@/components/PlanGate';
import UploadResultsReveal from '@/components/upload/UploadResultsReveal';
import UploadTableToolbar from '@/components/upload/UploadTableToolbar';
import UploadTableBasicFilters, {
  countBasicFilters,
} from '@/components/upload/UploadTableBasicFilters';
import { useUploadResultsReveal } from '@/components/upload/useUploadResultsReveal';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useAuth } from '@/components/AuthProvider';
import { auth } from '@/lib/firebase';
import { recordProcessingLog } from '@/lib/client-processing-log';
import {
  DTE_RESULT_COLUMNS,
  type DteResultRow,
  dteResultSearchFields,
  isDteResultLongTextColumn,
  renderDteResultCell,
} from '@/lib/dte-result-table';
import {
  buildExportFilename,
  exportPdfByProfile,
  exportRowsToCsv,
} from '@/lib/upload-table-export';
import { parseConsultaPublicaUrl } from '@/lib/hacienda-consulta-url';
import { DEFAULT_CONCURRENCY, pollDteJob } from '@/lib/go-dte-api';
import { summarizeResults } from '@/lib/processing-log';
import { cn } from '@/lib/utils';
import {
  Camera,
  CameraOff,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Loader2,
  Maximize2,
  Minimize2,
  QrCode,
  Trash2,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import QrScanner from 'qr-scanner';
import { toast } from 'sonner';

const ROUTE_KEY = 'verificador_qr';
const MODULE_NAME = 'Escaneo QR DTE';
const PRODUCTION_AMBIENTE = '01';

type CameraPermission = 'unknown' | 'requesting' | 'granted' | 'denied';

type PendingScan = {
  id: string;
  scanNumber: number;
  raw: string;
  codGen: string;
  fechaDmy: string;
  ambiente: string;
  urlOriginal: string;
  urlNormalizada: string;
};

type CameraOption = {
  id: string;
  label: string;
};

function isCameraPermissionDenied(error: unknown) {
  return (error as { name?: string })?.name === 'NotAllowedError';
}

function isInterruptedCameraStart(error: unknown) {
  const err = error as { name?: string; message?: string };
  return (
    err?.name === 'AbortError' ||
    /play\(\) request was interrupted|new load request/i.test(err?.message || '')
  );
}

function getCameraErrorMessage(error: unknown) {
  if (error === 'Camera not found.') {
    return 'No se encontro ninguna camara disponible.';
  }

  const err = error as { name?: string; message?: string };
  if (err?.name === 'NotAllowedError') {
    return 'Permiso de camara denegado. Habilita el acceso en la configuracion del sitio y vuelve a intentar.';
  }
  if (err?.name === 'NotFoundError') {
    return 'No se encontro ninguna camara disponible.';
  }
  if (err?.name === 'NotReadableError') {
    return 'La camara esta en uso por otra aplicacion.';
  }
  if (err?.name === 'OverconstrainedError') {
    return 'No se pudo inicializar la camara seleccionada.';
  }
  if (isInterruptedCameraStart(error)) {
    return 'No se pudo iniciar la camara. Intenta de nuevo.';
  }
  return err?.message || 'No se pudo abrir la camara.';
}

function isMobileDevice() {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

function pickPreferredCamera(cameras: { id: string; label: string }[]) {
  if (!cameras.length) return null;

  const preferRear = isMobileDevice();
  const rearPattern = /rear|back|environment|trasera|achter/i;
  const frontPattern = /front|user|face|integrat|voorzijde|frontal/i;
  const pattern = preferRear ? rearPattern : frontPattern;

  const preferred = cameras.find((camera) => pattern.test(camera.label));
  return preferred?.id ?? cameras[0].id;
}

function getCameraDisplayLabel(camera: CameraOption, index: number) {
  const label = camera.label.trim();
  if (/rear|back|environment|trasera|achter/i.test(label)) {
    return `Trasera - ${label}`;
  }
  if (/front|user|face|integrat|voorzijde|frontal|selfie/i.test(label)) {
    return `Selfie - ${label}`;
  }
  if (label) return label;
  return `Camara ${index + 1}`;
}

function normalizeDuplicateKey(value: string) {
  return value.trim().toLowerCase();
}

function VerificadorQrContent() {
  const { appUser, firebaseUser } = useAuth();
  const createdBy =
    appUser?.displayName ||
    appUser?.email ||
    firebaseUser?.displayName ||
    firebaseUser?.email ||
    'Usuario';

  const [pendingScans, setPendingScans] = useState<PendingScan[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [cameraPermission, setCameraPermission] = useState<CameraPermission>('unknown');
  const [cameras, setCameras] = useState<CameraOption[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState('');
  const [cameraExpanded, setCameraExpanded] = useState(false);
  const [scanError, setScanError] = useState('');
  const [lastScan, setLastScan] = useState('');
  const [lastAddedCodGen, setLastAddedCodGen] = useState('');
  const [highlightedScanId, setHighlightedScanId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorGlobal, setErrorGlobal] = useState<string | null>(null);
  const [data, setData] = useState<DteResultRow[]>([]);
  const [downloadHref, setDownloadHref] = useState<string | null>(null);
  const [filename, setFilename] = useState('resultados_dtes.xlsx');
  const [search, setSearch] = useState('');
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [progressDone, setProgressDone] = useState(0);
  const [progressTotal, setProgressTotal] = useState(0);
  const { resultsVisible, resetResultsVisibility, onResultsReveal } =
    useUploadResultsReveal();

  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraFrameRef = useRef<HTMLDivElement>(null);
  const scannerRef = useRef<QrScanner | null>(null);
  const cameraStartRequestRef = useRef(0);
  const scanLockRef = useRef(false);
  const pendingListRef = useRef<HTMLDivElement>(null);
  const scanCounterRef = useRef(0);
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startScanningRef = useRef<((cameraIdOverride?: string) => Promise<void>) | null>(null);

  const stopScanning = useCallback(() => {
    cameraStartRequestRef.current += 1;
    if (scannerRef.current) {
      scannerRef.current.stop();
      scannerRef.current.destroy();
      scannerRef.current = null;
    }
    setIsScanning(false);
  }, []);

  const processQR = useCallback((decodedText: string) => {
    setScanError('');
    setLastScan(decodedText);

    const parsed = parseConsultaPublicaUrl(decodedText, PRODUCTION_AMBIENTE);
    if (!parsed.ok) {
      setScanError(parsed.error);
      toast.error(parsed.error);
      return;
    }

    let duplicate = false;
    const created: { item: PendingScan | null } = { item: null };

    setPendingScans((prev) => {
      const incomingCodGen = normalizeDuplicateKey(parsed.codGen);
      const incomingOriginalUrl = normalizeDuplicateKey(parsed.urlOriginal);
      const incomingNormalizedUrl = normalizeDuplicateKey(parsed.urlNormalizada);

      const alreadyScanned = prev.some((item) => {
        const existingCodGen = normalizeDuplicateKey(item.codGen);
        const existingOriginalUrl = normalizeDuplicateKey(item.urlOriginal);
        const existingNormalizedUrl = normalizeDuplicateKey(item.urlNormalizada);

        return (
          existingCodGen === incomingCodGen ||
          existingOriginalUrl === incomingOriginalUrl ||
          existingOriginalUrl === incomingNormalizedUrl ||
          existingNormalizedUrl === incomingOriginalUrl ||
          existingNormalizedUrl === incomingNormalizedUrl
        );
      });

      if (alreadyScanned) {
        duplicate = true;
        return prev;
      }

      scanCounterRef.current += 1;
      const item: PendingScan = {
        id: `${parsed.codGen}-${Date.now()}`,
        scanNumber: scanCounterRef.current,
        raw: decodedText,
        codGen: parsed.codGen,
        fechaDmy: parsed.fechaDmy,
        ambiente: parsed.ambiente,
        urlOriginal: parsed.urlOriginal,
        urlNormalizada: parsed.urlNormalizada,
      };
      created.item = item;

      return [item, ...prev];
    });

    if (duplicate) {
      setScanError('Este enlace ya fue escaneado.');
      toast.error('Este enlace ya fue escaneado.');
      return;
    }

    if (!created.item) return;

    setLastAddedCodGen(parsed.codGen);
    setHighlightedScanId(created.item.id);

    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
    }
    highlightTimeoutRef.current = setTimeout(() => {
      setHighlightedScanId(null);
    }, 1500);

    requestAnimationFrame(() => {
      pendingListRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    });

    toast.success(`DTE #${created.item.scanNumber} agregado.`);
  }, []);

  const startScanning = useCallback(async (cameraIdOverride?: string) => {
    if (!videoRef.current) return;
    const requestId = cameraStartRequestRef.current + 1;
    cameraStartRequestRef.current = requestId;

    try {
      setScanError('');
      scanLockRef.current = false;

      if (scannerRef.current) {
        scannerRef.current.stop();
        scannerRef.current.destroy();
        scannerRef.current = null;
      }

      const cameras = await QrScanner.listCameras(true);
      if (requestId !== cameraStartRequestRef.current) return;

      if (!cameras?.length) {
        setScanError('No se detecto ninguna camara.');
        setIsScanning(false);
        setCameraPermission('unknown');
        setCameras([]);
        setSelectedCameraId('');
        return;
      }

      setCameras(cameras);

      const preferredCameraId =
        cameraIdOverride && cameras.some((camera) => camera.id === cameraIdOverride)
          ? cameraIdOverride
          : selectedCameraId && cameras.some((camera) => camera.id === selectedCameraId)
            ? selectedCameraId
          : pickPreferredCamera(cameras) ?? cameras[0].id;

      setSelectedCameraId(preferredCameraId);

      scannerRef.current = new QrScanner(
        videoRef.current,
        (result) => {
          if (scanLockRef.current) return;
          scanLockRef.current = true;
          processQR(result.data);
          setTimeout(() => {
            scanLockRef.current = false;
          }, 1500);
        },
        {
          highlightScanRegion: true,
          highlightCodeOutline: true,
          returnDetailedScanResult: true,
          preferredCamera: preferredCameraId,
        }
      );

      await scannerRef.current.start();
      if (requestId !== cameraStartRequestRef.current) return;

      setIsScanning(true);
      setCameraPermission('granted');
    } catch (error) {
      if (requestId !== cameraStartRequestRef.current) return;

      if (isInterruptedCameraStart(error)) {
        setScanError('');
        setIsScanning(false);
        setCameraPermission('unknown');
        return;
      }

      setIsScanning(false);
      const message = getCameraErrorMessage(error);
      setScanError(message);
      setCameraPermission(isCameraPermissionDenied(error) ? 'denied' : 'unknown');
    }
  }, [processQR, selectedCameraId]);

  startScanningRef.current = startScanning;

  const requestPermissionAndScan = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setScanError('Tu navegador no soporta acceso a la camara.');
      return;
    }

    setCameraPermission('requesting');
    setScanError('');
    await startScanning();
  }, [startScanning]);

  useEffect(() => {
    let cancelled = false;
    let permissionStatus: PermissionStatus | null = null;

    const applyPermissionState = (state: PermissionState) => {
      if (cancelled) return;

      if (state === 'granted') {
        setCameraPermission('granted');
        void startScanningRef.current?.();
        return;
      }

      if (state === 'denied') {
        setCameraPermission('denied');
        return;
      }

      setCameraPermission('unknown');
    };

    async function syncPermission() {
      if (!navigator.mediaDevices?.getUserMedia) return;

      try {
        if (!navigator.permissions?.query) return;

        permissionStatus = await navigator.permissions.query({
          name: 'camera' as PermissionName,
        });
        if (cancelled) return;

        applyPermissionState(permissionStatus.state);
        permissionStatus.onchange = () => {
          applyPermissionState(permissionStatus!.state);
        };
      } catch {
        // Permissions API unsupported; user will tap the button.
      }
    }

    void syncPermission();

    return () => {
      cancelled = true;
      if (permissionStatus) {
        permissionStatus.onchange = null;
      }
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }
      stopScanning();
    };
  }, [stopScanning]);

  const removeScan = (id: string) => {
    setPendingScans((prev) => prev.filter((item) => item.id !== id));
  };

  const clearScans = () => {
    setPendingScans([]);
    scanCounterRef.current = 0;
    setScanError('');
    setLastScan('');
    setLastAddedCodGen('');
    setHighlightedScanId(null);
  };

  const handleCameraChange = (cameraId: string) => {
    setSelectedCameraId(cameraId);
    if (isScanning) {
      void startScanning(cameraId);
    }
  };

  const verificarEscaneos = async () => {
    resetResultsVisibility();
    setErrorGlobal(null);
    setDownloadHref(null);
    setCurrentPage(1);

    if (!pendingScans.length) {
      const msg = 'Escanea al menos un codigo QR antes de verificar.';
      setErrorGlobal(msg);
      toast.error(msg);
      return;
    }

    setLoading(true);
    setProgressDone(0);
    setProgressTotal(pendingScans.length);
    const startedAt = new Date();
    const started = performance.now();
    const emptyFiles = { count: 0, totalBytes: 0, extensions: [], mimeTypes: [] };

    try {
      const token = await (firebaseUser || auth.currentUser)?.getIdToken();
      if (!token) throw new Error('No autorizado');

      const limitRes = await fetch('/api/usage-limits/check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          routeKey: ROUTE_KEY,
          incomingRecords: pendingScans.length,
        }),
      });
      const limitPayload = await limitRes.json();
      if (!limitRes.ok || !limitPayload.allowed) {
        throw new Error(limitPayload.error || 'Limite mensual alcanzado.');
      }

      const res = await fetch('/api/verificador-qr', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          routeKey: ROUTE_KEY,
          scans: pendingScans.map((item) => item.raw),
          ambiente: PRODUCTION_AMBIENTE,
          concurrencia: DEFAULT_CONCURRENCY,
          includeExcel: true,
          async: pendingScans.length > 10,
        }),
      });

      let payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || res.statusText);

      if (payload.jobId && payload.status === 'pending') {
        payload = await pollDteJob(payload.jobId, (status) => {
          setProgressDone(status.done ?? 0);
          setProgressTotal(status.total ?? pendingScans.length);
        });
      }

      const resultados = (payload.resultados as DteResultRow[]) || [];
      setData(resultados);
      setFilename(payload.filename || 'resultados_dtes.xlsx');
      setDownloadHref(
        payload.excelBase64
          ? `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${payload.excelBase64}`
          : null
      );
      onResultsReveal();
      toast.success('Verificacion completada.');
      await recordProcessingLog({
        routeKey: ROUTE_KEY,
        moduleName: MODULE_NAME,
        startedAt: startedAt.toISOString(),
        endedAt: new Date().toISOString(),
        durationMs: Math.round(performance.now() - started),
        files: emptyFiles,
        ...summarizeResults(resultados),
      });
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : 'Error inesperado al verificar.';
      setErrorGlobal(msg);
      toast.error(msg);
      await recordProcessingLog({
        routeKey: ROUTE_KEY,
        moduleName: MODULE_NAME,
        startedAt: startedAt.toISOString(),
        endedAt: new Date().toISOString(),
        durationMs: Math.round(performance.now() - started),
        files: emptyFiles,
        totalRecords: pendingScans.length,
        successCount: 0,
        errorCount: pendingScans.length,
        statusBreakdown: { ERROR: pendingScans.length },
        outcome: 'error',
        errorMessage: msg,
      });
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data;
    return data.filter((row) =>
      dteResultSearchFields(row).some((value) => value.toLowerCase().includes(q))
    );
  }, [data, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [filtered.length, rowsPerPage, totalPages, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  useEffect(() => {
    const frame = cameraFrameRef.current;
    if (!frame || typeof ResizeObserver === 'undefined') return;

    const refreshScannerOverlay = () => {
      window.dispatchEvent(new Event('resize'));
    };

    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(refreshScannerOverlay);
    });
    resizeObserver.observe(frame);

    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    requestAnimationFrame(() => {
      window.dispatchEvent(new Event('resize'));
    });
  }, [cameraExpanded]);

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filtered.slice(start, start + rowsPerPage);
  }, [filtered, currentPage, rowsPerPage]);

  const showCameraPlaceholder = !isScanning;

  return (
    <main className="w-full max-w-full space-y-6 dark:bg-background">
      <section className="overflow-hidden rounded-lg border border-slate-200 dark:border-white/10">
        <div className="border-b border-slate-200 px-4 py-3 dark:border-white/10">
          <h1 className="text-lg font-semibold">Escaneo QR DTE</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Escanea codigos QR de consulta publica, normaliza el enlace y verifica con Hacienda.
          </p>
        </div>

        <div className="grid min-w-0 gap-4 p-3 sm:p-4 xl:grid-cols-2">
          <section
            className={cn(
              'min-w-0 rounded-xl border border-slate-200 p-3 dark:border-white/10 sm:p-4',
              cameraExpanded && 'xl:col-span-2'
            )}
          >
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <QrCode className="size-5 text-amber-500" />
                <h2 className="font-semibold">Camara</h2>
              </div>
              <label className="flex min-w-0 flex-col gap-1 text-sm text-muted-foreground sm:flex-row sm:items-center sm:gap-2">
                Camara
                <select
                  value={selectedCameraId}
                  onChange={(event) => handleCameraChange(event.target.value)}
                  disabled={cameras.length <= 1 || cameraPermission === 'requesting'}
                  className="w-full min-w-0 rounded-md border border-slate-200 bg-background px-2 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 sm:w-auto sm:max-w-[16rem]"
                >
                  {cameras.length ? (
                    cameras.map((camera, index) => (
                      <option key={camera.id} value={camera.id}>
                        {getCameraDisplayLabel(camera, index)}
                      </option>
                    ))
                  ) : (
                    <option value="">Detectar camaras</option>
                  )}
                </select>
              </label>
            </div>

            <div
              ref={cameraFrameRef}
              className="relative overflow-hidden rounded-xl border border-slate-200 bg-black/90 dark:border-white/10"
            >
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setCameraExpanded((current) => !current)}
                className="absolute right-3 top-3 z-20 gap-2 bg-background/90 text-foreground shadow-sm backdrop-blur hover:bg-background"
              >
                {cameraExpanded ? (
                  <Minimize2 className="size-4" />
                ) : (
                  <Maximize2 className="size-4" />
                )}
                {cameraExpanded ? 'Reducir' : 'Ampliar'}
              </Button>
              {showCameraPlaceholder && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-muted/40 p-4 text-center backdrop-blur-[1px]">
                  {cameraPermission === 'requesting' ? (
                    <>
                      <Loader2 className="size-8 animate-spin text-amber-500" />
                      <p className="text-sm text-muted-foreground">
                        Solicitando permiso de camara...
                      </p>
                    </>
                  ) : scanError ? (
                    <>
                      <CameraOff
                        className={cn(
                          'size-8',
                          cameraPermission === 'denied'
                            ? 'text-red-500'
                            : 'text-muted-foreground'
                        )}
                      />
                      <p className="text-sm text-muted-foreground">{scanError}</p>
                    </>
                  ) : cameraPermission === 'denied' ? (
                    <>
                      <CameraOff className="size-8 text-red-500" />
                      <p className="text-sm text-muted-foreground">
                        Permiso de camara denegado. Habilita el acceso en la configuracion del
                        navegador y pulsa reintentar.
                      </p>
                    </>
                  ) : (
                    <>
                      <Camera className="size-8 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        Permite el acceso a la camara para escanear codigos QR en tiempo real.
                      </p>
                    </>
                  )}
                </div>
              )}
              <video
                ref={videoRef}
                className={cn(
                  'w-full object-cover',
                  cameraExpanded
                    ? 'h-[72svh] min-h-[320px] sm:h-[68vh] sm:min-h-[420px]'
                    : 'aspect-video',
                  showCameraPlaceholder && 'opacity-30'
                )}
              />
            </div>

            {scanError && (
              <p className="mt-3 text-sm text-red-600 dark:text-red-400">{scanError}</p>
            )}

            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              {cameraPermission !== 'granted' || !isScanning ? (
                <Button
                  type="button"
                  onClick={() => void requestPermissionAndScan()}
                  disabled={cameraPermission === 'requesting'}
                  className="w-full gap-2 sm:w-auto"
                >
                  {cameraPermission === 'requesting' ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Camera className="size-4" />
                  )}
                  {cameraPermission === 'denied'
                    ? 'Reintentar permiso'
                    : 'Permitir camara y escanear'}
                </Button>
              ) : null}
              {isScanning && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={stopScanning}
                  className="w-full gap-2 sm:w-auto"
                >
                  <CameraOff className="size-4" />
                  Detener camara
                </Button>
              )}
            </div>

            {lastScan && (
              <div className="mt-4 rounded-lg border border-slate-200 bg-muted/20 p-3 dark:border-white/10">
                <p className="text-xs font-medium text-muted-foreground">Ultimo QR leido</p>
                <p className="mt-1 break-all text-xs">{lastScan}</p>
              </div>
            )}
          </section>

          <section className="min-w-0 rounded-xl border border-slate-200 p-3 dark:border-white/10 sm:p-4">
            <div className="mb-4 space-y-3">
              <div>
                <h2 className="font-semibold">Pendientes ({pendingScans.length})</h2>
                {lastAddedCodGen && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Ultimo: {lastAddedCodGen}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <Button
                  type="button"
                  variant="outline"
                  onClick={clearScans}
                  disabled={!pendingScans.length}
                  className="w-full gap-2 sm:w-auto"
                >
                  <Trash2 className="size-4" />
                  Limpiar
                </Button>
                <Button
                  type="button"
                  onClick={() => void verificarEscaneos()}
                  disabled={loading || !pendingScans.length}
                  className="w-full sm:w-auto"
                >
                  {loading
                    ? `Verificando ${progressDone}/${progressTotal || pendingScans.length}...`
                    : 'Verificar escaneos'}
                </Button>
              </div>
            </div>

            {errorGlobal && (
              <p className="mb-3 text-sm text-red-600 dark:text-red-400">{errorGlobal}</p>
            )}

            {pendingScans.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 py-10 text-center dark:border-white/15">
                <p className="text-sm text-muted-foreground">
                  Los DTE escaneados apareceran aqui en tiempo real antes de verificar.
                </p>
              </div>
            ) : (
              <div
                ref={pendingListRef}
                className="max-h-[420px] space-y-3 overflow-y-auto pr-1"
              >
                {pendingScans.map((item) => (
                  <article
                    key={item.id}
                    className={cn(
                      'rounded-lg border border-slate-200 bg-muted/10 p-3 transition-shadow dark:border-white/10',
                      highlightedScanId === item.id && 'ring-2 ring-amber-400 dark:ring-yellow-400'
                    )}
                  >
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:text-yellow-300">
                            #{item.scanNumber}
                          </span>
                          <p className="truncate text-sm font-semibold">{item.codGen}</p>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Fecha: {item.fechaDmy} · Ambiente: {item.ambiente}
                        </p>
                        <p className="break-all text-[11px] text-muted-foreground">
                          {item.urlNormalizada}
                        </p>
                      </div>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeScan(item.id)}
                            aria-label="Eliminar escaneo"
                          >
                            <Trash2 className="size-4 text-red-500" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Eliminar</TooltipContent>
                      </Tooltip>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </section>

      <UploadResultsReveal visible={resultsVisible}>
        <UploadTableToolbar
          className="min-w-0"
          resultCount={{ filtered: filtered.length, total: data.length }}
          export={{
            excel: {
              href: downloadHref,
              download: filename,
              label: 'EXCEL',
            },
            csv: {
              onClick: () =>
                exportRowsToCsv(
                  data as Record<string, unknown>[],
                  buildExportFilename('verificador_qr', 'csv')
                ),
            },
            pdf: {
              onClick: () =>
                exportPdfByProfile(
                  data as Record<string, unknown>[],
                  'verificador',
                  buildExportFilename('verificador_qr', 'pdf'),
                  {
                    title: 'Reporte de escaneo QR DTE',
                    createdBy,
                  }
                ),
            },
          }}
          filters={{
            activeCount: countBasicFilters(search, rowsPerPage),
            onClear: () => {
              setSearch('');
              setRowsPerPage(10);
              setCurrentPage(1);
            },
            children: (
              <UploadTableBasicFilters
                search={search}
                onSearchChange={(value) => {
                  setSearch(value);
                  setCurrentPage(1);
                }}
                searchPlaceholder="Buscar en resultados..."
                rowsPerPage={rowsPerPage}
                onRowsPerPageChange={(value) => {
                  setRowsPerPage(value);
                  setCurrentPage(1);
                }}
              />
            ),
          }}
        />

        <div className="mt-4 overflow-hidden rounded-md border border-slate-200 dark:border-white/10">
          <div className="divide-y md:hidden">
            {paginatedData.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                {loading ? 'Verificando...' : 'Sin resultados'}
              </div>
            ) : (
              paginatedData.map((row, index) => (
                <article
                  key={row.codGen || row.codigoGeneracion || index}
                  className="space-y-2 p-3 text-sm"
                >
                  {DTE_RESULT_COLUMNS.map((col) => (
                    <div key={col.key} className="min-w-0">
                      <p className="text-[11px] font-medium uppercase text-muted-foreground">
                        {col.label}
                      </p>
                      <div className="break-words text-foreground">
                        {renderDteResultCell(col.key, row)}
                      </div>
                    </div>
                  ))}
                </article>
              ))
            )}
          </div>

          <div className="hidden max-h-[60vh] overflow-auto md:block">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-slate-100 text-slate-950 dark:bg-zinc-900 dark:text-zinc-100">
                <tr>
                  {DTE_RESULT_COLUMNS.map((col) => (
                    <th
                      key={col.key}
                      className="whitespace-nowrap p-2 text-left font-semibold"
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {paginatedData.length === 0 && (
                  <tr>
                    <td
                      colSpan={DTE_RESULT_COLUMNS.length}
                      className="p-6 text-center text-muted-foreground"
                    >
                      {loading ? 'Verificando...' : 'Sin resultados'}
                    </td>
                  </tr>
                )}
                {paginatedData.map((row, index) => (
                  <tr
                    key={row.codGen || row.codigoGeneracion || index}
                    className="transition-colors hover:bg-muted/40"
                  >
                    {DTE_RESULT_COLUMNS.map((col) => (
                      <td
                        key={col.key}
                        className={`p-2 align-top ${isDteResultLongTextColumn(col.key) ? 'max-w-xs whitespace-normal break-words' : 'whitespace-nowrap'}`}
                      >
                        {renderDteResultCell(col.key, row)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col items-stretch justify-between gap-3 border-t border-slate-200 bg-slate-50 px-3 py-2 dark:border-white/10 dark:bg-black sm:flex-row sm:items-center">
            <span className="text-sm text-muted-foreground">
              Pagina {currentPage} de {totalPages}
            </span>
            <div className="grid grid-cols-4 gap-2 sm:flex sm:items-center">
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
        </div>
      </UploadResultsReveal>
    </main>
  );
}

export default function VerificadorQrPage() {
  return (
    <PlanGate routeKey={ROUTE_KEY}>
      <VerificadorQrContent />
    </PlanGate>
  );
}
