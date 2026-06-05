'use client';

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

const OFFLINE_TOAST_ID = 'network-offline';

export function NetworkStatusToast() {
  const online = useOnlineStatus();
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      if (online) return;
    }

    if (!online) {
      toast.error('No hay conexion a internet. Intenta nuevamente en unos momentos.', {
        id: OFFLINE_TOAST_ID,
        duration: 6000,
      });
      return;
    }

    toast.dismiss(OFFLINE_TOAST_ID);
    toast.success('Conexion restablecida.', {
      duration: 3000,
    });
  }, [online]);

  return null;
}
