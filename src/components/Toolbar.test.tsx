import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Toolbar } from './Toolbar';
import type { FilterMode, ThemeMode } from '@/types';

describe('Toolbar', () => {
  const defaultProps = {
    thumbnailSize: 180,
    minSize: 100,
    maxSize: 300,
    onThumbnailSizeChange: vi.fn(),
    filterMode: 'all' as FilterMode,
    onFilterModeChange: vi.fn(),
    theme: 'dark' as ThemeMode,
    onThemeChange: vi.fn(),
    counts: {
      all: 100,
      adopted: 80,
      rejected: 20,
    },
  };

  it('should render thumbnail size slider', () => {
    render(<Toolbar {...defaultProps} />);

    const slider = screen.getByRole('slider');
    expect(slider).toBeInTheDocument();
    expect(slider).toHaveValue('180');
  });

  it('should call onThumbnailSizeChange when slider changes', () => {
    const handleChange = vi.fn();
    render(<Toolbar {...defaultProps} onThumbnailSizeChange={handleChange} />);

    const slider = screen.getByRole('slider');
    fireEvent.change(slider, { target: { value: '200' } });

    expect(handleChange).toHaveBeenCalledWith(200);
  });

  it('should render filter buttons with counts', () => {
    render(<Toolbar {...defaultProps} />);

    expect(screen.getByText('すべて')).toBeInTheDocument();
    expect(screen.getByText('(100)')).toBeInTheDocument();
    expect(screen.getByText('採用')).toBeInTheDocument();
    expect(screen.getByText('(80)')).toBeInTheDocument();
    expect(screen.getByText('不採用')).toBeInTheDocument();
    expect(screen.getByText('(20)')).toBeInTheDocument();
  });

  it('should highlight active filter button', () => {
    render(<Toolbar {...defaultProps} filterMode="rejected" />);

    const rejectedButton = screen.getByText('不採用').closest('button');
    expect(rejectedButton?.className).toContain('bg-accent');
  });

  it('should call onFilterModeChange when filter button clicked', () => {
    const handleChange = vi.fn();
    render(<Toolbar {...defaultProps} onFilterModeChange={handleChange} />);

    const adoptedButton = screen.getByText('採用').closest('button');
    if (adoptedButton) {
      fireEvent.click(adoptedButton);
      expect(handleChange).toHaveBeenCalledWith('adopted');
    }
  });

  it('should render theme toggle button', () => {
    render(<Toolbar {...defaultProps} />);

    const themeButton = screen.getByLabelText(/テーマ切り替え/);
    expect(themeButton).toBeInTheDocument();
  });

  it('should call onThemeChange when theme button clicked', () => {
    const handleChange = vi.fn();
    render(<Toolbar {...defaultProps} onThemeChange={handleChange} />);

    const themeButton = screen.getByLabelText(/テーマ切り替え/);
    fireEvent.click(themeButton);

    expect(handleChange).toHaveBeenCalledWith('light');
  });

  it('should toggle to dark when current theme is light', () => {
    const handleChange = vi.fn();
    render(<Toolbar {...defaultProps} theme="light" onThemeChange={handleChange} />);

    const themeButton = screen.getByLabelText(/テーマ切り替え/);
    fireEvent.click(themeButton);

    expect(handleChange).toHaveBeenCalledWith('dark');
  });
});
