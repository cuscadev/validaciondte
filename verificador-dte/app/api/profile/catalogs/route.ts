import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';
import { getPostgresPool } from '@/lib/postgres';

export const runtime = 'nodejs';

const allowedCatalogs = {
  departamentos: 'cat_005_departamentos',
  municipios: 'cat_006_municipios',
  distritos: 'cat_008_distritos',
  tiposEstablecimiento: 'cat_007_tipo_establecimiento',
  actividades: 'cat_024_codigo_actividad',
  regimenesTributarios: 'cat_023_regimen_tributario',
  tiposAfiliacion: 'cat_022_tipo_afiliacion',
  tiposDocumento: 'cat_003_tipo_documento',
  paises: 'cat_paises',
  metodosPago: 'cat_026_metodo_pago',
  formasPago: 'cat_027_forma_pago',
  plazosCredito: 'cat_028_plazo_credito',
  tiposVenta: 'cat_016_tipo_venta',
  monedas: 'cat_004_monedas',
  tiposRetencion: 'cat_010_tipo_retencion',
} as const;

async function requireAuth(req: NextRequest) {
  const authHeader = req.headers.get('Authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : '';

  if (!token) return null;
  return adminAuth.verifyIdToken(token);
}

async function readCatalog(tableName: string) {
  const pool = getPostgresPool();
  const result = await pool.query(
    `
      SELECT *
      FROM ${tableName}
      WHERE COALESCE(activo, TRUE) = TRUE
      ORDER BY id
    `
  );

  return result.rows;
}

export async function GET(req: NextRequest) {
  try {
    const identity = await requireAuth(req);
    if (!identity) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const entries = await Promise.all(
      Object.entries(allowedCatalogs).map(async ([key, table]) => [
        key,
        await readCatalog(table),
      ])
    );

    return NextResponse.json({ catalogs: Object.fromEntries(entries) });
  } catch (error) {
    console.error('[api/profile/catalogs] Error loading catalogs', error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    );
  }
}
