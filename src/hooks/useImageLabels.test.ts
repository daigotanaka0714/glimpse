import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useImageLabels } from './useImageLabels';
import type { ImageItem } from '@/types';

// Mock the tauri utils
vi.mock('@/utils/tauri', () => ({
  setLabel: vi.fn().mockResolvedValue(undefined),
}));

import { setLabel } from '@/utils/tauri';

describe('useImageLabels', () => {
  const mockImages: ImageItem[] = [
    {
      filename: 'image1.jpg',
      path: '/path/to/image1.jpg',
      thumbnailPath: '/cache/thumb1.jpg',
      thumbnailLoaded: true,
      size: 1024 * 1024,
      modifiedAt: '2024-01-01',
      label: null,
      index: 0,
    },
    {
      filename: 'image2.jpg',
      path: '/path/to/image2.jpg',
      thumbnailPath: '/cache/thumb2.jpg',
      thumbnailLoaded: true,
      size: 1024 * 1024 * 2,
      modifiedAt: '2024-01-02',
      label: 'rejected',
      index: 1,
    },
    {
      filename: 'image3.jpg',
      path: '/path/to/image3.jpg',
      thumbnailPath: '/cache/thumb3.jpg',
      thumbnailLoaded: true,
      size: 1024 * 1024 * 3,
      modifiedAt: '2024-01-03',
      label: null,
      index: 2,
    },
  ];

  let setImages: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    setImages = vi.fn();
  });

  const renderUseImageLabels = (overrides = {}) => {
    const defaultProps = {
      images: mockImages,
      filteredImages: mockImages,
      setImages,
      selectedIndex: 0,
      selectedIndices: new Set<number>(),
      ...overrides,
    };

    return renderHook(() => useImageLabels(defaultProps));
  };

  describe('toggleLabel', () => {
    it('should toggle label for single selection', async () => {
      const { result } = renderUseImageLabels({ selectedIndex: 0 });

      await act(async () => {
        const batchResult = await result.current.toggleLabel();
        expect(batchResult.success).toBe(true);
        expect(batchResult.successCount).toBe(1);
        expect(batchResult.failedCount).toBe(0);
      });

      expect(setLabel).toHaveBeenCalledWith('image1.jpg', 'rejected');
      expect(setImages).toHaveBeenCalled();
    });

    it('should toggle label for multiple selections', async () => {
      const { result } = renderUseImageLabels({
        selectedIndex: 0,
        selectedIndices: new Set([0, 2]),
      });

      await act(async () => {
        const batchResult = await result.current.toggleLabel();
        expect(batchResult.success).toBe(true);
        expect(batchResult.successCount).toBe(2);
      });

      expect(setLabel).toHaveBeenCalledTimes(2);
      expect(setLabel).toHaveBeenCalledWith('image1.jpg', 'rejected');
      expect(setLabel).toHaveBeenCalledWith('image3.jpg', 'rejected');
    });
  });

  describe('markSelectedRejected', () => {
    it('should mark selected images as rejected', async () => {
      const { result } = renderUseImageLabels({
        selectedIndices: new Set([0, 2]),
      });

      await act(async () => {
        const batchResult = await result.current.markSelectedRejected();
        expect(batchResult.success).toBe(true);
        expect(batchResult.successCount).toBe(2);
      });

      expect(setLabel).toHaveBeenCalledWith('image1.jpg', 'rejected');
      expect(setLabel).toHaveBeenCalledWith('image3.jpg', 'rejected');
    });

    it('should return early if no selection', async () => {
      const { result } = renderUseImageLabels({
        selectedIndices: new Set(),
      });

      await act(async () => {
        const batchResult = await result.current.markSelectedRejected();
        expect(batchResult.success).toBe(false);
        expect(batchResult.successCount).toBe(0);
      });

      expect(setLabel).not.toHaveBeenCalled();
    });
  });

  describe('removeSelectedRejected', () => {
    it('should remove rejected label from selected images', async () => {
      const { result } = renderUseImageLabels({
        selectedIndices: new Set([1]),
      });

      await act(async () => {
        const batchResult = await result.current.removeSelectedRejected();
        expect(batchResult.success).toBe(true);
      });

      expect(setLabel).toHaveBeenCalledWith('image2.jpg', null);
    });
  });

  describe('markAllRejected', () => {
    it('should mark all filtered images as rejected', async () => {
      const { result } = renderUseImageLabels();

      await act(async () => {
        const batchResult = await result.current.markAllRejected();
        expect(batchResult.success).toBe(true);
        expect(batchResult.successCount).toBe(3);
      });

      expect(setLabel).toHaveBeenCalledTimes(3);
    });
  });

  describe('removeAllRejected', () => {
    it('should remove rejected label from all filtered images', async () => {
      const { result } = renderUseImageLabels();

      await act(async () => {
        const batchResult = await result.current.removeAllRejected();
        expect(batchResult.success).toBe(true);
        expect(batchResult.successCount).toBe(3);
      });

      expect(setLabel).toHaveBeenCalledTimes(3);
    });
  });

  describe('toggleLabelByFilename', () => {
    it('should toggle label for specific image', async () => {
      const { result } = renderUseImageLabels();

      await act(async () => {
        const batchResult = await result.current.toggleLabelByFilename('image2.jpg');
        expect(batchResult.success).toBe(true);
      });

      // image2 is currently rejected, so should be set to null
      expect(setLabel).toHaveBeenCalledWith('image2.jpg', null);
    });

    it('should fail for non-existent filename', async () => {
      const { result } = renderUseImageLabels();

      await act(async () => {
        const batchResult = await result.current.toggleLabelByFilename('nonexistent.jpg');
        expect(batchResult.success).toBe(false);
        expect(batchResult.failedFilenames).toContain('nonexistent.jpg');
      });
    });
  });

  describe('batchToggleLabelByIndices', () => {
    it('should apply label to multiple indices', async () => {
      const { result } = renderUseImageLabels();

      await act(async () => {
        const batchResult = await result.current.batchToggleLabelByIndices([0, 2], 'rejected');
        expect(batchResult.success).toBe(true);
        expect(batchResult.successCount).toBe(2);
      });

      expect(setLabel).toHaveBeenCalledWith('image1.jpg', 'rejected');
      expect(setLabel).toHaveBeenCalledWith('image3.jpg', 'rejected');
    });

    it('should return success for empty indices', async () => {
      const { result } = renderUseImageLabels();

      await act(async () => {
        const batchResult = await result.current.batchToggleLabelByIndices([], 'rejected');
        expect(batchResult.success).toBe(true);
        expect(batchResult.successCount).toBe(0);
      });

      expect(setLabel).not.toHaveBeenCalled();
    });
  });

  describe('error handling with Promise.allSettled', () => {
    it('should handle partial failures gracefully', async () => {
      // Mock setLabel to fail for specific file
      (setLabel as ReturnType<typeof vi.fn>).mockImplementation((filename: string) => {
        if (filename === 'image2.jpg') {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve();
      });

      const { result } = renderUseImageLabels({
        selectedIndices: new Set([0, 1, 2]),
      });

      await act(async () => {
        const batchResult = await result.current.markSelectedRejected();
        expect(batchResult.success).toBe(false);
        expect(batchResult.successCount).toBe(2);
        expect(batchResult.failedCount).toBe(1);
        expect(batchResult.failedFilenames).toContain('image2.jpg');
      });

      // setImages should be called twice: once for optimistic update, once for revert
      expect(setImages).toHaveBeenCalledTimes(2);
    });

    it('should handle all failures', async () => {
      (setLabel as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('All failed'));

      const { result } = renderUseImageLabels({
        selectedIndices: new Set([0, 1]),
      });

      await act(async () => {
        const batchResult = await result.current.markSelectedRejected();
        expect(batchResult.success).toBe(false);
        expect(batchResult.failedCount).toBe(2);
      });
    });
  });
});
