import { describe, it, expect, vi, beforeEach } from 'vitest';

// updateChecker is a thin re-export barrel over the tauri-update-notifier package.
// The package is mocked so the tests verify the re-exports are wired up
// (same reference, arguments and return values pass through unchanged)
// without hitting the GitHub API or localStorage.
vi.mock('tauri-update-notifier', () => ({
  checkForUpdates: vi.fn(),
  isVersionDismissed: vi.fn(),
  dismissVersion: vi.fn(),
  clearDismissedVersion: vi.fn(),
}));

import * as notifier from 'tauri-update-notifier';
import {
  checkForUpdates,
  isVersionDismissed,
  dismissVersion,
  clearDismissedVersion,
  type UpdateInfo,
  type UpdateCheckerOptions,
} from './updateChecker';

const updateInfo: UpdateInfo = {
  currentVersion: '0.1.0',
  latestVersion: '0.2.0',
  isUpdateAvailable: true,
  releaseUrl: 'https://github.com/daigotanaka0714/glimpse/releases/tag/v0.2.0',
  releaseNotes: 'Bug fixes',
  publishedAt: '2025-01-01T00:00:00Z',
  assets: [
    {
      name: 'Glimpse_0.2.0_aarch64.dmg',
      downloadUrl: 'https://example.com/Glimpse_0.2.0_aarch64.dmg',
      size: 1234,
      contentType: 'application/octet-stream',
    },
  ],
};

const options: UpdateCheckerOptions = {
  owner: 'daigotanaka0714',
  repo: 'glimpse',
  currentVersion: '0.1.0',
};

describe('updateChecker re-exports', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('checkForUpdates', () => {
    it('should re-export the implementation from tauri-update-notifier', () => {
      expect(checkForUpdates).toBe(notifier.checkForUpdates);
    });

    it('should pass options through and return the update info', async () => {
      vi.mocked(notifier.checkForUpdates).mockResolvedValue(updateInfo);

      await expect(checkForUpdates(options)).resolves.toEqual(updateInfo);
      expect(notifier.checkForUpdates).toHaveBeenCalledTimes(1);
      expect(notifier.checkForUpdates).toHaveBeenCalledWith(options);
    });

    it('should propagate errors from the underlying checker', async () => {
      vi.mocked(notifier.checkForUpdates).mockRejectedValue(new Error('Network error'));

      await expect(checkForUpdates(options)).rejects.toThrow('Network error');
    });
  });

  describe('isVersionDismissed', () => {
    it('should re-export the implementation from tauri-update-notifier', () => {
      expect(isVersionDismissed).toBe(notifier.isVersionDismissed);
    });

    it('should return true when the version has been dismissed', () => {
      vi.mocked(notifier.isVersionDismissed).mockReturnValue(true);

      expect(isVersionDismissed('glimpse', '0.2.0')).toBe(true);
      expect(notifier.isVersionDismissed).toHaveBeenCalledWith('glimpse', '0.2.0');
    });

    it('should return false when the version has not been dismissed', () => {
      vi.mocked(notifier.isVersionDismissed).mockReturnValue(false);

      expect(isVersionDismissed('glimpse', '0.2.0')).toBe(false);
    });
  });

  describe('dismissVersion', () => {
    it('should re-export the implementation from tauri-update-notifier', () => {
      expect(dismissVersion).toBe(notifier.dismissVersion);
    });

    it('should forward the repo and version', () => {
      dismissVersion('glimpse', '0.2.0');

      expect(notifier.dismissVersion).toHaveBeenCalledTimes(1);
      expect(notifier.dismissVersion).toHaveBeenCalledWith('glimpse', '0.2.0');
    });
  });

  describe('clearDismissedVersion', () => {
    it('should re-export the implementation from tauri-update-notifier', () => {
      expect(clearDismissedVersion).toBe(notifier.clearDismissedVersion);
    });

    it('should forward the repo', () => {
      clearDismissedVersion('glimpse');

      expect(notifier.clearDismissedVersion).toHaveBeenCalledTimes(1);
      expect(notifier.clearDismissedVersion).toHaveBeenCalledWith('glimpse');
    });
  });
});
