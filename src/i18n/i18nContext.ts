import { createContext } from 'react';
import type { Language, Translations } from './types';

export interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: Translations;
}

export const I18nContext = createContext<I18nContextType | null>(null);
