
"use client";

import { useAuth } from '@/components/AuthProvider';

export default function ProtectedPage() {
  const { firebaseUser, authChecked } = useAuth();

  if (!authChecked) {
    return <div className="flex items-center justify-center min-h-screen">Cargando...</div>;
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Ruta protegida</h1>
      <p className="text-lg">Bienvenido, {firebaseUser?.email}</p>
    </div>
  );
}
