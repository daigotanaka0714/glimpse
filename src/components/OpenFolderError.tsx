import { AlertCircle, X } from "lucide-react";
import { useTranslation } from "@/i18n";

interface OpenFolderErrorProps {
  message: string;
  onDismiss: () => void;
}

export function OpenFolderError({ message, onDismiss }: OpenFolderErrorProps) {
  const t = useTranslation();

  return (
    <div
      role="alert"
      className="flex items-start gap-3 px-4 py-3 bg-rejected-overlay border-b border-rejected/40 animate-slide-up"
    >
      <AlertCircle size={18} className="text-rejected shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{t.openError.title}</p>
        <p className="text-xs text-text-muted break-all">{message}</p>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="p-1 text-text-muted hover:text-text-primary hover:bg-theme-hover rounded-md transition-colors"
        title={t.common.close}
        aria-label={t.common.close}
      >
        <X size={16} />
      </button>
    </div>
  );
}
