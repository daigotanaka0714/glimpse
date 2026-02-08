import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { I18nProvider, useI18n, useTranslation } from './context';

// Test component to access hook values
function TestComponent() {
  const { language, setLanguage, t } = useI18n();
  return (
    <div>
      <span data-testid="language">{language}</span>
      <span data-testid="app-name">{t.app.name}</span>
      <span data-testid="open-folder">{t.emptyState.openFolder}</span>
      <button onClick={() => setLanguage('ja')}>Switch to Japanese</button>
      <button onClick={() => setLanguage('en')}>Switch to English</button>
    </div>
  );
}

function TranslationTestComponent() {
  const t = useTranslation();
  return (
    <div>
      <span data-testid="app-name">{t.app.name}</span>
      <span data-testid="tagline">{t.app.tagline}</span>
    </div>
  );
}

describe('I18n Context', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(Storage.prototype, 'getItem');
    vi.spyOn(Storage.prototype, 'setItem');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('I18nProvider', () => {
    it('should provide default language as English', () => {
      render(
        <I18nProvider>
          <TestComponent />
        </I18nProvider>
      );

      expect(screen.getByTestId('language')).toHaveTextContent('en');
    });

    it('should load saved language from localStorage', () => {
      localStorage.setItem('glimpse-language', 'ja');

      render(
        <I18nProvider>
          <TestComponent />
        </I18nProvider>
      );

      expect(screen.getByTestId('language')).toHaveTextContent('ja');
    });

    it('should provide English translations', () => {
      render(
        <I18nProvider>
          <TestComponent />
        </I18nProvider>
      );

      expect(screen.getByTestId('app-name')).toHaveTextContent('Glimpse');
      expect(screen.getByTestId('open-folder')).toHaveTextContent('Open Folder');
    });

    it('should provide Japanese translations when language is ja', () => {
      localStorage.setItem('glimpse-language', 'ja');

      render(
        <I18nProvider>
          <TestComponent />
        </I18nProvider>
      );

      expect(screen.getByTestId('app-name')).toHaveTextContent('Glimpse');
      expect(screen.getByTestId('open-folder')).toHaveTextContent('フォルダを開く');
    });

    it('should switch language and save to localStorage', () => {
      render(
        <I18nProvider>
          <TestComponent />
        </I18nProvider>
      );

      // Initially English
      expect(screen.getByTestId('open-folder')).toHaveTextContent('Open Folder');

      // Switch to Japanese
      act(() => {
        fireEvent.click(screen.getByText('Switch to Japanese'));
      });

      expect(screen.getByTestId('language')).toHaveTextContent('ja');
      expect(screen.getByTestId('open-folder')).toHaveTextContent('フォルダを開く');
      expect(localStorage.setItem).toHaveBeenCalledWith('glimpse-language', 'ja');
    });

    it('should switch back to English', () => {
      localStorage.setItem('glimpse-language', 'ja');

      render(
        <I18nProvider>
          <TestComponent />
        </I18nProvider>
      );

      // Initially Japanese
      expect(screen.getByTestId('open-folder')).toHaveTextContent('フォルダを開く');

      // Switch to English
      act(() => {
        fireEvent.click(screen.getByText('Switch to English'));
      });

      expect(screen.getByTestId('language')).toHaveTextContent('en');
      expect(screen.getByTestId('open-folder')).toHaveTextContent('Open Folder');
    });
  });

  describe('useI18n', () => {
    it('should throw error when used outside provider', () => {
      // Suppress console.error for this test
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        render(<TestComponent />);
      }).toThrow('useI18n must be used within an I18nProvider');

      consoleSpy.mockRestore();
    });
  });

  describe('useTranslation', () => {
    it('should return translations object', () => {
      render(
        <I18nProvider>
          <TranslationTestComponent />
        </I18nProvider>
      );

      expect(screen.getByTestId('app-name')).toHaveTextContent('Glimpse');
      expect(screen.getByTestId('tagline')).toHaveTextContent('High-speed photo checker for stage photography');
    });

    it('should return Japanese translations when language is ja', () => {
      localStorage.setItem('glimpse-language', 'ja');

      render(
        <I18nProvider>
          <TranslationTestComponent />
        </I18nProvider>
      );

      expect(screen.getByTestId('tagline')).toHaveTextContent('舞台写真用高速写真チェッカー');
    });
  });
});
