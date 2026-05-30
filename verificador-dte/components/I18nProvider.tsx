'use client';

import { useEffect } from 'react';
import { I18nextProvider } from 'react-i18next';
import i18n, { SupportedLanguage, defaultLanguage, supportedLanguages } from '@/lib/i18n';

function getInitialLanguage(): SupportedLanguage {
  if (typeof window === 'undefined') return defaultLanguage;

  const savedLanguage = window.localStorage.getItem('language');
  if (supportedLanguages.includes(savedLanguage as SupportedLanguage)) {
    return savedLanguage as SupportedLanguage;
  }

  const browserLanguage = window.navigator.language.split('-')[0];
  if (supportedLanguages.includes(browserLanguage as SupportedLanguage)) {
    return browserLanguage as SupportedLanguage;
  }

  return defaultLanguage;
}

export default function I18nProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const language = getInitialLanguage();
    if (i18n.language !== language) {
      i18n.changeLanguage(language);
    }
  }, []);

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
