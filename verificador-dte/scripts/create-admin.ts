// Script para crear un usuario administrador en Firebase Auth y Firestore
// Ejecutar con: npx tsx scripts/create-admin.ts

import { adminAuth, adminDb } from '../lib/firebase-admin';

async function createAdmin() {
  const email = 'admin@gmail.com';
  const password = 'Admin1234!'; // Cambia esto después de crear el admin
  try {
    // Crear usuario en Auth
    const userRecord = await adminAuth.createUser({
      email,
      password,
      emailVerified: true,
      displayName: 'Administrador',
      disabled: false,
    });
    // Asignar custom claim de admin
    await adminAuth.setCustomUserClaims(userRecord.uid, { admin: true });
    // Crear documento en Firestore
    await adminDb.collection('users').doc(userRecord.uid).set({
      email,
      role: 'admin',
      createdAt: new Date(),
      displayName: 'Administrador',
      active: true,
    });
    console.log('Administrador creado correctamente:', email);
  } catch (error: unknown) {
    const err = error as { code?: string };
    if (err.code === 'auth/email-already-exists') {
      console.log('El usuario admin@gmail.com ya existe.');
    } else {
      console.error('Error creando el administrador:', error);
    }
  }
  process.exit(0);
}

createAdmin();
