import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { email, password, displayName, role } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password required' },
        { status: 400 }
      );
    }

    // Create Firebase user
    const userRecord = await adminAuth.createUser({
      email,
      password,
      displayName: displayName || email,
    });

    console.log('Firebase user created:', userRecord.uid);

    // Create Firestore profile
    await adminDb.collection('users').doc(userRecord.uid).set({
      email,
      displayName: displayName || email,
      role: role || 'cliente',
      createdAt: new Date().toISOString(),
    });

    console.log('Firestore profile created');

    return NextResponse.json({
      success: true,
      uid: userRecord.uid,
      email: userRecord.email,
    });
  } catch (error) {
    console.error('[api/test/create-user] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error creating user',
      },
      { status: 500 }
    );
  }
}
