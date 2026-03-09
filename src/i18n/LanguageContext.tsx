import React, { createContext, useContext, useState, useCallback } from 'react';
import { translations, type Locale } from './translations';

interface LanguageContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const getDefaultLocale = (): Locale => {
  const stored = localStorage.getItem('channelhacker-locale');
  if (stored && ['pt-BR', 'en', 'pl', 'de'].includes(stored)) return stored as Locale;
  const lang = navigator.language;
  if (lang.startsWith('pt')) return 'pt-BR';
  if (lang.startsWith('pl')) return 'pl';
  if (lang.startsWith('de')) return 'de';
  return 'en';
};

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [locale, setLocaleState] = useState<Locale>(getDefaultLocale);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    localStorage.setItem('channelhacker-locale', l);
  }, []);

  const t = useCallback((key: string) => {
    return translations[locale]?.[key] || translations['en']?.[key] || key;
  }, [locale]);

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
};
