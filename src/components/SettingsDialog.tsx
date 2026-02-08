import { useState, useEffect, useCallback } from 'react';
import { X, Cpu, Zap, Info, HardDrive, Trash2, Tag, AlertTriangle, RefreshCw, ExternalLink, Heart, Globe, MessageCircle } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-shell';
import {
  checkForUpdates,
  type UpdateInfo,
} from '@/utils/updateChecker';
import { useI18n } from '@/i18n';

// App info
const APP_VERSION = '0.3.0';
const GITHUB_OWNER = 'daigotanaka0714';
const GITHUB_REPO = 'glimpse';
const SPONSOR_URL = 'https://github.com/sponsors/daigotanaka0714';
const FEEDBACK_FORM_EN = 'https://forms.gle/your-english-form-id';
const FEEDBACK_FORM_JA = 'https://forms.gle/your-japanese-form-id';

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

type SettingsTab = 'performance' | 'storage' | 'about';
type FeedbackStep = 'language' | 'method';

export function SettingsDialog({ onClose }: SettingsDialogProps) {
  const { language, setLanguage, t } = useI18n();
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
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [showFeedbackDialog, setShowFeedbackDialog] = useState(false);
  const [feedbackStep, setFeedbackStep] = useState<FeedbackStep>('language');
  const [feedbackLanguage, setFeedbackLanguage] = useState<'en' | 'ja'>('en');

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
      setClearResult(`${t.settings.storage.cacheCleared}: ${sizeStr}`);
      await fetchStorageInfo();
      setTimeout(() => setClearResult(null), 3000);
    } catch (error) {
      console.error('Failed to clear cache:', error);
      setClearResult(t.settings.storage.clearFailed);
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
      setClearResult(`${t.settings.storage.labelsCleared} ${count} ${t.settings.storage.labels}`);
      await fetchStorageInfo();
      setTimeout(() => setClearResult(null), 3000);
    } catch (error) {
      console.error('Failed to clear labels:', error);
      setClearResult(t.settings.storage.clearFailed);
      setTimeout(() => setClearResult(null), 3000);
    } finally {
      setIsClearing(null);
    }
  };

  const handleCheckUpdate = async () => {
    setIsCheckingUpdate(true);
    setUpdateError(null);
    try {
      const info = await checkForUpdates({
        owner: GITHUB_OWNER,
        repo: GITHUB_REPO,
        currentVersion: APP_VERSION,
      });
      setUpdateInfo(info);
    } catch (error) {
      console.error('Failed to check for updates:', error);
      setUpdateError(t.settings.about.checkFailed);
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  const handleOpenRelease = async () => {
    if (updateInfo?.releaseUrl) {
      try {
        await open(updateInfo.releaseUrl);
      } catch (error) {
        console.error('Failed to open URL:', error);
      }
    }
  };

  const handleOpenFeedbackDialog = () => {
    setFeedbackStep('language');
    setFeedbackLanguage(language);
    setShowFeedbackDialog(true);
  };

  const handleSelectFeedbackLanguage = (lang: 'en' | 'ja') => {
    setFeedbackLanguage(lang);
    setFeedbackStep('method');
  };

  const handleGitHubIssue = () => {
    const template = feedbackLanguage === 'en' ? 'bug_report_en.yml' : 'bug_report_ja.yml';
    const url = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/issues/new?template=${template}`;
    open(url);
    setShowFeedbackDialog(false);
  };

  const handleFeedbackForm = () => {
    const url = feedbackLanguage === 'en' ? FEEDBACK_FORM_EN : FEEDBACK_FORM_JA;
    open(url);
    setShowFeedbackDialog(false);
  };

  const handleOpenSponsor = () => {
    open(SPONSOR_URL);
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
              <h3 className="text-lg font-semibold">{t.settings.storage.confirmDelete}</h3>
            </div>
            <p className="text-sm text-text-secondary mb-6">
              {confirmDialog === 'cache'
                ? t.settings.storage.cacheDeleteWarning
                : t.settings.storage.labelDeleteWarning}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmDialog(null)}
                className="px-4 py-2 bg-bg-tertiary hover:bg-white/10 rounded-lg transition-colors text-sm"
              >
                {t.common.cancel}
              </button>
              <button
                onClick={confirmDialog === 'cache' ? handleClearCache : handleClearLabels}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 rounded-lg transition-colors text-sm font-medium"
              >
                {t.common.delete}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Feedback Dialog */}
      {showFeedbackDialog && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-sm bg-bg-secondary rounded-xl shadow-2xl p-6 animate-slide-up">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">{t.feedback.title}</h3>
              <button
                onClick={() => setShowFeedbackDialog(false)}
                className="p-1 rounded hover:bg-white/10 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {feedbackStep === 'language' ? (
              <>
                <p className="text-sm text-text-secondary mb-6">
                  {t.feedback.selectLanguage}
                </p>
                <div className="space-y-3">
                  <button
                    onClick={() => handleSelectFeedbackLanguage('en')}
                    className="w-full flex items-center justify-between px-4 py-3 bg-bg-tertiary hover:bg-white/10 rounded-lg transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">🇺🇸</span>
                      <div className="text-left">
                        <p className="font-medium">{t.feedback.english}</p>
                        <p className="text-xs text-text-secondary">{t.feedback.reportInEnglish}</p>
                      </div>
                    </div>
                    <ExternalLink size={16} className="text-text-secondary" />
                  </button>
                  <button
                    onClick={() => handleSelectFeedbackLanguage('ja')}
                    className="w-full flex items-center justify-between px-4 py-3 bg-bg-tertiary hover:bg-white/10 rounded-lg transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">🇯🇵</span>
                      <div className="text-left">
                        <p className="font-medium">{t.feedback.japanese}</p>
                        <p className="text-xs text-text-secondary">{t.feedback.reportInJapanese}</p>
                      </div>
                    </div>
                    <ExternalLink size={16} className="text-text-secondary" />
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-text-secondary mb-6">
                  {t.feedback.selectMethod}
                </p>
                <div className="space-y-3">
                  <button
                    onClick={handleGitHubIssue}
                    className="w-full flex items-center justify-between px-4 py-3 bg-bg-tertiary hover:bg-white/10 rounded-lg transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-gray-700 flex items-center justify-center">
                        <svg viewBox="0 0 24 24" className="w-6 h-6 text-white" fill="currentColor">
                          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                        </svg>
                      </div>
                      <div className="text-left">
                        <p className="font-medium">{t.feedback.githubIssue}</p>
                        <p className="text-xs text-text-secondary">{t.feedback.githubIssueDesc}</p>
                      </div>
                    </div>
                    <ExternalLink size={16} className="text-text-secondary" />
                  </button>
                  <button
                    onClick={handleFeedbackForm}
                    className="w-full flex items-center justify-between px-4 py-3 bg-bg-tertiary hover:bg-white/10 rounded-lg transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                        <MessageCircle size={20} className="text-blue-400" />
                      </div>
                      <div className="text-left">
                        <p className="font-medium">{t.feedback.feedbackForm}</p>
                        <p className="text-xs text-text-secondary">{t.feedback.feedbackFormDesc}</p>
                      </div>
                    </div>
                    <ExternalLink size={16} className="text-text-secondary" />
                  </button>
                </div>
                <button
                  onClick={() => setFeedbackStep('language')}
                  className="mt-4 text-sm text-text-secondary hover:text-text-primary transition-colors"
                >
                  ← Back
                </button>
              </>
            )}
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
                ) : activeTab === 'storage' ? (
                  <HardDrive size={20} className="text-accent" />
                ) : (
                  <Info size={20} className="text-accent" />
                )}
              </div>
              <div>
                <h2 className="text-lg font-semibold">{t.settings.title}</h2>
                <p className="text-xs text-text-secondary">
                  {activeTab === 'performance'
                    ? t.settings.performance.description
                    : activeTab === 'storage'
                    ? t.settings.storage.description
                    : t.settings.about.description}
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
              {t.settings.performance.title}
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
              {t.settings.storage.title}
            </div>
          </button>
          <button
            onClick={() => setActiveTab('about')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'about'
                ? 'text-accent border-b-2 border-accent bg-accent/5'
                : 'text-text-secondary hover:text-text-primary hover:bg-white/5'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Info size={16} />
              {t.settings.about.title}
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
                  <span className="text-sm text-text-secondary">{t.settings.performance.systemInfo}</span>
                  <span className="text-xs px-2 py-1 bg-accent/20 text-accent rounded-full">
                    {systemInfo.cpu_count} {t.settings.performance.cores}
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold tabular-nums">{threadCount}</span>
                  <span className="text-text-secondary">/ {systemInfo.cpu_count} {t.settings.performance.threadsInUse}</span>
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
                  <span>{t.settings.performance.cpuUsage}: {cpuUsagePercent}%</span>
                  <span>
                    {cpuUsagePercent > 90
                      ? t.settings.performance.highLoad
                      : cpuUsagePercent > 70
                      ? t.settings.performance.normal
                      : t.settings.performance.powerSaving}
                  </span>
                </div>
              </div>

              {/* Thread count slider */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium">{t.settings.performance.processingThreads}</label>
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
                    {t.settings.performance.autoRecommended}
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
                  {t.settings.performance.info}
                  <span className="text-accent"> {t.settings.performance.recommended}: {systemInfo.recommended_threads} threads (80%)</span>
                </p>
              </div>
            </div>

            {/* Footer for Performance tab */}
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-white/10 bg-bg-tertiary/50">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-bg-tertiary hover:bg-white/10 rounded-lg transition-colors text-sm"
              >
                {t.common.cancel}
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
                  <span>{t.common.save}</span>
                )}
              </button>
            </div>
          </>
        ) : activeTab === 'storage' ? (
          <>
            <div className="p-6 space-y-6">
              {/* Storage info card */}
              <div className="p-4 bg-bg-tertiary rounded-xl border border-white/5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-text-secondary">{t.settings.storage.usage}</span>
                  {storageInfo && (
                    <span className="text-xs px-2 py-1 bg-accent/20 text-accent rounded-full">
                      {storageInfo.session_count} {t.settings.storage.sessions}
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
                          <p className="text-sm font-medium">{t.settings.storage.thumbnailCache}</p>
                          <p className="text-xs text-text-secondary">{storageInfo.cache_size_display}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setConfirmDialog('cache')}
                        disabled={isClearing === 'cache' || storageInfo.cache_size_bytes === 0}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 text-red-400 hover:bg-red-500/30 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-xs font-medium transition-colors"
                      >
                        <Trash2 size={12} />
                        {isClearing === 'cache' ? t.settings.storage.clearing : t.settings.storage.clear}
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                          <Tag size={18} className="text-purple-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{t.settings.storage.labelData}</p>
                          <p className="text-xs text-text-secondary">{storageInfo.label_count} {t.settings.storage.labels}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setConfirmDialog('labels')}
                        disabled={isClearing === 'labels' || storageInfo.label_count === 0}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 text-red-400 hover:bg-red-500/30 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-xs font-medium transition-colors"
                      >
                        <Trash2 size={12} />
                        {isClearing === 'labels' ? t.settings.storage.clearing : t.settings.storage.clear}
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
                  clearResult.includes('Failed') || clearResult.includes('失敗')
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
                  <strong className="text-text-primary">{t.settings.storage.thumbnailCache}:</strong> {t.settings.storage.cacheDeleteWarning}
                  <br /><br />
                  <strong className="text-text-primary">{t.settings.storage.labelData}:</strong>
                  <span className="text-red-400"> {t.settings.storage.labelDeleteWarning}</span>
                </p>
              </div>
            </div>

            {/* Footer for Storage tab */}
            <div className="flex justify-end px-6 py-4 border-t border-white/10 bg-bg-tertiary/50">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-bg-tertiary hover:bg-white/10 rounded-lg transition-colors text-sm"
              >
                {t.common.close}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="p-6 space-y-6">
              {/* App info card */}
              <div className="p-4 bg-bg-tertiary rounded-xl border border-white/5">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-16 h-16 rounded-xl bg-accent/20 flex items-center justify-center text-3xl">
                    📷
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">Glimpse</h3>
                    <p className="text-sm text-text-secondary">{t.app.tagline}</p>
                    <p className="text-xs text-text-secondary mt-1">{t.app.version} {APP_VERSION}</p>
                  </div>
                </div>
              </div>

              {/* Language selector */}
              <div className="p-4 bg-bg-tertiary rounded-xl border border-white/5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Globe size={16} className="text-accent" />
                    <span className="text-sm font-medium">{t.settings.about.language}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setLanguage('en')}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors ${
                      language === 'en'
                        ? 'bg-accent text-white'
                        : 'bg-bg-primary hover:bg-white/10'
                    }`}
                  >
                    <span>🇺🇸</span>
                    <span>English</span>
                  </button>
                  <button
                    onClick={() => setLanguage('ja')}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors ${
                      language === 'ja'
                        ? 'bg-accent text-white'
                        : 'bg-bg-primary hover:bg-white/10'
                    }`}
                  >
                    <span>🇯🇵</span>
                    <span>日本語</span>
                  </button>
                </div>
              </div>

              {/* Update check */}
              <div className="p-4 bg-bg-tertiary rounded-xl border border-white/5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium">{t.settings.about.updates}</span>
                </div>

                {updateInfo ? (
                  updateInfo.isUpdateAvailable ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 p-3 bg-accent/10 border border-accent/20 rounded-lg">
                        <RefreshCw size={16} className="text-accent" />
                        <span className="text-sm">
                          {t.settings.about.newVersionAvailable}: <span className="font-medium text-accent">{updateInfo.latestVersion}</span>
                        </span>
                      </div>
                      <button
                        onClick={handleOpenRelease}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover rounded-lg transition-colors text-sm font-medium"
                      >
                        <ExternalLink size={14} />
                        {t.settings.about.downloadUpdate}
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                      <span className="text-sm text-green-400">{t.settings.about.latestVersion}</span>
                    </div>
                  )
                ) : updateError ? (
                  <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                    <span className="text-sm text-red-400">{updateError}</span>
                  </div>
                ) : (
                  <button
                    onClick={handleCheckUpdate}
                    disabled={isCheckingUpdate}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-bg-primary hover:bg-white/10 disabled:opacity-50 rounded-lg transition-colors text-sm"
                  >
                    {isCheckingUpdate ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" />
                        {t.settings.about.checking}
                      </>
                    ) : (
                      <>
                        <RefreshCw size={14} />
                        {t.settings.about.checkForUpdates}
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Links */}
              <div className="space-y-2">
                <div className="flex gap-3">
                  <button
                    onClick={() => open(`https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}`)}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-bg-tertiary hover:bg-white/10 rounded-lg transition-colors text-sm"
                  >
                    <ExternalLink size={14} />
                    {t.settings.about.github}
                  </button>
                  <button
                    onClick={handleOpenFeedbackDialog}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-bg-tertiary hover:bg-white/10 rounded-lg transition-colors text-sm"
                  >
                    <ExternalLink size={14} />
                    {t.settings.about.reportIssue}
                  </button>
                </div>

                {/* Sponsor button */}
                <button
                  onClick={handleOpenSponsor}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-pink-500/10 hover:bg-pink-500/20 border border-pink-500/30 rounded-lg transition-colors text-sm group"
                >
                  <Heart size={16} className="text-pink-400 group-hover:scale-110 transition-transform" />
                  <span className="text-pink-400 font-medium">{t.settings.about.sponsor}</span>
                  <span className="text-pink-400/60 text-xs">- {t.settings.about.sponsorDescription}</span>
                </button>
              </div>
            </div>

            {/* Footer for About tab */}
            <div className="flex justify-end px-6 py-4 border-t border-white/10 bg-bg-tertiary/50">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-bg-tertiary hover:bg-white/10 rounded-lg transition-colors text-sm"
              >
                {t.common.close}
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
