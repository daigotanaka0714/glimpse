import { useState, useEffect, useCallback } from 'react';
import { X, Cpu, Zap, Info, HardDrive, Trash2, Tag, AlertTriangle } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

interface SystemInfo {
  cpu_count: number;
  current_threads: number;
  recommended_threads: number;
}

interface StorageInfo {
  cache_size_bytes: number;
  cache_size_display: string;
  label_count: number;
  session_count: number;
}

interface SettingsDialogProps {
  onClose: () => void;
}

type SettingsTab = 'performance' | 'storage';

export function SettingsDialog({ onClose }: SettingsDialogProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('performance');
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null);
  const [threadCount, setThreadCount] = useState<number>(4);
  const [useAuto, setUseAuto] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isClearing, setIsClearing] = useState<'cache' | 'labels' | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<'cache' | 'labels' | null>(null);
  const [clearResult, setClearResult] = useState<string | null>(null);

  // Fetch system info
  useEffect(() => {
    invoke<SystemInfo>('get_system_info').then((info) => {
      setSystemInfo(info);
      setThreadCount(info.current_threads);
      setUseAuto(info.current_threads === info.recommended_threads);
    });
  }, []);

  // Fetch storage info
  const fetchStorageInfo = useCallback(async () => {
    try {
      const info = await invoke<StorageInfo>('get_storage_info');
      setStorageInfo(info);
    } catch (error) {
      console.error('Failed to fetch storage info:', error);
    }
  }, []);

  useEffect(() => {
    fetchStorageInfo();
  }, [fetchStorageInfo]);

  const handleSave = useCallback(async () => {
    if (!systemInfo) return;

    setIsSaving(true);
    try {
      const value = useAuto ? null : threadCount;
      await invoke('set_thread_count', { threadCount: value });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setIsSaving(false);
    }
  }, [useAuto, threadCount, systemInfo]);

  const handleSliderChange = (value: number) => {
    setThreadCount(value);
    setUseAuto(false);
  };

  const handleAutoClick = () => {
    if (systemInfo) {
      setUseAuto(true);
      setThreadCount(systemInfo.recommended_threads);
    }
  };

  const handleClearCache = async () => {
    setConfirmDialog(null);
    setIsClearing('cache');
    try {
      const clearedBytes = await invoke<number>('clear_all_cache');
      const sizeStr = formatBytes(clearedBytes);
      setClearResult(`Cache cleared: ${sizeStr}`);
      await fetchStorageInfo();
      setTimeout(() => setClearResult(null), 3000);
    } catch (error) {
      console.error('Failed to clear cache:', error);
      setClearResult('Failed to clear cache');
      setTimeout(() => setClearResult(null), 3000);
    } finally {
      setIsClearing(null);
    }
  };

  const handleClearLabels = async () => {
    setConfirmDialog(null);
    setIsClearing('labels');
    try {
      const count = await invoke<number>('clear_all_labels');
      setClearResult(`Cleared ${count} labels`);
      await fetchStorageInfo();
      setTimeout(() => setClearResult(null), 3000);
    } catch (error) {
      console.error('Failed to clear labels:', error);
      setClearResult('Failed to clear labels');
      setTimeout(() => setClearResult(null), 3000);
    } finally {
      setIsClearing(null);
    }
  };

  if (!systemInfo) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const cpuUsagePercent = Math.round((threadCount / systemInfo.cpu_count) * 100);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 animate-fade-in">
      {/* Confirmation Dialog */}
      {confirmDialog && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-sm bg-bg-secondary rounded-xl shadow-2xl p-6 animate-slide-up">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                <AlertTriangle size={20} className="text-red-400" />
              </div>
              <h3 className="text-lg font-semibold">Confirm Deletion</h3>
            </div>
            <p className="text-sm text-text-secondary mb-6">
              {confirmDialog === 'cache'
                ? 'This will delete all thumbnail cache files. Thumbnails will be regenerated when you open folders again.'
                : 'This will delete all label data (adopted/rejected status) for all sessions. This action cannot be undone.'}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmDialog(null)}
                className="px-4 py-2 bg-bg-tertiary hover:bg-white/10 rounded-lg transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                onClick={confirmDialog === 'cache' ? handleClearCache : handleClearLabels}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 rounded-lg transition-colors text-sm font-medium"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="w-full max-w-md bg-bg-secondary rounded-2xl shadow-2xl animate-slide-up overflow-hidden">
        {/* Header */}
        <div className="relative px-6 py-5 border-b border-white/10">
          <div className="absolute inset-0 bg-gradient-to-r from-accent/10 via-transparent to-transparent" />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center">
                {activeTab === 'performance' ? (
                  <Cpu size={20} className="text-accent" />
                ) : (
                  <HardDrive size={20} className="text-accent" />
                )}
              </div>
              <div>
                <h2 className="text-lg font-semibold">Settings</h2>
                <p className="text-xs text-text-secondary">
                  {activeTab === 'performance' ? 'Adjust thumbnail generation speed' : 'Manage storage and data'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10">
          <button
            onClick={() => setActiveTab('performance')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'performance'
                ? 'text-accent border-b-2 border-accent bg-accent/5'
                : 'text-text-secondary hover:text-text-primary hover:bg-white/5'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Cpu size={16} />
              Performance
            </div>
          </button>
          <button
            onClick={() => setActiveTab('storage')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'storage'
                ? 'text-accent border-b-2 border-accent bg-accent/5'
                : 'text-text-secondary hover:text-text-primary hover:bg-white/5'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <HardDrive size={16} />
              Storage
            </div>
          </button>
        </div>

        {/* Content */}
        {activeTab === 'performance' ? (
          <>
            <div className="p-6 space-y-6">
              {/* CPU info card */}
              <div className="p-4 bg-bg-tertiary rounded-xl border border-white/5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-text-secondary">System Info</span>
                  <span className="text-xs px-2 py-1 bg-accent/20 text-accent rounded-full">
                    {systemInfo.cpu_count} cores
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold tabular-nums">{threadCount}</span>
                  <span className="text-text-secondary">/ {systemInfo.cpu_count} threads in use</span>
                </div>

                {/* CPU usage bar */}
                <div className="mt-3 h-2 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${cpuUsagePercent}%`,
                      background: cpuUsagePercent > 90
                        ? 'linear-gradient(90deg, #ef4444, #f87171)'
                        : cpuUsagePercent > 70
                        ? 'linear-gradient(90deg, #f59e0b, #fbbf24)'
                        : 'linear-gradient(90deg, #3b82f6, #60a5fa)',
                    }}
                  />
                </div>
                <div className="mt-2 flex justify-between text-xs text-text-secondary">
                  <span>CPU Usage: {cpuUsagePercent}%</span>
                  <span>{cpuUsagePercent > 90 ? 'High Load' : cpuUsagePercent > 70 ? 'Normal' : 'Power Saving'}</span>
                </div>
              </div>

              {/* Thread count slider */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium">Processing Threads</label>
                  <button
                    onClick={handleAutoClick}
                    className={`
                      flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                      ${useAuto
                        ? 'bg-accent text-white'
                        : 'bg-bg-tertiary text-text-secondary hover:bg-white/10'
                      }
                    `}
                  >
                    <Zap size={12} />
                    Auto (Recommended)
                  </button>
                </div>

                <div className="relative">
                  <input
                    type="range"
                    min={2}
                    max={systemInfo.cpu_count}
                    value={threadCount}
                    onChange={(e) => handleSliderChange(Number(e.target.value))}
                    className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer
                      [&::-webkit-slider-thumb]:appearance-none
                      [&::-webkit-slider-thumb]:w-5
                      [&::-webkit-slider-thumb]:h-5
                      [&::-webkit-slider-thumb]:rounded-full
                      [&::-webkit-slider-thumb]:bg-accent
                      [&::-webkit-slider-thumb]:shadow-lg
                      [&::-webkit-slider-thumb]:shadow-accent/30
                      [&::-webkit-slider-thumb]:cursor-pointer
                      [&::-webkit-slider-thumb]:transition-transform
                      [&::-webkit-slider-thumb]:hover:scale-110
                    "
                  />

                  {/* Scale markers */}
                  <div className="flex justify-between mt-2 px-1">
                    {Array.from({ length: Math.min(systemInfo.cpu_count - 1, 5) + 1 }, (_, i) => {
                      const step = Math.max(1, Math.floor((systemInfo.cpu_count - 2) / 5));
                      const value = i === 0 ? 2 : Math.min(2 + i * step, systemInfo.cpu_count);
                      return (
                        <span
                          key={value}
                          className={`text-xs ${threadCount === value ? 'text-accent' : 'text-text-secondary'}`}
                        >
                          {value}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Description */}
              <div className="flex gap-3 p-3 bg-accent/5 border border-accent/20 rounded-xl">
                <Info size={16} className="text-accent shrink-0 mt-0.5" />
                <p className="text-xs text-text-secondary leading-relaxed">
                  Increasing thread count improves processing speed but increases CPU usage.
                  On lower-spec PCs, reducing thread count can maintain system stability.
                  <span className="text-accent"> Recommended: {systemInfo.recommended_threads} threads (80%)</span>
                </p>
              </div>
            </div>

            {/* Footer for Performance tab */}
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-white/10 bg-bg-tertiary/50">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-bg-tertiary hover:bg-white/10 rounded-lg transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-2 px-5 py-2 bg-accent hover:bg-accent-hover disabled:opacity-50 rounded-lg transition-all text-sm font-medium"
              >
                {saved ? (
                  <>
                    <span className="text-green-400">✓</span>
                    <span>Saved</span>
                  </>
                ) : isSaving ? (
                  <span>Saving...</span>
                ) : (
                  <span>Save</span>
                )}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="p-6 space-y-6">
              {/* Storage info card */}
              <div className="p-4 bg-bg-tertiary rounded-xl border border-white/5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-text-secondary">Storage Usage</span>
                  {storageInfo && (
                    <span className="text-xs px-2 py-1 bg-accent/20 text-accent rounded-full">
                      {storageInfo.session_count} sessions
                    </span>
                  )}
                </div>
                {storageInfo ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                          <HardDrive size={18} className="text-blue-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">Thumbnail Cache</p>
                          <p className="text-xs text-text-secondary">{storageInfo.cache_size_display}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setConfirmDialog('cache')}
                        disabled={isClearing === 'cache' || storageInfo.cache_size_bytes === 0}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 text-red-400 hover:bg-red-500/30 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-xs font-medium transition-colors"
                      >
                        <Trash2 size={12} />
                        {isClearing === 'cache' ? 'Clearing...' : 'Clear'}
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                          <Tag size={18} className="text-purple-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">Label Data</p>
                          <p className="text-xs text-text-secondary">{storageInfo.label_count} labels</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setConfirmDialog('labels')}
                        disabled={isClearing === 'labels' || storageInfo.label_count === 0}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 text-red-400 hover:bg-red-500/30 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-xs font-medium transition-colors"
                      >
                        <Trash2 size={12} />
                        {isClearing === 'labels' ? 'Clearing...' : 'Clear'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-4">
                    <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>

              {/* Result message */}
              {clearResult && (
                <div className={`flex items-center gap-2 p-3 rounded-xl ${
                  clearResult.includes('Failed')
                    ? 'bg-red-500/10 border border-red-500/20 text-red-400'
                    : 'bg-green-500/10 border border-green-500/20 text-green-400'
                }`}>
                  <span className="text-sm">{clearResult}</span>
                </div>
              )}

              {/* Description */}
              <div className="flex gap-3 p-3 bg-accent/5 border border-accent/20 rounded-xl">
                <Info size={16} className="text-accent shrink-0 mt-0.5" />
                <p className="text-xs text-text-secondary leading-relaxed">
                  <strong className="text-text-primary">Thumbnail Cache:</strong> Cached thumbnail images for faster loading.
                  Clearing this will cause thumbnails to be regenerated when you open folders.
                  <br /><br />
                  <strong className="text-text-primary">Label Data:</strong> Adopted/rejected status for all images across all sessions.
                  <span className="text-red-400"> Clearing this cannot be undone.</span>
                </p>
              </div>
            </div>

            {/* Footer for Storage tab */}
            <div className="flex justify-end px-6 py-4 border-t border-white/10 bg-bg-tertiary/50">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-bg-tertiary hover:bg-white/10 rounded-lg transition-colors text-sm"
              >
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Helper function to format bytes
function formatBytes(bytes: number): string {
  const KB = 1024;
  const MB = KB * 1024;
  const GB = MB * 1024;

  if (bytes >= GB) {
    return `${(bytes / GB).toFixed(2)} GB`;
  } else if (bytes >= MB) {
    return `${(bytes / MB).toFixed(2)} MB`;
  } else if (bytes >= KB) {
    return `${(bytes / KB).toFixed(2)} KB`;
  } else {
    return `${bytes} B`;
  }
}
