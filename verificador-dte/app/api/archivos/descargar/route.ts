// app/api/archivos/descargar/route.ts
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const fecha = url.searchParams.get('fecha');     // YYYY-MM-DD
  const archivo = url.searchParams.get('archivo'); // nombre.ext (puede incluir prefijo del messageId)

  if (!fecha || !archivo) {
    return NextResponse.json({ error: 'Parámetros faltantes' }, { status: 400 });
  }

  const base = path.join(process.cwd(), 'data', 'attachments', fecha);
  const abs = path.join(base, archivo);

  // proteger de path traversal
  const rel = path.relative(base, abs).replace(/\\/g, '/');
  if (rel.startsWith('..')) {
    return NextResponse.json({ error: 'Ruta inválida' }, { status: 400 });
  }

  if (!fs.existsSync(abs)) {
    return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 });
  }

  const stat = fs.statSync(abs);
  const headers = new Headers();
  headers.set('Content-Length', String(stat.size));
  headers.set('Content-Disposition', `attachment; filename="${path.basename(abs)}"`);
  headers.set('Content-Type', 'application/octet-stream');

  const stream = fs.createReadStream(abs);
  // @ts-ignore
  return new NextResponse(stream as any, { status: 200, headers });
}
