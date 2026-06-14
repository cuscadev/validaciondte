'use client';

import { useEffect } from 'react';

import { useAuth } from '@/components/AuthProvider';
import { notifyUploadVerifierTourResultsReady } from '@/lib/product-tours/tours/upload-verifier-tour';
import { isTourAwaitingResults } from '@/lib/product-tours/storage';

export function useUploadVerifierTourResultsReady(tourId: string, ready: boolean) {
  const { firebaseUser } = useAuth();
  const userId = firebaseUser?.uid;

  useEffect(() => {
    if (!ready || !userId || !isTourAwaitingResults(userId, tourId)) return;

    const timer = window.setTimeout(() => {
      notifyUploadVerifierTourResultsReady(tourId);
    }, 550);

    return () => window.clearTimeout(timer);
  }, [ready, tourId, userId]);
}
