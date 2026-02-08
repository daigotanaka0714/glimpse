import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { Language, Translations } from './types';
import { en } from './translations/en';
import { ja } from './translations/ja';

const STORAGE_KEY = 'glimpse-language';

const translations: Record<Language, Translations> = {
  en,
  ja,
};

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: Translations;
}

const I18nContext = createContext<I18nContextType | null>(null);

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

/**
 * Hook to access i18n context
 */
export function useI18n(): I18nContextType {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}

/**
 * Hook to get translations only (for components that don't need to change language)
 */
export function useTranslation(): Translations {
  const { t } = useI18n();
  return t;
}
