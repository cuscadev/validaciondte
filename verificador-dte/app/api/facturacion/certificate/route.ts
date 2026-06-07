export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import path from 'node:path';
import { promises as fs } from 'node:fs';
import { NextRequest, NextResponse } from 'next/server';
import { requireSuperadmin } from '@/lib/server-auth';

function certificateDir() {
  return (
    process.env.HACIENDA_CERTIFICATE_HOME?.split(path.delimiter).find(Boolean) ||
    process.env.CERTIFICATE_HOME?.split(path.delimiter).find(Boolean) ||
    path.resolve(process.cwd(), '..', 'Ejemplodeceritifcado')
  );
}

export async function POST(req: NextRequest) {
  try {
    await requireSuperadmin(req);
    const form = await req.formData();
    const nit = String(form.get('nit') || '').replace(/\D/g, '');
    const file = form.get('file');

    if (!/^\d{9}$|^\d{14}$/.test(nit)) {
      return NextResponse.json({ error: 'NIT invalido' }, { status: 400 });
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Sube un archivo .crt' }, { status: 400 });
    }
    if (!file.name.toLowerCase().endsWith('.crt')) {
      return NextResponse.json({ error: 'El certificado debe ser .crt' }, { status: 400 });
    }

    const data = Buffer.from(await file.arrayBuffer());
    const dir = certificateDir();
    await fs.mkdir(dir, { recursive: true });
    const savedPath = path.join(dir, `${nit}.crt`);
    await fs.writeFile(savedPath, data);

    return NextResponse.json({
      success: true,
      nit,
      fileName: `${nit}.crt`,
      directory: dir,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'No se pudo subir certificado' },
      { status: 500 }
    );
  }
}
