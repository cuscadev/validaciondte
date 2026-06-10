// Script para crear un usuario superadmin en Firebase Auth y Firestore.
// Ejecutar con: npx tsx scripts/create-admin.ts
//
// Variables opcionales:
//   ADMIN_EMAIL=admin@example.com
//   ADMIN_PASSWORD=Admin1234!

import { loadRepoEnv } from './load-repo-env';

loadRepoEnv();

const email = (process.env.ADMIN_EMAIL || 'admin@gmail.com').trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD || 'Admin1234!';

async function createAdmin() {
  const { adminAuth, adminDb } = await import('../lib/firebase-admin');

  try {
    let userRecord;

    try {
      userRecord = await adminAuth.createUser({
        email,
        password,
        emailVerified: true,
        displayName: 'Administrador',
        disabled: false,
      });
      console.log('Usuario creado en Firebase Auth:', email);
    } catch (error: unknown) {
      const err = error as { code?: string };
      if (err.code === 'auth/email-already-exists') {
        userRecord = await adminAuth.getUserByEmail(email);
        console.log('El usuario ya existe en Auth, actualizando Firestore:', email);
      } else {
        throw error;
      }
    }

    await adminAuth.setCustomUserClaims(userRecord.uid, { superadmin: true });

    await adminDb.collection('users').doc(userRecord.uid).set(
      {
        email,
        role: 'superadmin',
        displayName: 'Administrador',
        accountStatus: 'active',
        onboardingCompleted: true,
        membership: {
          type: 'pro',
          expiresAt: '2099-12-31T00:00:00.000Z',
        },
        createdAt: new Date(),
      },
      { merge: true }
    );

    console.log('Superadmin listo.');
    console.log('  UID:', userRecord.uid);
    console.log('  Email:', email);
    console.log('Inicia sesión en http://localhost:3000/login');
    if (!process.env.ADMIN_PASSWORD) {
      console.log('  Password: (valor por defecto del script; cámbiala tras el primer login)');
    }
  } catch (error) {
    console.error('Error creando el superadmin:', error);
    process.exitCode = 1;
  }

  process.exit(process.exitCode ?? 0);
}

createAdmin();
