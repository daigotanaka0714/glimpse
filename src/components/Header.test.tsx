import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Header } from './Header';

describe('Header', () => {
  const defaultProps = {
    folderPath: null,
    totalFiles: 0,
    rejectedCount: 0,
    thumbnailProgress: {
      completed: 0,
      total: 0,
    },
    onOpenFolder: vi.fn(),
    onExport: vi.fn(),
  };

  it('should render open folder button', () => {
    render(<Header {...defaultProps} />);

    expect(screen.getByTitle('Open Folder')).toBeInTheDocument();
  });

  it('should call onOpenFolder when open folder button clicked', () => {
    const handleOpenFolder = vi.fn();
    render(<Header {...defaultProps} onOpenFolder={handleOpenFolder} />);

    fireEvent.click(screen.getByTitle('Open Folder'));

    expect(handleOpenFolder).toHaveBeenCalled();
  });

  it('should not render reload button without folder path', () => {
    render(<Header {...defaultProps} onReload={vi.fn()} />);

    expect(screen.queryByTitle('Reload')).not.toBeInTheDocument();
  });

  it('should not render reload button without onReload handler', () => {
    render(<Header {...defaultProps} folderPath="/photos" />);

    expect(screen.queryByTitle('Reload')).not.toBeInTheDocument();
  });

  it('should call onReload when reload button clicked', () => {
    const handleReload = vi.fn();
    render(<Header {...defaultProps} folderPath="/photos" onReload={handleReload} />);

    fireEvent.click(screen.getByTitle('Reload'));

    expect(handleReload).toHaveBeenCalled();
  });

  it('should disable reload button while thumbnails are generating', () => {
    render(
      <Header
        {...defaultProps}
        folderPath="/photos"
        onReload={vi.fn()}
        thumbnailProgress={{ completed: 3, total: 10 }}
      />
    );

    expect(screen.getByTitle('Reload')).toBeDisabled();
  });

  it('should render folder path', () => {
    render(<Header {...defaultProps} folderPath="/Users/test/photos" />);

    expect(screen.getByText('/Users/test/photos')).toBeInTheDocument();
  });

  it('should render thumbnail progress while generating', () => {
    render(<Header {...defaultProps} thumbnailProgress={{ completed: 3, total: 10 }} />);

    expect(screen.getByText('3/10')).toBeInTheDocument();
  });

  it('should not render thumbnail progress when generation is complete', () => {
    render(<Header {...defaultProps} thumbnailProgress={{ completed: 10, total: 10 }} />);

    expect(screen.queryByText('10/10')).not.toBeInTheDocument();
  });

  it('should render stats with adopted count derived from total and rejected', () => {
    render(<Header {...defaultProps} totalFiles={100} rejectedCount={20} />);

    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('80')).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
    expect(screen.getByTitle('Total: 100 photos')).toBeInTheDocument();
    expect(screen.getByTitle('Adopted: 80')).toBeInTheDocument();
    expect(screen.getByTitle('Rejected: 20')).toBeInTheDocument();
  });

  it('should not render stats when there are no files', () => {
    render(<Header {...defaultProps} totalFiles={0} />);

    expect(screen.queryByTitle('Total: 0 photos')).not.toBeInTheDocument();
  });

  it('should disable export button when there are no files', () => {
    render(<Header {...defaultProps} totalFiles={0} />);

    expect(screen.getByTitle('Export')).toBeDisabled();
  });

  it('should call onExport when export button clicked', () => {
    const handleExport = vi.fn();
    render(<Header {...defaultProps} totalFiles={10} onExport={handleExport} />);

    fireEvent.click(screen.getByTitle('Export'));

    expect(handleExport).toHaveBeenCalled();
  });

  it('should not render help and settings buttons without handlers', () => {
    render(<Header {...defaultProps} />);

    expect(screen.queryByTitle('Help (?)')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Settings')).not.toBeInTheDocument();
  });

  it('should call onOpenHelp when help button clicked', () => {
    const handleOpenHelp = vi.fn();
    render(<Header {...defaultProps} onOpenHelp={handleOpenHelp} />);

    fireEvent.click(screen.getByTitle('Help (?)'));

    expect(handleOpenHelp).toHaveBeenCalled();
  });

  it('should call onOpenSettings when settings button clicked', () => {
    const handleOpenSettings = vi.fn();
    render(<Header {...defaultProps} onOpenSettings={handleOpenSettings} />);

    fireEvent.click(screen.getByTitle('Settings'));

    expect(handleOpenSettings).toHaveBeenCalled();
  });
});
