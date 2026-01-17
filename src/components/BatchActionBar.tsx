import { X, XCircle, CheckCircle, Layers } from 'lucide-react';

interface BatchActionBarProps {
  selectedCount: number;
  filteredCount: number;
  filterMode: 'all' | 'adopted' | 'rejected';
  onMarkRejected: () => void;
  onRemoveRejected: () => void;
  onMarkAllRejected: () => void;
  onRemoveAllRejected: () => void;
  onClearSelection: () => void;
}

export function BatchActionBar({
  selectedCount,
  filteredCount,
  filterMode,
  onMarkRejected,
  onRemoveRejected,
  onMarkAllRejected,
  onRemoveAllRejected,
  onClearSelection,
}: BatchActionBarProps) {
  if (selectedCount <= 1) return null;

  return (
    <div className="animate-slide-up">
      {/* グラス効果のアクションバー */}
      <div className="flex items-center justify-between h-12 px-4 bg-gradient-to-r from-bg-secondary/95 via-bg-tertiary/95 to-bg-secondary/95 backdrop-blur-md border-b border-white/10 shadow-lg">
        {/* 左側: 選択情報 */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-accent/20 border border-accent/30 rounded-full">
            <Layers size={14} className="text-accent" />
            <span className="text-sm font-medium text-accent">
              {selectedCount}枚を選択中
            </span>
          </div>

          <button
            onClick={onClearSelection}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-white/60 hover:text-white/90 hover:bg-white/5 rounded-md transition-all"
            title="選択を解除"
          >
            <X size={14} />
            <span>解除</span>
          </button>
        </div>

        {/* 中央: バッチアクション */}
        <div className="flex items-center gap-2">
          {/* 選択した画像に不採用を設定 */}
          <button
            onClick={onMarkRejected}
            className="group flex items-center gap-2 px-4 py-2 bg-rejected/10 hover:bg-rejected/20 border border-rejected/30 hover:border-rejected/50 text-rejected rounded-lg transition-all duration-200"
            title="選択した画像を不採用にする"
          >
            <XCircle size={16} className="group-hover:scale-110 transition-transform" />
            <span className="text-sm font-medium">不採用にする</span>
          </button>

          {/* 選択した画像から不採用を解除 */}
          <button
            onClick={onRemoveRejected}
            className="group flex items-center gap-2 px-4 py-2 bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 hover:border-green-500/50 text-green-400 rounded-lg transition-all duration-200"
            title="選択した画像の不採用を解除する"
          >
            <CheckCircle size={16} className="group-hover:scale-110 transition-transform" />
            <span className="text-sm font-medium">採用に戻す</span>
          </button>

          {/* セパレーター */}
          <div className="w-px h-6 bg-white/10 mx-2" />

          {/* フィルター中の全画像に適用 */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/40">
              {filterMode === 'all' ? '全' : filterMode === 'adopted' ? '採用' : '不採用'}
              {filteredCount}枚に:
            </span>
            <button
              onClick={onMarkAllRejected}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-white/60 hover:text-rejected hover:bg-rejected/10 border border-white/10 hover:border-rejected/30 rounded-md transition-all"
              title={`${filterMode === 'all' ? '全て' : filterMode === 'adopted' ? '採用中の画像' : '不採用の画像'}を不採用にする`}
            >
              <XCircle size={12} />
              <span>一括不採用</span>
            </button>
            <button
              onClick={onRemoveAllRejected}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-white/60 hover:text-green-400 hover:bg-green-500/10 border border-white/10 hover:border-green-500/30 rounded-md transition-all"
              title={`${filterMode === 'all' ? '全て' : filterMode === 'adopted' ? '採用中の画像' : '不採用の画像'}の不採用を解除する`}
            >
              <CheckCircle size={12} />
              <span>一括解除</span>
            </button>
          </div>
        </div>

        {/* 右側: キーボードヒント */}
        <div className="flex items-center gap-2 text-xs text-white/30">
          <span>Esc: 選択解除</span>
          <span className="text-white/20">|</span>
          <span>1: 不採用トグル</span>
        </div>
      </div>
    </div>
  );
}
