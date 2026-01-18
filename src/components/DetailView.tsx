import { useEffect, useState, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, Info, RotateCcw, RotateCw } from 'lucide-react';
import type { ImageItem } from '@/types';
import { getExif, toAssetUrl, type ExifInfo } from '@/utils/tauri';

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
  const [showExif, setShowExif] = useState(false);
  const [exifInfo, setExifInfo] = useState<ExifInfo | null>(null);
  const [exifLoading, setExifLoading] = useState(false);
  const [rotation, setRotation] = useState(0);
  const isRejected = item.label === 'rejected';

  // Reset when image changes
  useEffect(() => {
    setImageLoaded(false);
    setExifInfo(null);
    setRotation(0);
  }, [item.path]);

  // Rotation operations
  const rotateLeft = useCallback(() => {
    setRotation((prev) => (prev - 90 + 360) % 360);
  }, []);

  const rotateRight = useCallback(() => {
    setRotation((prev) => (prev + 90) % 360);
  }, []);

  // Fetch EXIF info
  useEffect(() => {
    if (showExif && !exifInfo) {
      setExifLoading(true);
      getExif(item.path)
        .then(setExifInfo)
        .catch(console.error)
        .finally(() => setExifLoading(false));
    }
  }, [showExif, item.path, exifInfo]);

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col animate-fade-in">
      {/* Image area */}
      <div className="flex-1 flex items-center justify-center relative overflow-hidden">
        {/* Navigation button - left */}
        {item.index > 0 && (
          <button
            onClick={onPrevious}
            className="absolute left-4 z-10 p-3 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          >
            <ChevronLeft size={32} />
          </button>
        )}

        {/* Main image */}
        <div className="relative max-w-full max-h-full p-8">
          {!imageLoaded && (
            <div className="absolute inset-8 flex items-center justify-center">
              <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin" />
            </div>
          )}
          <img
            src={toAssetUrl(item.path)}
            alt={item.filename}
            className={`
              max-w-full max-h-[calc(100vh-120px)] object-contain
              ${imageLoaded ? 'opacity-100' : 'opacity-0'}
              ${isRejected ? 'opacity-50' : ''}
              transition-all duration-300
            `}
            style={{ transform: `rotate(${rotation}deg)` }}
            onLoad={() => setImageLoaded(true)}
          />
          {/* Rejected mark */}
          {isRejected && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-32 h-32 rounded-full bg-rejected/50 flex items-center justify-center">
                <X size={80} className="text-white" strokeWidth={3} />
              </div>
            </div>
          )}
        </div>

        {/* Navigation button - right */}
        {item.index < totalItems - 1 && (
          <button
            onClick={onNext}
            className="absolute right-4 z-10 p-3 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          >
            <ChevronRight size={32} />
          </button>
        )}

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
        >
          <X size={24} />
        </button>

        {/* Rotation buttons */}
        <div className="absolute top-4 left-4 flex gap-2">
          <button
            onClick={rotateLeft}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            title="Rotate 90° left"
          >
            <RotateCcw size={24} />
          </button>
          <button
            onClick={rotateRight}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            title="Rotate 90° right"
          >
            <RotateCw size={24} />
          </button>
          {rotation !== 0 && (
            <span className="flex items-center px-2 text-sm text-white/70">
              {rotation}°
            </span>
          )}
        </div>

        {/* EXIF info button */}
        <button
          onClick={() => setShowExif(!showExif)}
          className={`absolute top-4 right-16 p-2 rounded-full transition-colors ${
            showExif ? 'bg-accent text-white' : 'bg-white/10 hover:bg-white/20'
          }`}
          title="Show EXIF info"
        >
          <Info size={24} />
        </button>

        {/* EXIF info panel */}
        {showExif && (
          <div className="absolute top-16 right-4 w-72 bg-bg-secondary/95 backdrop-blur-sm rounded-lg border border-white/10 shadow-xl overflow-hidden animate-slide-up">
            <div className="px-4 py-3 bg-bg-tertiary border-b border-white/10">
              <h3 className="font-medium text-sm">EXIF Info</h3>
            </div>
            {exifLoading ? (
              <div className="p-4 text-center">
                <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto" />
              </div>
            ) : exifInfo ? (
              <div className="p-3 space-y-2 text-sm max-h-96 overflow-y-auto">
                {exifInfo.camera_model && (
                  <ExifRow label="Camera" value={`${exifInfo.camera_make || ''} ${exifInfo.camera_model}`.trim()} />
                )}
                {exifInfo.lens_model && (
                  <ExifRow label="Lens" value={exifInfo.lens_model} />
                )}
                {exifInfo.focal_length && (
                  <ExifRow label="Focal Length" value={exifInfo.focal_length} />
                )}
                {exifInfo.aperture && (
                  <ExifRow label="Aperture" value={exifInfo.aperture} />
                )}
                {exifInfo.shutter_speed && (
                  <ExifRow label="Shutter Speed" value={exifInfo.shutter_speed} />
                )}
                {exifInfo.iso && (
                  <ExifRow label="ISO" value={exifInfo.iso} />
                )}
                {exifInfo.exposure_compensation && (
                  <ExifRow label="Exposure Comp." value={exifInfo.exposure_compensation} />
                )}
                {exifInfo.date_taken && (
                  <ExifRow label="Date Taken" value={exifInfo.date_taken} />
                )}
                {exifInfo.width && exifInfo.height && (
                  <ExifRow label="Resolution" value={`${exifInfo.width} × ${exifInfo.height}`} />
                )}
              </div>
            ) : (
              <div className="p-4 text-center text-white/50 text-sm">
                Could not retrieve EXIF info
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer info bar */}
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
            Reject{isRejected ? ' ✓' : ''}
          </button>
        </div>
      </div>
    </div>
  );
}

// EXIF info row component
function ExifRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-start gap-2">
      <span className="text-text-secondary flex-shrink-0">{label}</span>
      <span className="text-text-primary text-right break-all">{value}</span>
    </div>
  );
}
