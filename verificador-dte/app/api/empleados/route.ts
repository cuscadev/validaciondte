import { NextResponse } from 'next/server';

/** @deprecated Use POST /api/organization/users instead */
export async function POST() {
  return NextResponse.json(
    {
      error:
        'Este endpoint está deprecado. Usa POST /api/organization/users para invitar colaboradores con dominio corporativo.',
    },
    { status: 410 }
  );
}
