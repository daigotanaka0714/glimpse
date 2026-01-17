import { FolderOpen, Image } from 'lucide-react';

interface EmptyStateProps {
  onOpenFolder: () => void;
}

export function EmptyState({ onOpenFolder }: EmptyStateProps) {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center max-w-md animate-slide-up">
        {/* アイコン */}
        <div className="relative inline-block mb-8">
          <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-accent/20 to-accent/5 flex items-center justify-center">
            <Image size={48} className="text-accent" />
          </div>
          <div className="absolute -bottom-2 -right-2 w-10 h-10 rounded-xl bg-bg-tertiary border border-white/10 flex items-center justify-center">
            <FolderOpen size={20} className="text-white/70" />
          </div>
        </div>

        {/* テキスト */}
        <h2 className="text-2xl font-semibold mb-3">Glimpse</h2>
        <p className="text-white/50 mb-8 leading-relaxed">
          舞台写真の高速チェッカー
          <br />
          フォルダを選択して写真の選別を始めましょう
        </p>

        {/* ボタン */}
        <button
          onClick={onOpenFolder}
          className="inline-flex items-center gap-2 px-6 py-3 bg-accent hover:bg-accent-hover rounded-xl transition-colors font-medium"
        >
          <FolderOpen size={20} />
          <span>フォルダを開く</span>
        </button>

        {/* ショートカットヒント */}
        <p className="mt-6 text-sm text-white/30">
          または <kbd className="px-2 py-1 bg-bg-tertiary rounded">Ctrl</kbd> +{' '}
          <kbd className="px-2 py-1 bg-bg-tertiary rounded">O</kbd>
        </p>
      </div>
    </div>
  );
}
