import { useState, useEffect, useCallback, type ReactNode } from 'react';
import type { Language, Translations } from './types';
import { en } from './translations/en';
import { ja } from './translations/ja';
import { I18nContext } from './i18nContext';

const STORAGE_KEY = 'glimpse-language';

const translations: Record<Language, Translations> = {
  en,
  ja,
};

/**
 * Detect browser language and return closest match
 */
function detectBrowserLanguage(): Language {
  const browserLang = navigator.language.toLowerCase();

  if (browserLang.startsWith('ja')) {
    return 'ja';
  }

  return 'en';
}

/**
 * Get initial language from localStorage or browser
 */
function getInitialLanguage(): Language {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'en' || stored === 'ja') {
      return stored;
    }
  } catch {
    // localStorage may not be available
  }

  return detectBrowserLanguage();
}

interface I18nProviderProps {
  children: ReactNode;
}

export function I18nProvider({ children }: I18nProviderProps) {
  const [language, setLanguageState] = useState<Language>(getInitialLanguage);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // localStorage may not be available
    }
  }, []);

  // Sync with localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'en' || stored === 'ja') {
      setLanguageState(stored);
    }
  }, []);

  const t = translations[language];

  return (
    <I18nContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </I18nContext.Provider>
  );
}
