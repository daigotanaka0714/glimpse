import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBar } from './StatusBar';
import type { ImageItem } from '@/types';

describe('StatusBar', () => {
  const mockItem: ImageItem = {
    filename: 'DSC_0001.NEF',
    path: '/photos/DSC_0001.NEF',
    size: 20 * 1024 * 1024,
    modifiedAt: '2024/12/15 14:32',
    thumbnailPath: '/cache/thumbnails/DSC_0001.jpg',
    thumbnailLoaded: true,
    label: null,
    index: 0,
  };

  it('should show keyboard shortcuts when no item selected', () => {
    render(
      <StatusBar
        selectedItem={null}
        selectedIndex={0}
        totalItems={0}
      />
    );

    // i18n mock returns English text
    expect(screen.getByText(/Navigate/)).toBeInTheDocument();
    expect(screen.getByText(/Multi-select/)).toBeInTheDocument();
  });

  it('should display selected item filename', () => {
    render(
      <StatusBar
        selectedItem={mockItem}
        selectedIndex={0}
        totalItems={10}
      />
    );

    expect(screen.getByText('DSC_0001.NEF')).toBeInTheDocument();
  });

  it('should display file size in MB', () => {
    render(
      <StatusBar
        selectedItem={mockItem}
        selectedIndex={0}
        totalItems={10}
      />
    );

    expect(screen.getByText('20.0 MB')).toBeInTheDocument();
  });

  it('should display modified date', () => {
    render(
      <StatusBar
        selectedItem={mockItem}
        selectedIndex={0}
        totalItems={10}
      />
    );

    expect(screen.getByText('2024/12/15 14:32')).toBeInTheDocument();
  });

  it('should display position info', () => {
    render(
      <StatusBar
        selectedItem={mockItem}
        selectedIndex={4}
        totalItems={10}
      />
    );

    expect(screen.getByText('5 / 10')).toBeInTheDocument();
  });

  it('should show rejected label when item is rejected', () => {
    const rejectedItem = { ...mockItem, label: 'rejected' as const };
    render(
      <StatusBar
        selectedItem={rejectedItem}
        selectedIndex={0}
        totalItems={10}
      />
    );

    // i18n mock returns 'Rejected' in English
    expect(screen.getByText('Rejected')).toBeInTheDocument();
  });

  it('should show multi-select count when selectedCount > 1', () => {
    render(
      <StatusBar
        selectedItem={mockItem}
        selectedIndex={0}
        totalItems={10}
        selectedCount={5}
      />
    );

    // i18n mock returns 'selected' in English
    expect(screen.getByText(/5.*selected/)).toBeInTheDocument();
  });

  it('should not show multi-select count when selectedCount is 0 or 1', () => {
    const { rerender } = render(
      <StatusBar
        selectedItem={mockItem}
        selectedIndex={0}
        totalItems={10}
        selectedCount={0}
      />
    );

    expect(screen.queryByText(/selected/)).not.toBeInTheDocument();

    rerender(
      <StatusBar
        selectedItem={mockItem}
        selectedIndex={0}
        totalItems={10}
        selectedCount={1}
      />
    );

    expect(screen.queryByText(/selected/)).not.toBeInTheDocument();
  });
});
