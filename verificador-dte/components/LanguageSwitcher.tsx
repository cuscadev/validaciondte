'use client';

import { Languages } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { SupportedLanguage } from '@/lib/i18n';

const languageOptions: Array<{ value: SupportedLanguage; labelKey: string }> = [
  { value: 'es', labelKey: 'common.spanish' },
  { value: 'en', labelKey: 'common.english' },
];

import React from 'react';
export default function LanguageSwitcher() {
  const { i18n, t } = useTranslation();

  const changeLanguage = (language: SupportedLanguage) => {
    if (i18n.language !== language) {
      i18n.changeLanguage(language);
      window.localStorage.setItem('language', language);
    }
  };

  return (
    <div className="inline-flex items-center gap-1 sm:gap-2">
      <Languages className="hidden h-4 w-4 text-muted-foreground sm:block" aria-hidden />
      <span className="sr-only">{t('common.language')}</span>
      <div className="inline-flex rounded-xl border border-transparent bg-transparent p-1 shadow-none transition-all duration-300">
        {languageOptions.map((option) => {
          const active = i18n.resolvedLanguage === option.value || i18n.language === option.value;
          return (
            <Button
              key={option.value}
              type="button"
              variant={active ? 'secondary' : 'ghost'}
              size="sm"
              className={`h-7 px-2 text-xs font-semibold relative transition-all duration-300 focus-visible:ring-2 focus-visible:ring-primary focus-visible:z-10 sm:px-3 sm:text-sm ${
                active
                  ? 'bg-primary text-primary-foreground shadow-lg scale-105 border border-primary'
                  : 'hover:bg-muted hover:text-primary/90'
              }`}
              onClick={() => changeLanguage(option.value)}
              aria-pressed={active}
              tabIndex={0}
              title={t(option.labelKey)}
            >
              <span className="flex items-center gap-1">
                {option.value.toUpperCase()}
                {active && (
                  <span className="ml-1 w-2 h-2 rounded-full bg-green-400 animate-pulse" aria-hidden />
                )}
              </span>
              <span className="sr-only"> {t(option.labelKey)}</span>
            </Button>
          );
        })}
      </div>
    </div>
  );
}
