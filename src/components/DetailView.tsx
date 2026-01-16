import { useEffect, useState, useCallback } from "react";
import type { ImageFile } from "../types";
import { loadFullImage } from "../hooks/useApi";

interface DetailViewProps {
  image: ImageFile;
  index: number;
  total: number;
  isRejected: boolean;
  onClose: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onToggleRejected: () => void;
}

export function DetailView({
  image,
  index,
  total,
  isRejected,
  onClose,
  onPrevious,
  onNext,
  onToggleRejected,
}: DetailViewProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    loadFullImage(image.path)
      .then((src) => {
        if (!cancelled) {
          setImageSrc(src);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.toString());
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [image.path]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      switch (e.key) {
        case "Escape":
          onClose();
          break;
        case "ArrowLeft":
          onPrevious();
          break;
        case "ArrowRight":
          onNext();
          break;
        case "1":
          onToggleRejected();
          break;
      }
    },
    [onClose, onPrevious, onNext, onToggleRejected]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="detail-view">
      {/* Close button */}
      <button
        className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/50 hover:bg-black/70 transition-colors"
        onClick={onClose}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
        </svg>
      </button>

      {/* Navigation arrows */}
      <button
        className="absolute left-4 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full bg-black/50 hover:bg-black/70 transition-colors disabled:opacity-30"
        onClick={onPrevious}
        disabled={index === 0}
      >
        <svg width="32" height="32" viewBox="0 0 24 24" fill="white">
          <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
        </svg>
      </button>

      <button
        className="absolute right-4 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full bg-black/50 hover:bg-black/70 transition-colors disabled:opacity-30"
        onClick={onNext}
        disabled={index === total - 1}
      >
        <svg width="32" height="32" viewBox="0 0 24 24" fill="white">
          <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
        </svg>
      </button>

      {/* Image container */}
      <div className="flex-1 flex items-center justify-center p-16">
        {loading ? (
          <div className="thumbnail-placeholder" style={{ width: 64, height: 64 }} />
        ) : error ? (
          <div className="text-red-500">Error loading image: {error}</div>
        ) : (
          <img
            src={imageSrc || ""}
            alt={image.filename}
            className={isRejected ? "opacity-50" : ""}
          />
        )}
      </div>

      {/* Info bar */}
      <div className="info-bar">
        <div className="flex items-center gap-4">
          <span className="text-lg font-medium">{image.filename}</span>
          {isRejected && (
            <span className="px-2 py-1 rounded text-sm bg-red-500/20 text-red-400">
              Rejected
            </span>
          )}
          {image.is_raw && (
            <span className="px-2 py-1 rounded text-sm bg-blue-500/20 text-blue-400">
              RAW
            </span>
          )}
        </div>

        <div className="flex items-center gap-6">
          <span className="text-sm text-gray-400">
            {index + 1} / {total}
          </span>

          <button
            className={`btn ${isRejected ? "btn-primary" : "btn-secondary"}`}
            onClick={onToggleRejected}
          >
            {isRejected ? "Restore (1)" : "Reject (1)"}
          </button>
        </div>
      </div>
    </div>
  );
}
