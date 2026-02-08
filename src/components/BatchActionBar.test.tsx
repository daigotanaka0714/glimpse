import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BatchActionBar } from './BatchActionBar';

describe('BatchActionBar', () => {
  const defaultProps = {
    selectedCount: 5,
    filteredCount: 100,
    filterMode: 'all' as const,
    onMarkRejected: vi.fn(),
    onRemoveRejected: vi.fn(),
    onMarkAllRejected: vi.fn(),
    onRemoveAllRejected: vi.fn(),
    onClearSelection: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('visibility', () => {
    it('should not render when selectedCount is 0', () => {
      const { container } = render(
        <BatchActionBar {...defaultProps} selectedCount={0} />
      );

      expect(container.firstChild).toBeNull();
    });

    it('should not render when selectedCount is 1', () => {
      const { container } = render(
        <BatchActionBar {...defaultProps} selectedCount={1} />
      );

      expect(container.firstChild).toBeNull();
    });

    it('should render when selectedCount is 2 or more', () => {
      render(<BatchActionBar {...defaultProps} selectedCount={2} />);

      expect(screen.getByText(/2/)).toBeInTheDocument();
    });
  });

  describe('rendering', () => {
    it('should display selected count', () => {
      render(<BatchActionBar {...defaultProps} />);

      // The text "5 selected" is combined
      expect(screen.getByText(/5.*selected/)).toBeInTheDocument();
    });

    it('should display filter mode and count', () => {
      render(<BatchActionBar {...defaultProps} />);

      expect(screen.getByText(/All/)).toBeInTheDocument();
      expect(screen.getByText(/100/)).toBeInTheDocument();
    });

    it('should display adopted filter mode', () => {
      render(<BatchActionBar {...defaultProps} filterMode="adopted" />);

      // There are multiple "Adopted" texts, just verify at least one exists
      const adoptedTexts = screen.getAllByText(/Adopted/);
      expect(adoptedTexts.length).toBeGreaterThan(0);
    });

    it('should display rejected filter mode', () => {
      render(<BatchActionBar {...defaultProps} filterMode="rejected" />);

      // There will be multiple "Rejected" texts, check that at least one exists
      const rejectedTexts = screen.getAllByText(/Rejected/);
      expect(rejectedTexts.length).toBeGreaterThan(0);
    });

    it('should render Mark Rejected button', () => {
      render(<BatchActionBar {...defaultProps} />);

      expect(screen.getByText('Mark Rejected')).toBeInTheDocument();
    });

    it('should render Mark Adopted button', () => {
      render(<BatchActionBar {...defaultProps} />);

      expect(screen.getByText('Mark Adopted')).toBeInTheDocument();
    });

    it('should render Batch Reject button', () => {
      render(<BatchActionBar {...defaultProps} />);

      expect(screen.getByText('Batch Reject')).toBeInTheDocument();
    });

    it('should render Batch Clear button', () => {
      render(<BatchActionBar {...defaultProps} />);

      expect(screen.getByText('Batch Clear')).toBeInTheDocument();
    });

    it('should render Clear button', () => {
      render(<BatchActionBar {...defaultProps} />);

      expect(screen.getByText('Clear')).toBeInTheDocument();
    });

    it('should render keyboard hints', () => {
      render(<BatchActionBar {...defaultProps} />);

      expect(screen.getByText(/Esc/)).toBeInTheDocument();
      expect(screen.getByText(/1:/)).toBeInTheDocument();
    });
  });

  describe('interactions', () => {
    it('should call onMarkRejected when Mark Rejected clicked', () => {
      render(<BatchActionBar {...defaultProps} />);

      const button = screen.getByText('Mark Rejected').closest('button');
      if (button) {
        fireEvent.click(button);
        expect(defaultProps.onMarkRejected).toHaveBeenCalledTimes(1);
      }
    });

    it('should call onRemoveRejected when Mark Adopted clicked', () => {
      render(<BatchActionBar {...defaultProps} />);

      const button = screen.getByText('Mark Adopted').closest('button');
      if (button) {
        fireEvent.click(button);
        expect(defaultProps.onRemoveRejected).toHaveBeenCalledTimes(1);
      }
    });

    it('should call onMarkAllRejected when Batch Reject clicked', () => {
      render(<BatchActionBar {...defaultProps} />);

      const button = screen.getByText('Batch Reject').closest('button');
      if (button) {
        fireEvent.click(button);
        expect(defaultProps.onMarkAllRejected).toHaveBeenCalledTimes(1);
      }
    });

    it('should call onRemoveAllRejected when Batch Clear clicked', () => {
      render(<BatchActionBar {...defaultProps} />);

      const button = screen.getByText('Batch Clear').closest('button');
      if (button) {
        fireEvent.click(button);
        expect(defaultProps.onRemoveAllRejected).toHaveBeenCalledTimes(1);
      }
    });

    it('should call onClearSelection when Clear clicked', () => {
      render(<BatchActionBar {...defaultProps} />);

      const button = screen.getByText('Clear').closest('button');
      if (button) {
        fireEvent.click(button);
        expect(defaultProps.onClearSelection).toHaveBeenCalledTimes(1);
      }
    });
  });

  describe('styling', () => {
    it('should have animation class', () => {
      const { container } = render(<BatchActionBar {...defaultProps} />);

      const animatedElement = container.querySelector('.animate-slide-up');
      expect(animatedElement).toBeInTheDocument();
    });

    it('should have accent styling for selection badge', () => {
      const { container } = render(<BatchActionBar {...defaultProps} />);

      // Check for accent styling in the badge container
      const badge = container.querySelector('[class*="bg-accent"]');
      expect(badge).toBeInTheDocument();
    });
  });
});
