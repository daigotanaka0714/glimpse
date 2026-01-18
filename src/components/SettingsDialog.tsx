import { useState, useEffect, useCallback } from 'react';
import { X, Cpu, Zap, Info } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

interface SystemInfo {
  cpu_count: number;
  current_threads: number;
  recommended_threads: number;
}

interface SettingsDialogProps {
  onClose: () => void;
}

export function SettingsDialog({ onClose }: SettingsDialogProps) {
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [threadCount, setThreadCount] = useState<number>(4);
  const [useAuto, setUseAuto] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // システム情報を取得
  useEffect(() => {
    invoke<SystemInfo>('get_system_info').then((info) => {
      setSystemInfo(info);
      setThreadCount(info.current_threads);
      setUseAuto(info.current_threads === info.recommended_threads);
    });
  }, []);

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
      <div className="w-full max-w-md bg-bg-secondary rounded-2xl shadow-2xl animate-slide-up overflow-hidden">
        {/* ヘッダー */}
        <div className="relative px-6 py-5 border-b border-white/10">
          <div className="absolute inset-0 bg-gradient-to-r from-accent/10 via-transparent to-transparent" />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center">
                <Cpu size={20} className="text-accent" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">パフォーマンス設定</h2>
                <p className="text-xs text-text-secondary">サムネイル生成の処理速度を調整</p>
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

        {/* コンテンツ */}
        <div className="p-6 space-y-6">
          {/* CPU情報カード */}
          <div className="p-4 bg-bg-tertiary rounded-xl border border-white/5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-text-secondary">システム情報</span>
              <span className="text-xs px-2 py-1 bg-accent/20 text-accent rounded-full">
                {systemInfo.cpu_count} コア
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold tabular-nums">{threadCount}</span>
              <span className="text-text-secondary">/ {systemInfo.cpu_count} スレッド使用</span>
            </div>

            {/* CPU使用率バー */}
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
              <span>CPU使用率: {cpuUsagePercent}%</span>
              <span>{cpuUsagePercent > 90 ? '高負荷' : cpuUsagePercent > 70 ? '標準' : '省エネ'}</span>
            </div>
          </div>

          {/* スレッド数スライダー */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium">処理スレッド数</label>
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
                自動（推奨）
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

              {/* スケールマーカー */}
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

          {/* 説明 */}
          <div className="flex gap-3 p-3 bg-accent/5 border border-accent/20 rounded-xl">
            <Info size={16} className="text-accent shrink-0 mt-0.5" />
            <p className="text-xs text-text-secondary leading-relaxed">
              スレッド数を増やすと処理速度が向上しますが、CPU使用率が高くなります。
              低スペックのPCでは、スレッド数を減らすことでシステムの安定性を保てます。
              <span className="text-accent"> 推奨: {systemInfo.recommended_threads}スレッド（80%）</span>
            </p>
          </div>
        </div>

        {/* フッター */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-white/10 bg-bg-tertiary/50">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-bg-tertiary hover:bg-white/10 rounded-lg transition-colors text-sm"
          >
            キャンセル
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-5 py-2 bg-accent hover:bg-accent-hover disabled:opacity-50 rounded-lg transition-all text-sm font-medium"
          >
            {saved ? (
              <>
                <span className="text-green-400">✓</span>
                <span>保存しました</span>
              </>
            ) : isSaving ? (
              <span>保存中...</span>
            ) : (
              <span>保存</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
