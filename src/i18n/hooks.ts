import { useContext } from "react";
import { I18nContext, type I18nContextType } from "./i18nContext";
import type { Translations } from "./types";

/**
 * Hook to access i18n context
 */
export function useI18n(): I18nContextType {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within an I18nProvider");
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
