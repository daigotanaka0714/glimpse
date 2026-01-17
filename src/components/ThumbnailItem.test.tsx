import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThumbnailItem } from './ThumbnailItem';
import type { ImageItem } from '@/types';

describe('ThumbnailItem', () => {
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

  it('should render thumbnail when loaded', () => {
    render(
      <ThumbnailItem
        item={mockItem}
        size={180}
        isSelected={false}
        onClick={vi.fn()}
        onDoubleClick={vi.fn()}
      />
    );

    const img = screen.getByRole('img');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('alt', 'DSC_0001.NEF');
  });

  it('should show loading state when thumbnail not loaded', () => {
    const loadingItem = { ...mockItem, thumbnailLoaded: false };
    const { container } = render(
      <ThumbnailItem
        item={loadingItem}
        size={180}
        isSelected={false}
        onClick={vi.fn()}
        onDoubleClick={vi.fn()}
      />
    );

    expect(container.querySelector('.thumbnail-loading')).toBeInTheDocument();
  });

  it('should show rejected overlay when labeled as rejected', () => {
    const rejectedItem = { ...mockItem, label: 'rejected' as const };
    const { container } = render(
      <ThumbnailItem
        item={rejectedItem}
        size={180}
        isSelected={false}
        onClick={vi.fn()}
        onDoubleClick={vi.fn()}
      />
    );

    expect(container.querySelector('.bg-rejected\\/20')).toBeInTheDocument();
  });

  it('should show selection ring when selected', () => {
    const { container } = render(
      <ThumbnailItem
        item={mockItem}
        size={180}
        isSelected={true}
        onClick={vi.fn()}
        onDoubleClick={vi.fn()}
      />
    );

    expect(container.querySelector('.ring-accent')).toBeInTheDocument();
  });

  it('should call onClick when clicked', () => {
    const handleClick = vi.fn();
    render(
      <ThumbnailItem
        item={mockItem}
        size={180}
        isSelected={false}
        onClick={handleClick}
        onDoubleClick={vi.fn()}
      />
    );

    const element = screen.getByRole('img').parentElement;
    if (element) {
      fireEvent.click(element);
      expect(handleClick).toHaveBeenCalledTimes(1);
    }
  });

  it('should call onDoubleClick when double-clicked', () => {
    const handleDoubleClick = vi.fn();
    render(
      <ThumbnailItem
        item={mockItem}
        size={180}
        isSelected={false}
        onClick={vi.fn()}
        onDoubleClick={handleDoubleClick}
      />
    );

    const element = screen.getByRole('img').parentElement;
    if (element) {
      fireEvent.doubleClick(element);
      expect(handleDoubleClick).toHaveBeenCalledTimes(1);
    }
  });

  it('should apply correct size styles', () => {
    const { container } = render(
      <ThumbnailItem
        item={mockItem}
        size={200}
        isSelected={false}
        onClick={vi.fn()}
        onDoubleClick={vi.fn()}
      />
    );

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.style.width).toBe('200px');
    expect(wrapper.style.height).toBe('200px');
  });

  it('should show selection ring when multi-selected', () => {
    const { container } = render(
      <ThumbnailItem
        item={mockItem}
        size={180}
        isSelected={false}
        isMultiSelected={true}
        onClick={vi.fn()}
        onDoubleClick={vi.fn()}
      />
    );

    expect(container.querySelector('.ring-accent')).toBeInTheDocument();
    expect(container.querySelector('.bg-accent')).toBeInTheDocument();
  });

  it('should show checkmark icon when multi-selected', () => {
    const { container } = render(
      <ThumbnailItem
        item={mockItem}
        size={180}
        isSelected={false}
        isMultiSelected={true}
        onClick={vi.fn()}
        onDoubleClick={vi.fn()}
      />
    );

    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('should pass click event to onClick handler', () => {
    const handleClick = vi.fn();
    render(
      <ThumbnailItem
        item={mockItem}
        size={180}
        isSelected={false}
        onClick={handleClick}
        onDoubleClick={vi.fn()}
      />
    );

    const element = screen.getByRole('img').parentElement;
    if (element) {
      fireEvent.click(element, { ctrlKey: true });
      expect(handleClick).toHaveBeenCalledTimes(1);
      const callArg = handleClick.mock.calls[0][0];
      expect(callArg.ctrlKey).toBe(true);
    }
  });
});
