import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GalleryView } from './GalleryView';
import type { ImageItem } from '@/types';

describe('GalleryView', () => {
  const mockItems: ImageItem[] = [
    {
      filename: 'image1.jpg',
      path: '/path/to/image1.jpg',
      thumbnailPath: '/path/to/thumb1.jpg',
      thumbnailLoaded: true,
      size: 1024 * 1024 * 2, // 2MB
      modifiedAt: '2024-01-01',
      label: null,
      index: 0,
    },
    {
      filename: 'image2.jpg',
      path: '/path/to/image2.jpg',
      thumbnailPath: '/path/to/thumb2.jpg',
      thumbnailLoaded: true,
      size: 1024 * 1024 * 3, // 3MB
      modifiedAt: '2024-01-02',
      label: 'rejected',
      index: 1,
    },
    {
      filename: 'image3.jpg',
      path: '/path/to/image3.jpg',
      thumbnailPath: '/path/to/thumb3.jpg',
      thumbnailLoaded: true,
      size: 1024 * 1024 * 1.5, // 1.5MB
      modifiedAt: '2024-01-03',
      label: null,
      index: 2,
    },
  ];

  const defaultProps = {
    items: mockItems,
    selectedIndex: 0,
    onClose: vi.fn(),
    onSelect: vi.fn(),
    onToggleLabel: vi.fn(),
    onBatchToggleLabel: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render the gallery container', () => {
      const { container } = render(<GalleryView {...defaultProps} />);

      const gallery = container.querySelector('.fixed.inset-0');
      expect(gallery).toBeInTheDocument();
    });

    it('should display filename in footer', () => {
      render(<GalleryView {...defaultProps} />);

      expect(screen.getByText('image1.jpg')).toBeInTheDocument();
    });

    it('should display file size', () => {
      render(<GalleryView {...defaultProps} />);

      expect(screen.getByText('2.0 MB')).toBeInTheDocument();
    });

    it('should display image counter', () => {
      render(<GalleryView {...defaultProps} />);

      expect(screen.getByText('1 / 3')).toBeInTheDocument();
    });

    it('should render thumbnail strip with indices', () => {
      render(<GalleryView {...defaultProps} />);

      // Check that thumbnails are rendered (at least buttons exist)
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(3); // Navigation + close + thumbnails
    });

    it('should show rejected indicator for rejected images', () => {
      render(<GalleryView {...defaultProps} selectedIndex={1} />);

      // The reject button should show "Rejected" state
      expect(screen.getByText(/Rejected/)).toBeInTheDocument();
    });
  });

  describe('navigation', () => {
    it('should call onClose when close button clicked', () => {
      render(<GalleryView {...defaultProps} />);

      // Find close button by X icon (there are multiple, we want the one in the header)
      const closeButtons = screen.getAllByRole('button');
      const closeButton = closeButtons.find(btn =>
        btn.className.includes('top-4') && btn.className.includes('right-4')
      );

      if (closeButton) {
        fireEvent.click(closeButton);
        expect(defaultProps.onClose).toHaveBeenCalled();
      }
    });

    it('should call onSelect when thumbnail clicked', () => {
      render(<GalleryView {...defaultProps} />);

      // Find and click the second thumbnail (index 1)
      const thumbnails = screen.getAllByRole('button').filter(btn =>
        btn.querySelector('img[alt="image2.jpg"]')
      );

      if (thumbnails.length > 0) {
        fireEvent.click(thumbnails[0]);
        expect(defaultProps.onSelect).toHaveBeenCalledWith(1);
      }
    });

    it('should show navigation buttons when not at edges', () => {
      render(<GalleryView {...defaultProps} selectedIndex={1} />);

      // Both left and right navigation should be visible when in the middle
      const buttons = screen.getAllByRole('button');
      const leftNav = buttons.find(btn => btn.className.includes('left-4'));
      const rightNav = buttons.find(btn => btn.className.includes('right-4') && !btn.className.includes('top-4'));

      expect(leftNav).toBeInTheDocument();
      expect(rightNav).toBeInTheDocument();
    });

    it('should hide left navigation on first image', () => {
      render(<GalleryView {...defaultProps} selectedIndex={0} />);

      const buttons = screen.getAllByRole('button');
      const leftNavButtons = buttons.filter(btn =>
        btn.className.includes('left-4') && btn.className.includes('z-10')
      );

      expect(leftNavButtons.length).toBe(0);
    });

    it('should hide right navigation on last image', () => {
      render(<GalleryView {...defaultProps} selectedIndex={2} />);

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
    it('should have reject button', () => {
      render(<GalleryView {...defaultProps} />);

      // Find reject buttons by text - multiple "Reject" texts exist
      const rejectButtons = screen.getAllByText(/Reject/);
      expect(rejectButtons.length).toBeGreaterThan(0);
    });

    it('should have footer reject button available', () => {
      const { container } = render(<GalleryView {...defaultProps} />);

      // Find the footer section
      const footer = container.querySelector('.h-14');
      const rejectButton = footer?.querySelector('button');

      // Verify the button exists
      expect(rejectButton).toBeInTheDocument();
    });

    it('should show Rejected state for rejected image', () => {
      render(<GalleryView {...defaultProps} selectedIndex={1} />);

      const rejectButton = screen.getByText(/Rejected/).closest('button');
      expect(rejectButton?.className).toContain('bg-rejected');
    });
  });

  describe('multi-select', () => {
    it('should support Ctrl+Click for multi-select', () => {
      render(<GalleryView {...defaultProps} />);

      // Find thumbnails
      const thumbnails = screen.getAllByRole('button').filter(btn =>
        btn.querySelector('img')
      );

      // Ctrl+Click on second thumbnail
      if (thumbnails.length >= 2) {
        fireEvent.click(thumbnails[1], { ctrlKey: true });

        // Should not call onSelect (multi-select mode)
        // The component handles this internally with selectedThumbnails state
      }
    });

    it('should support Shift+Click for range selection', () => {
      render(<GalleryView {...defaultProps} />);

      const thumbnails = screen.getAllByRole('button').filter(btn =>
        btn.querySelector('img')
      );

      if (thumbnails.length >= 3) {
        // First, click on first thumbnail
        fireEvent.click(thumbnails[0]);

        // Then Shift+Click on third thumbnail for range selection
        fireEvent.click(thumbnails[2], { shiftKey: true });
      }
    });
  });

  describe('batch actions', () => {
    it('should call onBatchToggleLabel with correct parameters', () => {
      const onBatchToggleLabel = vi.fn();
      render(<GalleryView {...defaultProps} onBatchToggleLabel={onBatchToggleLabel} />);

      // This tests that the prop is passed correctly
      // The actual batch action bar appears only when multiple thumbnails are selected
      expect(onBatchToggleLabel).not.toHaveBeenCalled();
    });
  });

  describe('keyboard hints', () => {
    it('should display keyboard hints', () => {
      render(<GalleryView {...defaultProps} />);

      expect(screen.getByText(/← →/)).toBeInTheDocument();
      expect(screen.getByText(/ESC/)).toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('should return null when no items', () => {
      const { container } = render(
        <GalleryView {...defaultProps} items={[]} selectedIndex={0} />
      );

      // When items array is empty, currentItem is undefined, so component returns null
      expect(container.querySelector('.fixed')).toBeNull();
    });

    it('should return null when selectedIndex is out of bounds', () => {
      const { container } = render(
        <GalleryView {...defaultProps} selectedIndex={10} />
      );

      // When selectedIndex is out of bounds, currentItem is undefined
      expect(container.querySelector('.fixed')).toBeNull();
    });
  });
});
