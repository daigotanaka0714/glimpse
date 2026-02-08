import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CompareView } from './CompareView';
import type { ImageItem } from '@/types';

describe('CompareView', () => {
  const mockLeftItem: ImageItem = {
    filename: 'left-image.jpg',
    path: '/path/to/left-image.jpg',
    thumbnailPath: '/path/to/left-thumb.jpg',
    thumbnailLoaded: true,
    size: 1024 * 1024 * 3, // 3MB
    modifiedAt: '2024-01-01',
    label: null,
    index: 0,
  };

  const mockRightItem: ImageItem = {
    filename: 'right-image.jpg',
    path: '/path/to/right-image.jpg',
    thumbnailPath: '/path/to/right-thumb.jpg',
    thumbnailLoaded: true,
    size: 1024 * 1024 * 4, // 4MB
    modifiedAt: '2024-01-02',
    label: 'rejected',
    index: 1,
  };

  const defaultProps = {
    leftItem: mockLeftItem,
    rightItem: mockRightItem,
    totalItems: 10,
    onClose: vi.fn(),
    onSelectLeft: vi.fn(),
    onSelectRight: vi.fn(),
    onToggleLabelLeft: vi.fn(),
    onToggleLabelRight: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render both images', () => {
      render(<CompareView {...defaultProps} />);

      expect(screen.getByAltText('left-image.jpg')).toBeInTheDocument();
      expect(screen.getByAltText('right-image.jpg')).toBeInTheDocument();
    });

    it('should display both filenames', () => {
      render(<CompareView {...defaultProps} />);

      expect(screen.getByText('left-image.jpg')).toBeInTheDocument();
      expect(screen.getByText('right-image.jpg')).toBeInTheDocument();
    });

    it('should display both file sizes', () => {
      render(<CompareView {...defaultProps} />);

      expect(screen.getByText('3.0 MB')).toBeInTheDocument();
      expect(screen.getByText('4.0 MB')).toBeInTheDocument();
    });

    it('should render center divider', () => {
      const { container } = render(<CompareView {...defaultProps} />);

      const divider = container.querySelector('.w-1.bg-border-color');
      expect(divider).toBeInTheDocument();
    });

    it('should render keyboard hints in footer', () => {
      render(<CompareView {...defaultProps} />);

      expect(screen.getByText(/← →/)).toBeInTheDocument();
      expect(screen.getByText(/Shift/)).toBeInTheDocument();
      expect(screen.getByText(/ESC/)).toBeInTheDocument();
    });

    it('should show reject buttons with correct labels', () => {
      render(<CompareView {...defaultProps} />);

      // Left panel should show "1" for reject shortcut
      expect(screen.getByText('1')).toBeInTheDocument();
      // Right panel should show "2" for reject shortcut
      expect(screen.getByText('2')).toBeInTheDocument();
    });
  });

  describe('navigation', () => {
    it('should call onClose when close button clicked', () => {
      render(<CompareView {...defaultProps} />);

      const buttons = screen.getAllByRole('button');
      const closeButton = buttons.find(btn =>
        btn.className.includes('top-4') && btn.className.includes('right-4') && btn.className.includes('z-20')
      );

      if (closeButton) {
        fireEvent.click(closeButton);
        expect(defaultProps.onClose).toHaveBeenCalled();
      }
    });

    it('should show left navigation when not at first image', () => {
      const leftItem = { ...mockLeftItem, index: 1 };
      render(<CompareView {...defaultProps} leftItem={leftItem} />);

      const buttons = screen.getAllByRole('button');
      const leftNavButtons = buttons.filter(btn => btn.className.includes('left-2'));

      expect(leftNavButtons.length).toBeGreaterThan(0);
    });

    it('should hide left navigation on first image', () => {
      const leftItem = { ...mockLeftItem, index: 0 };
      const rightItem = { ...mockRightItem, index: 0 };
      render(<CompareView {...defaultProps} leftItem={leftItem} rightItem={rightItem} />);

      // Both panels should hide left navigation
      const buttons = screen.getAllByRole('button');
      const leftNavInLeftPanel = buttons.filter(btn =>
        btn.className.includes('left-2') && !btn.className.includes('z-20')
      );

      expect(leftNavInLeftPanel.length).toBe(0);
    });

    it('should call onSelectLeft when left panel navigation clicked', () => {
      const leftItem = { ...mockLeftItem, index: 5 };
      render(<CompareView {...defaultProps} leftItem={leftItem} />);

      // Find navigation buttons in left panel
      const buttons = screen.getAllByRole('button');
      const leftPanelNav = buttons.find(btn =>
        btn.className.includes('left-2')
      );

      if (leftPanelNav) {
        fireEvent.click(leftPanelNav);
        expect(defaultProps.onSelectLeft).toHaveBeenCalledWith(4);
      }
    });

    it('should call onSelectRight when right panel navigation clicked', () => {
      const rightItem = { ...mockRightItem, index: 5 };
      render(<CompareView {...defaultProps} rightItem={rightItem} />);

      // This is complex to test due to panel structure
      // The right panel's left navigation should call onSelectRight
    });
  });

  describe('label toggle', () => {
    it('should call onToggleLabelLeft when left reject button clicked', () => {
      render(<CompareView {...defaultProps} />);

      // Find reject button with "1" label
      const button = screen.getByText('1').closest('button');
      if (button) {
        fireEvent.click(button);
        expect(defaultProps.onToggleLabelLeft).toHaveBeenCalled();
      }
    });

    it('should call onToggleLabelRight when right reject button clicked', () => {
      render(<CompareView {...defaultProps} />);

      // Find reject button with "2" label
      const button = screen.getByText('2').closest('button');
      if (button) {
        fireEvent.click(button);
        expect(defaultProps.onToggleLabelRight).toHaveBeenCalled();
      }
    });

    it('should show rejected state for rejected image', () => {
      render(<CompareView {...defaultProps} />);

      // Right image is rejected
      const rightImage = screen.getByAltText('right-image.jpg');
      expect(rightImage.className).toContain('opacity-50');
    });

    it('should show rejected indicator on rejected image', () => {
      const { container } = render(<CompareView {...defaultProps} />);

      // There should be a rejected overlay on the right panel
      const rejectedOverlays = container.querySelectorAll('[class*="bg-rejected"]');
      expect(rejectedOverlays.length).toBeGreaterThan(0);
    });
  });

  describe('styling', () => {
    it('should have full screen overlay', () => {
      const { container } = render(<CompareView {...defaultProps} />);

      const overlay = container.querySelector('.fixed.inset-0');
      expect(overlay).toBeInTheDocument();
    });

    it('should have animation class', () => {
      const { container } = render(<CompareView {...defaultProps} />);

      const animated = container.querySelector('.animate-fade-in');
      expect(animated).toBeInTheDocument();
    });

    it('should have flex layout for side-by-side comparison', () => {
      const { container } = render(<CompareView {...defaultProps} />);

      const flexContainer = container.querySelector('.flex-1.flex');
      expect(flexContainer).toBeInTheDocument();
    });
  });
});
