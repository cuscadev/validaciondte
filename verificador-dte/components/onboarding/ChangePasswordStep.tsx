'use client';

import { useState } from 'react';
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from 'firebase/auth';
import { useQueryClient } from '@tanstack/react-query';
import { BrandLoader } from '@/components/ui/brand-loader';

import { auth } from '@/lib/firebase';
import { updateUser } from '@/lib/firestoreUser';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type ChangePasswordStepProps = {
  uid: string;
  mustClearFlag: boolean;
  onSuccess: () => void;
};

export function ChangePasswordStep({ uid, mustClearFlag, onSuccess }: ChangePasswordStepProps) {
  const queryClient = useQueryClient();
  const [pwData, setPwData] = useState({ current: '', next: '', confirm: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (pwData.next.length < 6) {
      setError('La nueva contraseña debe tener al menos 6 caracteres');
      return;
    }
    if (pwData.next !== pwData.confirm) {
      setError('Las contraseñas no coinciden');
      return;
    }

    const currentUser = auth.currentUser;
    if (!currentUser?.email) return;

    setSaving(true);
    try {
      const credential = EmailAuthProvider.credential(currentUser.email, pwData.current);
      await reauthenticateWithCredential(currentUser, credential);
      await updatePassword(currentUser, pwData.next);

      if (mustClearFlag) {
        await updateUser(uid, { mustChangePassword: false });
        await queryClient.invalidateQueries({ queryKey: ['users', uid] });
      }

      onSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al cambiar la contraseña';
      if (msg.includes('wrong-password') || msg.includes('invalid-credential')) {
        setError('La contraseña actual es incorrecta');
      } else {
        setError(msg);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Usa la contraseña temporal que recibiste por correo. Luego define una contraseña personal.
      </p>
      <div>
        <Label htmlFor="pw-current">Contraseña actual (temporal)</Label>
        <Input
          id="pw-current"
          name="current"
          type="password"
          autoComplete="current-password"
          required
          value={pwData.current}
          onChange={(e) => setPwData((p) => ({ ...p, current: e.target.value }))}
          className="mt-1"
        />
      </div>
      <div>
        <Label htmlFor="pw-next">Nueva contraseña</Label>
        <Input
          id="pw-next"
          name="next"
          type="password"
          autoComplete="new-password"
          required
          value={pwData.next}
          onChange={(e) => setPwData((p) => ({ ...p, next: e.target.value }))}
          className="mt-1"
        />
      </div>
      <div>
        <Label htmlFor="pw-confirm">Confirmar nueva contraseña</Label>
        <Input
          id="pw-confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          value={pwData.confirm}
          onChange={(e) => setPwData((p) => ({ ...p, confirm: e.target.value }))}
          className="mt-1"
        />
      </div>
      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
      <Button
        type="submit"
        disabled={saving}
        className="w-full bg-yellow-400 font-bold text-black hover:bg-yellow-300"
      >
        {saving ? (
          <>
            <BrandLoader size="sm" />
            Guardando...
          </>
        ) : (
          'Continuar'
        )}
      </Button>
    </form>
  );
}
