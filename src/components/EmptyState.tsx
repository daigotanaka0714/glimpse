import { FolderOpen, Image } from 'lucide-react';
import { useTranslation } from '@/i18n';
import { getModifierKey } from '@/utils/platform';

interface EmptyStateProps {
  onOpenFolder: () => void;
}

export function EmptyState({ onOpenFolder }: EmptyStateProps) {
  const t = useTranslation();
  const modKey = getModifierKey();

  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center max-w-md animate-slide-up">
        {/* Icon */}
        <div className="relative inline-block mb-8">
          <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-accent/20 to-accent/5 flex items-center justify-center">
            <Image size={48} className="text-accent" />
          </div>
          <div className="absolute -bottom-2 -right-2 w-10 h-10 rounded-xl bg-bg-tertiary border border-border-subtle flex items-center justify-center">
            <FolderOpen size={20} className="text-text-secondary" />
          </div>
        </div>

        {/* Text */}
        <h2 className="text-2xl font-semibold mb-3">{t.emptyState.title}</h2>
        <p className="text-text-muted mb-8 leading-relaxed whitespace-pre-line">
          {t.emptyState.description}
        </p>

        {/* Button */}
        <button
          onClick={onOpenFolder}
          className="inline-flex items-center gap-2 px-6 py-3 bg-accent hover:bg-accent-hover rounded-xl transition-colors font-medium text-white"
        >
          <FolderOpen size={20} />
          <span>{t.emptyState.openFolder}</span>
        </button>

        {/* Shortcut hint */}
        <p className="mt-6 text-sm text-text-subtle">
          {t.emptyState.shortcutHint}{' '}
          <kbd className="px-2 py-1 bg-bg-tertiary rounded text-text-secondary">{modKey}</kbd> +{' '}
          <kbd className="px-2 py-1 bg-bg-tertiary rounded text-text-secondary">O</kbd>
        </p>
      </div>
    </div>
  );
}
