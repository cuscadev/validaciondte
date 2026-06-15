import { NextRequest, NextResponse } from 'next/server';
import { getPostgresPool } from '@/lib/postgres';

export const runtime = 'nodejs';

const allowedCatalogs = {
  tiposDocumento: 'cat_003_tipo_documento',
  departamentos: 'cat_012_departamento',
  municipios: 'cat_013_municipio',
} as const;

async function readCatalog(tableName: string) {
  const pool = getPostgresPool();
  const result = await pool.query(
    `
      SELECT *
      FROM ${tableName}
      WHERE COALESCE(activo, TRUE) = TRUE
      ORDER BY id
      LIMIT 5
    `
  );

  return result.rows;
}

export async function GET(req: NextRequest) {
  try {
    const entries = [];
    
    for (const [key, table] of Object.entries(allowedCatalogs)) {
      const data = await readCatalog(table);
      entries.push([key, data]);
    }

    const catalogs = Object.fromEntries(entries);
    
    return NextResponse.json({ 
      success: true,
      catalogs,
      message: 'Test endpoint - no auth required'
    });
  } catch (error) {
    console.error('[api/test/catalogs-noauth] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error interno'
      },
      { status: 500 }
    );
  }
}
