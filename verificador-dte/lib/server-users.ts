import type { DocumentSnapshot } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';

export async function getUserDocByEmail(
  email: string
): Promise<DocumentSnapshot | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;

  const snap = await adminDb
    .collection('users')
    .where('email', '==', normalized)
    .limit(1)
    .get();

  return snap.empty ? null : snap.docs[0];
}

export function resolveInviteEmailConflict(params: {
  normalizedEmail: string;
  orgId: string;
  ownerUid: string;
  ownerEmail: string;
  existingUserDoc: DocumentSnapshot | null;
}): { status: 400 | 409; error: string } {
  const { normalizedEmail, orgId, ownerUid, ownerEmail, existingUserDoc } = params;

  if (ownerEmail && normalizedEmail === ownerEmail) {
    return {
      status: 400,
      error:
        'No puedes invitar el correo del titular. Usa otro correo para el delegado.',
    };
  }

  if (!existingUserDoc) {
    return {
      status: 409,
      error:
        'El correo ya existe en el sistema. Usa otro correo o contacta soporte si necesitas recuperar el acceso.',
    };
  }

  const data = existingUserDoc.data() ?? {};
  const uid = existingUserDoc.id;
  const role = String(data.role ?? '');
  const userOrgId = String(data.organizationId ?? '');

  if (uid === ownerUid || (role === 'cliente' && userOrgId === orgId)) {
    return {
      status: 400,
      error:
        'No puedes invitar el correo del titular. Usa otro correo para el delegado.',
    };
  }

  if (userOrgId === orgId && role === 'colaborador') {
    return {
      status: 409,
      error: 'Este delegado ya pertenece a tu organización.',
    };
  }

  if (userOrgId && userOrgId !== orgId) {
    return {
      status: 409,
      error: 'Este correo ya está registrado en otra organización.',
    };
  }

  return {
    status: 409,
    error: 'Ya existe un usuario con ese correo.',
  };
}
