import { describe, it, expect, vi, beforeEach } from 'vitest';
import { toImageItem } from './tauri';
import type { LabelStatus } from '@/types';

describe('toImageItem', () => {
  const mockImageInfo = {
    filename: 'DSC_0001.NEF',
    path: '/photos/DSC_0001.NEF',
    size: 20 * 1024 * 1024,
    modified_at: '2024/12/15 14:32',
  };

  const cacheDir = '/cache/session123/thumbnails';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should convert ImageInfo to ImageItem with no label', () => {
    const labels = new Map<string, LabelStatus>();
    const result = toImageItem(mockImageInfo, 0, labels, cacheDir);

    expect(result).toEqual({
      filename: 'DSC_0001.NEF',
      path: '/photos/DSC_0001.NEF',
      size: 20 * 1024 * 1024,
      modifiedAt: '2024/12/15 14:32',
      thumbnailPath: '/cache/session123/thumbnails/DSC_0001.jpg',
      thumbnailLoaded: false,
      label: null,
      index: 0,
    });
  });

  it('should convert ImageInfo to ImageItem with rejected label', () => {
    const labels = new Map<string, LabelStatus>();
    labels.set('DSC_0001.NEF', 'rejected');

    const result = toImageItem(mockImageInfo, 5, labels, cacheDir);

    expect(result.label).toBe('rejected');
    expect(result.index).toBe(5);
  });

  it('should handle JPEG files correctly', () => {
    const jpegInfo = {
      ...mockImageInfo,
      filename: 'IMG_0001.jpg',
      path: '/photos/IMG_0001.jpg',
    };
    const labels = new Map<string, LabelStatus>();

    const result = toImageItem(jpegInfo, 0, labels, cacheDir);

    expect(result.thumbnailPath).toBe('/cache/session123/thumbnails/IMG_0001.jpg');
  });

  it('should handle files with multiple dots in name', () => {
    const multiDotInfo = {
      ...mockImageInfo,
      filename: 'photo.backup.NEF',
      path: '/photos/photo.backup.NEF',
    };
    const labels = new Map<string, LabelStatus>();

    const result = toImageItem(multiDotInfo, 0, labels, cacheDir);

    expect(result.thumbnailPath).toBe('/cache/session123/thumbnails/photo.backup.jpg');
  });
});
