'use client';

import { useEffect, useRef, useState } from 'react';
import QrScanner from 'qr-scanner';
import * as XLSX from 'xlsx';
import {
  Camera,
  CameraOff,
  Download,
  FileText,
  QrCode,
  Trash2,
} from 'lucide-react';

interface ScannedData {
  codGen: string;
  fechaEmi: string;
}

export default function EscaneoQRPage() {
  const [scannedData, setScannedData] = useState<ScannedData[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState('');
  const [lastScan, setLastScan] = useState('');

  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<QrScanner | null>(null);
  const scanLockRef = useRef(false);

  useEffect(() => {
    const stored = localStorage.getItem('scannedQRData');

    if (stored) {
      try {
        setScannedData(JSON.parse(stored));
      } catch {
        localStorage.removeItem('scannedQRData');
      }
    }

    return () => {
      stopScanning();
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('scannedQRData', JSON.stringify(scannedData));
  }, [scannedData]);

  const startScanning = async () => {
    if (!videoRef.current) return;

    try {
      setError('');
      setLastScan('');
      scanLockRef.current = false;

      // destruir scanner anterior
      if (scannerRef.current) {
        scannerRef.current.stop();
        scannerRef.current.destroy();
        scannerRef.current = null;
      }

      // verificar cámaras disponibles
      const cameras = await QrScanner.listCameras(true);

      console.log('Cámaras detectadas:', cameras);

      if (!cameras || cameras.length === 0) {
        setError('No se detectó ninguna cámara.');
        return;
      }

      scannerRef.current = new QrScanner(
        videoRef.current,
        (result) => {
          if (scanLockRef.current) return;

          scanLockRef.current = true;

          console.log('QR detectado:', result);

          processQR(result.data);

          setTimeout(() => {
            scanLockRef.current = false;
          }, 1500);
        },
        {
          highlightScanRegion: true,
          highlightCodeOutline: true,
          returnDetailedScanResult: true,
        }
      );

      await scannerRef.current.start();

      setIsScanning(true);
    } catch (e: any) {
      console.error('Camera error full:', e);

      setIsScanning(false);

      if (e?.name === 'NotAllowedError') {
        setError(
          'Permiso de cámara denegado. Debes permitir acceso a la cámara.'
        );
        return;
      }

      if (e?.name === 'NotFoundError') {
        setError('No se encontró ninguna cámara disponible.');
        return;
      }

      if (e?.name === 'NotReadableError') {
        setError(
          'La cámara está siendo usada por otra aplicación como Zoom, Teams o Meet.'
        );
        return;
      }

      if (e?.name === 'OverconstrainedError') {
        setError(
          'No se pudo inicializar la cámara seleccionada.'
        );
        return;
      }

      setError(
        `No se pudo abrir la cámara. Error: ${
          e?.name || 'desconocido'
        } - ${e?.message || 'sin mensaje'}`
      );
    }
  };

  const stopScanning = () => {
    if (scannerRef.current) {
      scannerRef.current.stop();
      scannerRef.current.destroy();
      scannerRef.current = null;
    }

    setIsScanning(false);
  };

  const processQR = (decodedText: string) => {
    try {
      setError('');
      setLastScan(decodedText);

      console.log('Contenido QR:', decodedText);

      const url = new URL(decodedText);

      const codGen =
        url.searchParams.get('codGen') ||
        url.searchParams.get('codigoGeneracion') ||
        url.searchParams.get('codigo') ||
        '';

      const fechaEmi =
        url.searchParams.get('fechaEmi') ||
        url.searchParams.get('fecEmi') ||
        url.searchParams.get('fecha') ||
        '';

      if (!codGen || !fechaEmi) {
        setError(
          'El QR no contiene código de generación o fecha de emisión.'
        );
        return;
      }

      const uuidRegex =
        /^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}$/;

      if (!uuidRegex.test(codGen)) {
        setError('Código de generación inválido.');
        return;
      }

      const exists = scannedData.some(
        (item) =>
          item.codGen.toLowerCase() === codGen.toLowerCase()
      );

      if (exists) {
        setError('Este QR ya fue escaneado.');
        return;
      }

      setScannedData((prev) => [
        {
          codGen: codGen.toUpperCase(),
          fechaEmi,
        },
        ...prev,
      ]);

      stopScanning();
    } catch (e) {
      console.error(e);

      setError(
        'El contenido escaneado no es una URL válida.'
      );
    }
  };

  const downloadExcel = () => {
    if (scannedData.length === 0) {
      alert('No hay datos para descargar');
      return;
    }

    const ws = XLSX.utils.json_to_sheet(
      scannedData.map((item) => ({
        CodigoGeneracion: item.codGen,
        FechaEmision: item.fechaEmi,
      }))
    );

    const wb = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(wb, ws, 'Datos QR');

    XLSX.writeFile(wb, 'datos_qr_dte.xlsx');
  };

  const clearData = () => {
    setScannedData([]);
    localStorage.removeItem('scannedQRData');
  };

  const removeItem = (index: number) => {
    setScannedData((prev) =>
      prev.filter((_, i) => i !== index)
    );
  };

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8 bg-background">
      <section className="mx-auto max-w-7xl">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 text-foreground">
            Escaneo de QR
          </h1>

          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Escanea códigos QR de DTE para extraer código de
            generación y fecha de emisión.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* ESCÁNER */}
          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <QrCode className="h-6 w-6 text-primary" />

              <h2 className="text-xl font-semibold text-gray-900 text-foreground">
                Escáner
              </h2>
            </div>

            <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
              Presiona iniciar cámara y coloca el QR frente al
              dispositivo.
            </p>

            {error && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
                {error}
              </div>
            )}

            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-black dark:border-gray-800">
              <video
                ref={videoRef}
                className="aspect-video w-full object-cover"
                playsInline
                muted
              />
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              {!isScanning ? (
                <button
                  type="button"
                  onClick={startScanning}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary/100 px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-primary"
                >
                  <Camera className="h-5 w-5" />
                  Iniciar cámara
                </button>
              ) : (
                <button
                  type="button"
                  onClick={stopScanning}
                  className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700"
                >
                  <CameraOff className="h-5 w-5" />
                  Detener cámara
                </button>
              )}
            </div>

            {lastScan && (
              <div className="mt-5 rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 bg-card">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  Último QR leído:
                </p>

                <p className="mt-1 break-all text-xs text-gray-700 dark:text-gray-300">
                  {lastScan}
                </p>
              </div>
            )}
          </section>

          {/* DATOS */}
          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <FileText className="h-6 w-6 text-blue-500" />

                <h2 className="text-xl font-semibold text-gray-900 text-foreground">
                  Datos escaneados ({scannedData.length})
                </h2>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={downloadExcel}
                  disabled={scannedData.length === 0}
                  className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-400"
                >
                  <Download className="h-4 w-4" />
                  Excel
                </button>

                <button
                  type="button"
                  onClick={clearData}
                  disabled={scannedData.length === 0}
                  className="inline-flex items-center gap-2 rounded-xl bg-gray-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
                >
                  <Trash2 className="h-4 w-4" />
                  Limpiar
                </button>
              </div>
            </div>

            {scannedData.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-300 py-12 text-center dark:border-gray-800">
                <QrCode className="mx-auto mb-4 h-12 w-12 text-gray-400 opacity-50" />

                <p className="text-gray-500 dark:text-gray-400">
                  No hay datos escaneados aún.
                </p>
              </div>
            ) : (
              <div className="max-h-[450px] space-y-3 overflow-y-auto pr-1">
                {scannedData.map((item, index) => (
                  <article
                    key={`${item.codGen}-${index}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 bg-card"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-gray-900 text-foreground">
                        {item.codGen}
                      </p>

                      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                        Fecha: {item.fechaEmi}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className="rounded-lg p-2 text-red-500 transition hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </section>
    </main>
  );
}