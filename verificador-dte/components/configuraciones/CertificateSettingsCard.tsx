'use client';

import { useEffect, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import Link from 'next/link';
import { Loader2, Save, Upload } from 'lucide-react';
import { toast } from 'sonner';

import { auth } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  SearchableSelect,
  type SearchableSelectOption,
} from '@/components/ui/searchable-select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type EmitterCertificate = {
  nit: string;
  nombre: string;
  ambienteCodigo: string;
  certificadoPath?: string;
  fechaVencimientoCert?: string;
  rolEmisor?: string;
};

const environmentOptions: SearchableSelectOption[] = [
  { value: '00', label: '00 - Produccion' },
  { value: '01', label: '01 - Pruebas' },
];

function ambienteLabel(code: string) {
  return code === '01' ? 'Pruebas' : 'Produccion';
}

export function CertificateSettingsCard() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [emitter, setEmitter] = useState<EmitterCertificate | null>(null);
  const [ambienteCodigo, setAmbienteCodigo] = useState('00');
  const [passwordPri, setPasswordPri] = useState('');
  const [certificateFile, setCertificateFile] = useState<File | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError('');

      try {
        const token = await auth.currentUser?.getIdToken();
        if (!token) throw new Error('Sesion expirada');

        const res = await fetch('/api/profile/emisor', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = (await res.json()) as {
          emitter?: EmitterCertificate;
          error?: string;
        };

        if (res.status === 404) {
          if (!cancelled) setNotFound(true);
          return;
        }
        if (!res.ok) throw new Error(data.error || 'No se pudo cargar el emisor');

        if (!cancelled && data.emitter) {
          setEmitter(data.emitter);
          setAmbienteCodigo(data.emitter.ambienteCodigo || '00');
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Error al cargar certificado');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setCertificateFile(file);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');

    if (!emitter) return;

    const canEdit =
      emitter.rolEmisor === 'propietario' || emitter.rolEmisor === 'editor';
    if (!canEdit) {
      setError('No tienes permiso para modificar el certificado.');
      return;
    }

    if (certificateFile && !passwordPri.trim()) {
      setError('Ingresa la contrasena del certificado para subir el archivo .crt');
      return;
    }

    setSaving(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('Sesion expirada');

      const body = new FormData();
      body.append('ambienteCodigo', ambienteCodigo);
      if (certificateFile) {
        body.append('file', certificateFile);
        body.append('passwordPri', passwordPri);
      }

      const res = await fetch('/api/facturacion/certificates/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body,
      });
      const data = (await res.json()) as {
        error?: string;
        path?: string;
        success?: boolean;
      };
      if (!res.ok) throw new Error(data.error || 'No se pudo guardar');

      const refresh = await fetch('/api/profile/emisor', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const refreshData = (await refresh.json()) as { emitter?: EmitterCertificate };
      if (refresh.ok && refreshData.emitter) {
        setEmitter(refreshData.emitter);
        setAmbienteCodigo(refreshData.emitter.ambienteCodigo || ambienteCodigo);
      } else {
        setEmitter((current) =>
          current
            ? {
                ...current,
                ambienteCodigo,
                certificadoPath: data.path || current.certificadoPath,
              }
            : current
        );
      }

      setPasswordPri('');
      setCertificateFile(null);
      toast.success(
        certificateFile
          ? 'Certificado y ambiente guardados correctamente.'
          : 'Ambiente guardado correctamente.'
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex min-h-32 items-center justify-center py-8">
          <Loader2 className="size-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (notFound || !emitter) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Certificado de Hacienda</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>No hay emisor vinculado a tu cuenta. Completa los datos del emisor en tu perfil antes de subir el certificado.</p>
          <Button asChild variant="outline">
            <Link href="/profile">Ir al perfil</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const canEdit = emitter.rolEmisor === 'propietario' || emitter.rolEmisor === 'editor';

  return (
    <Card>
      <CardHeader>
        <CardTitle>Certificado de Hacienda</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-md border bg-muted/30 p-3 text-sm">
            <p>
              <span className="text-muted-foreground">Emisor:</span>{' '}
              <strong>{emitter.nombre}</strong>
            </p>
            <p>
              <span className="text-muted-foreground">NIT:</span> <strong>{emitter.nit}</strong>
            </p>
            <p>
              <span className="text-muted-foreground">Ambiente actual:</span>{' '}
              <strong>{ambienteLabel(emitter.ambienteCodigo || '00')}</strong>
            </p>
            {emitter.certificadoPath && (
              <p className="mt-2 break-all text-xs text-muted-foreground">
                Certificado: {emitter.certificadoPath}
              </p>
            )}
            {emitter.fechaVencimientoCert && (
              <p className="text-xs text-muted-foreground">
                Vence: {new Date(emitter.fechaVencimientoCert).toLocaleDateString('es-SV')}
              </p>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="cert-ambiente">Ambiente de facturacion</Label>
              <SearchableSelect
                id="cert-ambiente"
                name="ambienteCodigo"
                value={ambienteCodigo}
                options={environmentOptions}
                onValueChange={setAmbienteCodigo}
                placeholder="Seleccionar ambiente"
                searchPlaceholder="Buscar ambiente"
                disabled={!canEdit}
              />
              <p className="text-xs text-muted-foreground">
                00 = Produccion, 01 = Pruebas (segun catalogo MH).
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cert-password">Contrasena del certificado</Label>
              <Input
                id="cert-password"
                type="password"
                value={passwordPri}
                onChange={(event) => setPasswordPri(event.target.value)}
                placeholder={emitter.certificadoPath ? 'Solo si subes un .crt nuevo' : 'Clave privada del .crt'}
                disabled={!canEdit}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cert-file">Archivo certificado (.crt)</Label>
            <Input
              id="cert-file"
              type="file"
              accept=".crt"
              onChange={handleFileChange}
              disabled={!canEdit}
            />
            {certificateFile && (
              <p className="text-xs text-muted-foreground">Archivo seleccionado: {certificateFile.name}</p>
            )}
          </div>

          <div className="rounded-md border p-3 text-sm text-muted-foreground">
            El certificado se valida, cifra y guarda en el servidor. Se usara automaticamente al firmar DTE en el ambiente seleccionado.
          </div>

          {!canEdit && (
            <p className="text-sm text-amber-700 dark:text-amber-300">
              Solo propietarios y editores pueden subir o cambiar el certificado.
            </p>
          )}

          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-200">
              {error}
            </div>
          )}

          <Button type="submit" disabled={saving || !canEdit}>
            {saving ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                {certificateFile ? (
                  <Upload className="mr-2 size-4" />
                ) : (
                  <Save className="mr-2 size-4" />
                )}
                Guardar certificado
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
