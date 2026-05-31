'use client';

import { useCallback, useRef, useState } from 'react';

import type { UploadFormAccordionContextValue } from '@/components/upload/UploadFormAccordion';

export function useUploadResultsReveal() {
  const [resultsVisible, setResultsVisible] = useState(false);
  const accordionApiRef = useRef<UploadFormAccordionContextValue | null>(null);

  const resetResultsVisibility = useCallback(() => {
    setResultsVisible(false);
  }, []);

  const onResultsReveal = useCallback(() => {
    setResultsVisible(true);
  }, []);

  return {
    resultsVisible,
    accordionApiRef,
    resetResultsVisibility,
    onResultsReveal,
  };
}
