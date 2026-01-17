import { useEffect, useState } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import type { ImageItem } from '@/types';

interface DetailViewProps {
  item: ImageItem;
  totalItems: number;
  onClose: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onToggleLabel: () => void;
}

export function DetailView({
  item,
  totalItems,
  onClose,
  onPrevious,
  onNext,
  onToggleLabel,
}: DetailViewProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const isRejected = item.label === 'rejected';

  // 画像が変わったらリセット
  useEffect(() => {
    setImageLoaded(false);
  }, [item.path]);

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col animate-fade-in">
      {/* 画像エリア */}
      <div className="flex-1 flex items-center justify-center relative overflow-hidden">
        {/* ナビゲーションボタン - 左 */}
        {item.index > 0 && (
          <button
            onClick={onPrevious}
            className="absolute left-4 z-10 p-3 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          >
            <ChevronLeft size={32} />
          </button>
        )}

        {/* メイン画像 */}
        <div className="relative max-w-full max-h-full p-8">
          {!imageLoaded && (
            <div className="absolute inset-8 flex items-center justify-center">
              <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin" />
            </div>
          )}
          <img
            src={`asset://localhost/${item.path}`}
            alt={item.filename}
            className={`
              max-w-full max-h-[calc(100vh-120px)] object-contain
              ${imageLoaded ? 'opacity-100' : 'opacity-0'}
              ${isRejected ? 'opacity-50' : ''}
              transition-opacity duration-200
            `}
            onLoad={() => setImageLoaded(true)}
          />
          {/* 不採用マーク */}
          {isRejected && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-32 h-32 rounded-full bg-rejected/50 flex items-center justify-center">
                <X size={80} className="text-white" strokeWidth={3} />
              </div>
            </div>
          )}
        </div>

        {/* ナビゲーションボタン - 右 */}
        {item.index < totalItems - 1 && (
          <button
            onClick={onNext}
            className="absolute right-4 z-10 p-3 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          >
            <ChevronRight size={32} />
          </button>
        )}

        {/* 閉じるボタン */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
        >
          <X size={24} />
        </button>
      </div>

      {/* フッター情報バー */}
      <div className="h-16 px-6 bg-bg-secondary border-t border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <span className="font-mono text-sm">{item.filename}</span>
          <span className="text-white/50 text-sm">
            {(item.size / 1024 / 1024).toFixed(1)} MB
          </span>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-white/50">
            {item.index + 1} / {totalItems}
          </span>

          <button
            onClick={onToggleLabel}
            className={`
              px-4 py-2 rounded-lg font-medium text-sm transition-colors
              ${isRejected
                ? 'bg-rejected text-white'
                : 'bg-bg-tertiary hover:bg-white/10 text-white/70'
              }
            `}
          >
            <span className="mr-2">1</span>
            不採用{isRejected ? ' ✓' : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
