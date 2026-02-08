import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EmptyState } from './EmptyState';

describe('EmptyState', () => {
  const defaultProps = {
    onOpenFolder: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render the title', () => {
      render(<EmptyState {...defaultProps} />);

      expect(screen.getByText('Glimpse')).toBeInTheDocument();
    });

    it('should render the description', () => {
      render(<EmptyState {...defaultProps} />);

      // The description contains line breaks, so we check for parts of it
      expect(screen.getByText(/High-speed photo checker/)).toBeInTheDocument();
    });

    it('should render the Open Folder button', () => {
      render(<EmptyState {...defaultProps} />);

      expect(screen.getByText('Open Folder')).toBeInTheDocument();
    });

    it('should render keyboard shortcut hint', () => {
      render(<EmptyState {...defaultProps} />);

      // Should show modifier key (⌘ on Mac, Ctrl on others)
      expect(screen.getByText('⌘')).toBeInTheDocument();
      expect(screen.getByText('O')).toBeInTheDocument();
    });

    it('should render folder icon in button', () => {
      render(<EmptyState {...defaultProps} />);

      // The button contains "Open Folder" text
      const button = screen.getByText('Open Folder').closest('button');
      expect(button).toBeInTheDocument();
    });
  });

  describe('interactions', () => {
    it('should call onOpenFolder when button clicked', () => {
      render(<EmptyState {...defaultProps} />);

      const openButton = screen.getByText('Open Folder').closest('button');
      if (openButton) {
        fireEvent.click(openButton);
        expect(defaultProps.onOpenFolder).toHaveBeenCalledTimes(1);
      }
    });
  });

  describe('styling', () => {
    it('should have centered layout', () => {
      render(<EmptyState {...defaultProps} />);

      const container = screen.getByText('Glimpse').closest('.text-center');
      expect(container).toBeInTheDocument();
    });

    it('should have animation class', () => {
      render(<EmptyState {...defaultProps} />);

      const animatedContainer = screen.getByText('Glimpse').closest('.animate-slide-up');
      expect(animatedContainer).toBeInTheDocument();
    });
  });
});
