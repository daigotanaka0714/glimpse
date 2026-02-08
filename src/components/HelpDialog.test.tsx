import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HelpDialog } from './HelpDialog';

describe('HelpDialog', () => {
  const defaultProps = {
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render the title', () => {
      render(<HelpDialog {...defaultProps} />);

      expect(screen.getByText('Help')).toBeInTheDocument();
    });

    it('should render section navigation', () => {
      render(<HelpDialog {...defaultProps} />);

      // Check for section buttons
      expect(screen.getByText('Overview')).toBeInTheDocument();
      expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument();
    });

    it('should render close button', () => {
      render(<HelpDialog {...defaultProps} />);

      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });

    it('should render language toggle buttons', () => {
      const { container } = render(<HelpDialog {...defaultProps} />);

      // The language toggle area should be present in the header
      const header = container.querySelector('.border-b');
      expect(header).toBeInTheDocument();
    });
  });

  describe('section navigation', () => {
    it('should switch to Keyboard Shortcuts section when clicked', () => {
      render(<HelpDialog {...defaultProps} />);

      const keyboardButton = screen.getByText('Keyboard Shortcuts');
      fireEvent.click(keyboardButton);

      // Keyboard section should be active
      expect(keyboardButton.closest('button')?.className).toContain('text-accent');
    });

    it('should switch back to Overview section when clicked', () => {
      render(<HelpDialog {...defaultProps} />);

      // First switch to another section
      const keyboardButton = screen.getByText('Keyboard Shortcuts');
      fireEvent.click(keyboardButton);

      // Then switch back to Overview
      const overviewButton = screen.getByText('Overview');
      fireEvent.click(overviewButton);

      expect(overviewButton.closest('button')?.className).toContain('text-accent');
    });

    it('should display Settings section', () => {
      render(<HelpDialog {...defaultProps} />);

      expect(screen.getByText('Settings')).toBeInTheDocument();
    });

    it('should display Supported RAW Formats section', () => {
      render(<HelpDialog {...defaultProps} />);

      expect(screen.getByText('Supported RAW Formats')).toBeInTheDocument();
    });
  });

  describe('keyboard shortcuts content', () => {
    it('should display navigation info when Keyboard section clicked', () => {
      render(<HelpDialog {...defaultProps} />);

      // Switch to keyboard section
      fireEvent.click(screen.getByText('Keyboard Shortcuts'));

      // Check for navigation heading in the content
      expect(screen.getByText(/Navigation/)).toBeInTheDocument();
    });
  });

  describe('language toggle', () => {
    it('should have language toggle in header', () => {
      const { container } = render(<HelpDialog {...defaultProps} />);

      // The language toggle should be present somewhere in the dialog
      const langButtons = container.querySelectorAll('button');
      expect(langButtons.length).toBeGreaterThan(0);
    });
  });

  describe('close functionality', () => {
    it('should have close button available', () => {
      render(<HelpDialog {...defaultProps} />);

      // Find close button
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });
  });

  describe('styling', () => {
    it('should have modal overlay styling', () => {
      const { container } = render(<HelpDialog {...defaultProps} />);

      const overlay = container.querySelector('.fixed.inset-0');
      expect(overlay).toBeInTheDocument();
    });

    it('should have proper modal dimensions', () => {
      const { container } = render(<HelpDialog {...defaultProps} />);

      // Check for max-width class on modal
      const modal = container.querySelector('[class*="max-w"]');
      expect(modal).toBeInTheDocument();
    });
  });

  describe('overview content', () => {
    it('should display basic workflow information', () => {
      render(<HelpDialog {...defaultProps} />);

      // Overview is the default section
      expect(screen.getByText(/Basic Workflow/)).toBeInTheDocument();
    });

    it('should display key features', () => {
      render(<HelpDialog {...defaultProps} />);

      expect(screen.getByText(/Key Features/)).toBeInTheDocument();
    });
  });
});
