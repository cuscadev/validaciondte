import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';
import { getPostgresPool } from '@/lib/postgres';

export const runtime = 'nodejs';

const allowedCatalogs = {
  departamentos: 'cat_012_departamento',
  municipios: 'cat_013_municipio',
  distritos: 'cat_008_distrito',
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

  if (!token) {
    console.log('[auth] No authorization header');
    return null;
  }
  
  try {
    console.log('[auth] Verifying token...');
    const decoded = await adminAuth.verifyIdToken(token);
    console.log('[auth] Token verified for user:', decoded.uid);
    return decoded;
  } catch (error) {
    console.error('[auth] Token verification failed:', error instanceof Error ? error.message : String(error));
    return null;
  }
}

const locationCatalogColumns: Record<string, string> = {
  cat_012_departamento: 'id, codigo, valor',
  cat_013_municipio: 'id, departamento_codigo, codigo, valor',
  cat_008_distrito: 'id, codigo, valor',
};

async function readCatalog(tableName: string) {
  const pool = getPostgresPool();
  const columns = locationCatalogColumns[tableName];
  try {
    const result = await pool.query(
      columns
        ? `SELECT ${columns} FROM ${tableName} ORDER BY id`
        : `
        SELECT *
        FROM ${tableName}
        WHERE COALESCE(activo, TRUE) = TRUE
        ORDER BY id
      `
    );
    return result.rows;
  } catch (error) {
    console.error(`[catalog] Error reading ${tableName}:`, error);
    throw error;
  }
}

export async function GET(req: NextRequest) {
  try {
    console.log('[api/profile/catalogs] Starting to load catalogs');
    
    const identity = await requireAuth(req);
    if (!identity) {
      console.log('[api/profile/catalogs] No identity found, returning 401');
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    
    console.log('[api/profile/catalogs] Identity verified:', { uid: identity.uid, email: identity.email });

    const entries = await Promise.all(
      Object.entries(allowedCatalogs).map(async ([key, table]) => {
        try {
          console.log(`[api/profile/catalogs] Loading ${key} from ${table}`);
          const data = await readCatalog(table);
          console.log(`[api/profile/catalogs] ${key}: ${data.length} rows`);
          return [key, data];
        } catch (err) {
          console.error(`[api/profile/catalogs] Error loading ${key}:`, err);
          return [key, []];
        }
      })
    );

    console.log('[api/profile/catalogs] All catalogs loaded successfully');
    return NextResponse.json({ catalogs: Object.fromEntries(entries) });
  } catch (error) {
    console.error('[api/profile/catalogs] Fatal error loading catalogs', error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    );
  }
}
