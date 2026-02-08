import { describe, it, expect } from 'vitest';

// Note: The platform module is mocked globally in test/setup.ts
// These tests verify the mock is working correctly
// For actual platform detection testing, you would need integration tests

describe('platform utilities (mocked)', () => {
  describe('detectPlatform', () => {
    it('should return mac (mocked)', async () => {
      const { detectPlatform } = await import('./platform');
      // Mocked to return 'mac' in test setup
      expect(detectPlatform()).toBe('mac');
    });
  });

  describe('isMac', () => {
    it('should return true (mocked)', async () => {
      const { isMac } = await import('./platform');
      // Mocked to return true in test setup
      expect(isMac()).toBe(true);
    });
  });

  describe('getModifierKey', () => {
    it('should return ⌘ (mocked for mac)', async () => {
      const { getModifierKey } = await import('./platform');
      // Mocked to return ⌘ in test setup (mac)
      expect(getModifierKey()).toBe('⌘');
    });
  });

  describe('getModifierKeyText', () => {
    it('should return Cmd (mocked for mac)', async () => {
      const { getModifierKeyText } = await import('./platform');
      // Mocked to return Cmd in test setup (mac)
      expect(getModifierKeyText()).toBe('Cmd');
    });
  });
});
