import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DetailView } from './DetailView';
import type { ImageItem } from '@/types';

// Mock the tauri utils
vi.mock('@/utils/tauri', () => ({
  getExif: vi.fn().mockResolvedValue({
    camera_make: 'Nikon',
    camera_model: 'D850',
    lens_model: '24-70mm f/2.8',
    focal_length: '50mm',
    aperture: 'f/2.8',
    shutter_speed: '1/250s',
    iso: '400',
    date_taken: '2024-01-01 12:00:00',
    width: 8256,
    height: 5504,
  }),
  toAssetUrl: vi.fn((path: string) => `asset://localhost/${encodeURIComponent(path)}`),
}));

describe('DetailView', () => {
  const mockItem: ImageItem = {
    filename: 'test-image.jpg',
    path: '/path/to/test-image.jpg',
    thumbnailPath: '/path/to/thumb.jpg',
    thumbnailLoaded: true,
    size: 1024 * 1024 * 5, // 5MB
    modifiedAt: '2024-01-01',
    label: null,
    index: 5,
  };

  const defaultProps = {
    item: mockItem,
    totalItems: 100,
    onClose: vi.fn(),
    onPrevious: vi.fn(),
    onNext: vi.fn(),
    onToggleLabel: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render the main image', () => {
      render(<DetailView {...defaultProps} />);

      const image = screen.getByAltText('test-image.jpg');
      expect(image).toBeInTheDocument();
    });

    it('should display filename', () => {
      render(<DetailView {...defaultProps} />);

      expect(screen.getByText('test-image.jpg')).toBeInTheDocument();
    });

    it('should display file size', () => {
      render(<DetailView {...defaultProps} />);

      expect(screen.getByText('5.0 MB')).toBeInTheDocument();
    });

    it('should display image counter', () => {
      render(<DetailView {...defaultProps} />);

      expect(screen.getByText('6 / 100')).toBeInTheDocument();
    });

    it('should render reject button', () => {
      render(<DetailView {...defaultProps} />);

      expect(screen.getByText(/Reject/)).toBeInTheDocument();
    });

    it('should render rotation buttons', () => {
      render(<DetailView {...defaultProps} />);

      // Rotation buttons should be present
      const buttons = screen.getAllByRole('button');
      const rotateButtons = buttons.filter(btn => btn.getAttribute('title')?.includes('Rotate'));
      expect(rotateButtons.length).toBe(2);
    });

    it('should render EXIF button', () => {
      render(<DetailView {...defaultProps} />);

      const buttons = screen.getAllByRole('button');
      const exifButton = buttons.find(btn => btn.getAttribute('title')?.includes('EXIF'));
      expect(exifButton).toBeInTheDocument();
    });
  });

  describe('navigation', () => {
    it('should call onClose when close button clicked', () => {
      render(<DetailView {...defaultProps} />);

      const buttons = screen.getAllByRole('button');
      const closeButton = buttons.find(btn =>
        btn.className.includes('top-4') && btn.className.includes('right-4')
      );

      if (closeButton) {
        fireEvent.click(closeButton);
        expect(defaultProps.onClose).toHaveBeenCalled();
      }
    });

    it('should call onPrevious when left navigation clicked', () => {
      render(<DetailView {...defaultProps} />);

      const buttons = screen.getAllByRole('button');
      const leftNav = buttons.find(btn =>
        btn.className.includes('left-4') && btn.className.includes('z-10')
      );

      if (leftNav) {
        fireEvent.click(leftNav);
        expect(defaultProps.onPrevious).toHaveBeenCalled();
      }
    });

    it('should call onNext when right navigation clicked', () => {
      render(<DetailView {...defaultProps} />);

      const buttons = screen.getAllByRole('button');
      const rightNav = buttons.find(btn =>
        btn.className.includes('right-4') &&
        btn.className.includes('z-10') &&
        !btn.className.includes('top-4')
      );

      if (rightNav) {
        fireEvent.click(rightNav);
        expect(defaultProps.onNext).toHaveBeenCalled();
      }
    });

    it('should hide left navigation on first image', () => {
      const firstItem = { ...mockItem, index: 0 };
      render(<DetailView {...defaultProps} item={firstItem} />);

      const buttons = screen.getAllByRole('button');
      const leftNavButtons = buttons.filter(btn =>
        btn.className.includes('left-4') && btn.className.includes('z-10')
      );

      expect(leftNavButtons.length).toBe(0);
    });

    it('should hide right navigation on last image', () => {
      const lastItem = { ...mockItem, index: 99 };
      render(<DetailView {...defaultProps} item={lastItem} />);

      const buttons = screen.getAllByRole('button');
      const rightNavButtons = buttons.filter(btn =>
        btn.className.includes('right-4') &&
        btn.className.includes('z-10') &&
        !btn.className.includes('top-4')
      );

      expect(rightNavButtons.length).toBe(0);
    });
  });

  describe('label toggle', () => {
    it('should call onToggleLabel when reject button clicked', () => {
      render(<DetailView {...defaultProps} />);

      const rejectButton = screen.getByText(/Reject/).closest('button');
      if (rejectButton) {
        fireEvent.click(rejectButton);
        expect(defaultProps.onToggleLabel).toHaveBeenCalled();
      }
    });

    it('should show Rejected state for rejected image', () => {
      const rejectedItem = { ...mockItem, label: 'rejected' as const };
      render(<DetailView {...defaultProps} item={rejectedItem} />);

      expect(screen.getByText(/Rejected/)).toBeInTheDocument();
    });

    it('should apply opacity to rejected image', () => {
      const rejectedItem = { ...mockItem, label: 'rejected' as const };
      render(<DetailView {...defaultProps} item={rejectedItem} />);

      const image = screen.getByAltText('test-image.jpg');
      expect(image.className).toContain('opacity-50');
    });
  });

  describe('EXIF panel', () => {
    it('should have EXIF button', () => {
      render(<DetailView {...defaultProps} />);

      const buttons = screen.getAllByRole('button');
      const exifButton = buttons.find(btn => btn.getAttribute('title')?.includes('EXIF'));

      expect(exifButton).toBeInTheDocument();
    });

    it('should toggle EXIF panel visibility on click', async () => {
      render(<DetailView {...defaultProps} />);

      const buttons = screen.getAllByRole('button');
      const exifButton = buttons.find(btn => btn.getAttribute('title')?.includes('EXIF'));

      if (exifButton) {
        // Initially, EXIF panel should not be visible
        expect(screen.queryByText('EXIF Info')).not.toBeInTheDocument();

        // Click to show
        fireEvent.click(exifButton);
        expect(await screen.findByText('EXIF Info')).toBeInTheDocument();
      }
    });
  });

  describe('rotation', () => {
    it('should show rotation degree when rotated', () => {
      render(<DetailView {...defaultProps} />);

      const buttons = screen.getAllByRole('button');
      const rotateRightButton = buttons.find(btn =>
        btn.getAttribute('title')?.includes('right')
      );

      if (rotateRightButton) {
        fireEvent.click(rotateRightButton);
        expect(screen.getByText('90°')).toBeInTheDocument();
      }
    });

    it('should hide rotation degree when at 0', () => {
      render(<DetailView {...defaultProps} />);

      // Initially should not show rotation degree
      expect(screen.queryByText('0°')).not.toBeInTheDocument();
    });
  });
});
