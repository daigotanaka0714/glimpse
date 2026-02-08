import { useCallback } from 'react';
import type { ImageItem, LabelStatus } from '@/types';
import { setLabel as setLabelApi } from '@/utils/tauri';

interface BatchLabelResult {
  success: boolean;
  successCount: number;
  failedCount: number;
  failedFilenames: string[];
}

interface UseImageLabelsProps {
  images: ImageItem[];
  filteredImages: ImageItem[];
  setImages: React.Dispatch<React.SetStateAction<ImageItem[]>>;
  selectedIndex: number;
  selectedIndices: Set<number>;
}

export function useImageLabels({
  images,
  filteredImages,
  setImages,
  selectedIndex,
  selectedIndices,
}: UseImageLabelsProps) {
  /**
   * Apply label to multiple images with proper error handling
   * Uses Promise.allSettled to handle partial failures
   */
  const applyLabelToImages = useCallback(
    async (
      filenames: string[],
      label: LabelStatus
    ): Promise<BatchLabelResult> => {
      if (filenames.length === 0) {
        return { success: true, successCount: 0, failedCount: 0, failedFilenames: [] };
      }

      // Immediate UI update (optimistic)
      const filenameSet = new Set(filenames);
      setImages((prev) =>
        prev.map((img) =>
          filenameSet.has(img.filename) ? { ...img, label } : img
        )
      );

      // Save to backend using Promise.allSettled
      const results = await Promise.allSettled(
        filenames.map((filename) => setLabelApi(filename, label))
      );

      // Analyze results
      const failedFilenames: string[] = [];
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          failedFilenames.push(filenames[index]);
          console.error(`Failed to set label for ${filenames[index]}:`, result.reason);
        }
      });

      const successCount = filenames.length - failedFilenames.length;
      const failedCount = failedFilenames.length;

      // Revert failed items in UI
      if (failedCount > 0) {
        const failedSet = new Set(failedFilenames);
        setImages((prev) =>
          prev.map((img) => {
            if (failedSet.has(img.filename)) {
              // Find original label from images array
              const original = images.find((i) => i.filename === img.filename);
              return { ...img, label: original?.label ?? null };
            }
            return img;
          })
        );
      }

      return {
        success: failedCount === 0,
        successCount,
        failedCount,
        failedFilenames,
      };
    },
    [images, setImages]
  );

  /**
   * Toggle label for selected images
   */
  const toggleLabel = useCallback(async (): Promise<BatchLabelResult> => {
    const indicesToToggle =
      selectedIndices.size > 0 ? Array.from(selectedIndices) : [selectedIndex];

    if (
      indicesToToggle.length === 0 ||
      indicesToToggle.some((i) => i < 0 || i >= filteredImages.length)
    ) {
      return { success: false, successCount: 0, failedCount: 0, failedFilenames: [] };
    }

    // Use the first selected image's label state as reference
    const firstImage = filteredImages[indicesToToggle[0]];
    const newLabel: LabelStatus = firstImage.label === 'rejected' ? null : 'rejected';

    const filenames = indicesToToggle
      .map((idx) => filteredImages[idx]?.filename)
      .filter(Boolean) as string[];

    return applyLabelToImages(filenames, newLabel);
  }, [selectedIndex, selectedIndices, filteredImages, applyLabelToImages]);

  /**
   * Mark selected images as rejected
   */
  const markSelectedRejected = useCallback(async (): Promise<BatchLabelResult> => {
    if (selectedIndices.size === 0) {
      return { success: false, successCount: 0, failedCount: 0, failedFilenames: [] };
    }

    const filenames = Array.from(selectedIndices)
      .map((idx) => filteredImages[idx]?.filename)
      .filter(Boolean) as string[];

    return applyLabelToImages(filenames, 'rejected');
  }, [selectedIndices, filteredImages, applyLabelToImages]);

  /**
   * Remove rejected label from selected images
   */
  const removeSelectedRejected = useCallback(async (): Promise<BatchLabelResult> => {
    if (selectedIndices.size === 0) {
      return { success: false, successCount: 0, failedCount: 0, failedFilenames: [] };
    }

    const filenames = Array.from(selectedIndices)
      .map((idx) => filteredImages[idx]?.filename)
      .filter(Boolean) as string[];

    return applyLabelToImages(filenames, null);
  }, [selectedIndices, filteredImages, applyLabelToImages]);

  /**
   * Mark all filtered images as rejected
   */
  const markAllRejected = useCallback(async (): Promise<BatchLabelResult> => {
    if (filteredImages.length === 0) {
      return { success: false, successCount: 0, failedCount: 0, failedFilenames: [] };
    }

    const filenames = filteredImages.map((img) => img.filename);
    return applyLabelToImages(filenames, 'rejected');
  }, [filteredImages, applyLabelToImages]);

  /**
   * Remove rejected label from all filtered images
   */
  const removeAllRejected = useCallback(async (): Promise<BatchLabelResult> => {
    if (filteredImages.length === 0) {
      return { success: false, successCount: 0, failedCount: 0, failedFilenames: [] };
    }

    const filenames = filteredImages.map((img) => img.filename);
    return applyLabelToImages(filenames, null);
  }, [filteredImages, applyLabelToImages]);

  /**
   * Toggle label for a specific image by filename
   */
  const toggleLabelByFilename = useCallback(
    async (filename: string): Promise<BatchLabelResult> => {
      const img = images.find((i) => i.filename === filename);
      if (!img) {
        return { success: false, successCount: 0, failedCount: 0, failedFilenames: [filename] };
      }

      const newLabel: LabelStatus = img.label === 'rejected' ? null : 'rejected';
      return applyLabelToImages([filename], newLabel);
    },
    [images, applyLabelToImages]
  );

  /**
   * Batch toggle label for gallery view (by indices)
   */
  const batchToggleLabelByIndices = useCallback(
    async (indices: number[], label: LabelStatus): Promise<BatchLabelResult> => {
      if (indices.length === 0) {
        return { success: true, successCount: 0, failedCount: 0, failedFilenames: [] };
      }

      const filenames = indices
        .map((idx) => filteredImages[idx]?.filename)
        .filter(Boolean) as string[];

      return applyLabelToImages(filenames, label);
    },
    [filteredImages, applyLabelToImages]
  );

  return {
    toggleLabel,
    markSelectedRejected,
    removeSelectedRejected,
    markAllRejected,
    removeAllRejected,
    toggleLabelByFilename,
    batchToggleLabelByIndices,
  };
}
