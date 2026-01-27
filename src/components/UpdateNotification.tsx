import { useState, useEffect, useCallback } from 'react';
import { X, Download, ExternalLink } from 'lucide-react';
import { open } from '@tauri-apps/plugin-shell';
import {
  checkForUpdates,
  isVersionDismissed,
  dismissVersion,
  type UpdateInfo,
} from '@/utils/updateChecker';

interface UpdateNotificationProps {
  owner: string;
  repo: string;
  currentVersion: string;
  checkOnMount?: boolean;
  checkInterval?: number; // in milliseconds, 0 to disable
}

export function UpdateNotification({
  owner,
  repo,
  currentVersion,
  checkOnMount = true,
  checkInterval = 0,
}: UpdateNotificationProps) {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  const performCheck = useCallback(async () => {
    if (isChecking) return;

    setIsChecking(true);
    try {
      const info = await checkForUpdates({ owner, repo, currentVersion });

      if (info.isUpdateAvailable && !isVersionDismissed(repo, info.latestVersion)) {
        setUpdateInfo(info);
        setIsVisible(true);
      }
    } catch (error) {
      console.error('Failed to check for updates:', error);
    } finally {
      setIsChecking(false);
    }
  }, [owner, repo, currentVersion, isChecking]);

  // Check on mount
  useEffect(() => {
    if (checkOnMount) {
      // Delay initial check to not block app startup
      const timeout = setTimeout(performCheck, 2000);
      return () => clearTimeout(timeout);
    }
  }, [checkOnMount, performCheck]);

  // Periodic check
  useEffect(() => {
    if (checkInterval > 0) {
      const interval = setInterval(performCheck, checkInterval);
      return () => clearInterval(interval);
    }
  }, [checkInterval, performCheck]);

  const handleDismiss = useCallback(() => {
    setIsVisible(false);
  }, []);

  const handleSkipVersion = useCallback(() => {
    if (updateInfo) {
      dismissVersion(repo, updateInfo.latestVersion);
    }
    setIsVisible(false);
  }, [repo, updateInfo]);

  const handleDownload = useCallback(async () => {
    if (updateInfo?.releaseUrl) {
      try {
        await open(updateInfo.releaseUrl);
      } catch (error) {
        console.error('Failed to open URL:', error);
        // Fallback to window.open
        window.open(updateInfo.releaseUrl, '_blank');
      }
    }
  }, [updateInfo]);

  if (!isVisible || !updateInfo) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm animate-slide-up">
      <div className="bg-bg-secondary border border-white/10 rounded-lg shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-accent/20 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Download size={18} className="text-accent" />
            <span className="font-medium text-text-primary">Update Available</span>
          </div>
          <button
            onClick={handleDismiss}
            className="p-1 rounded hover:bg-white/10 transition-colors"
            aria-label="Close"
          >
            <X size={16} className="text-text-secondary" />
          </button>
        </div>

        {/* Content */}
        <div className="px-4 py-3">
          <p className="text-sm text-text-secondary mb-2">
            A new version is available!
          </p>
          <div className="flex items-center gap-2 text-sm mb-3">
            <span className="text-text-secondary">{updateInfo.currentVersion}</span>
            <span className="text-text-secondary">→</span>
            <span className="text-accent font-medium">{updateInfo.latestVersion}</span>
          </div>

          {/* Release notes preview */}
          {updateInfo.releaseNotes && (
            <div className="text-xs text-text-secondary bg-bg-primary rounded p-2 mb-3 max-h-20 overflow-y-auto">
              {updateInfo.releaseNotes.slice(0, 200)}
              {updateInfo.releaseNotes.length > 200 && '...'}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={handleDownload}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-accent hover:bg-accent/80 text-white rounded-md text-sm font-medium transition-colors"
            >
              <ExternalLink size={14} />
              Download
            </button>
            <button
              onClick={handleSkipVersion}
              className="px-3 py-2 text-text-secondary hover:bg-white/10 rounded-md text-sm transition-colors"
            >
              Skip
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
