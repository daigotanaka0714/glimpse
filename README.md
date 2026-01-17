# Glimpse - High-Speed Photo Checker

[日本語](./README.ja.md)

A fast, lightweight desktop application specialized for selecting stage photography. Designed to browse and select thousands to tens of thousands of large images (NEF/JPEG) without stress.

## Features

- **Blazing Fast** - Browse thousands to tens of thousands of images without stress
- **NEF Support** - Native support for Nikon RAW files
- **Keyboard-Driven** - Quick selection using arrow keys and label keys
- **Pause & Resume** - Safely pause and resume your work anytime
- **Lightweight** - Low memory consumption with Tauri + Rust

## Feature List

### Core Features
- Folder selection and image list retrieval
- Background thumbnail generation (multi-threaded)
- Thumbnail caching
- Virtual scrolling for large image collections
- Keyboard navigation (arrow keys)
- Rejection labeling (press `1`)
- Detail view mode (Enter/Space)
- Session persistence (pause & resume)
- Export selected (non-rejected) files to another folder

### Advanced Features
- Adjustable thumbnail size (slider)
- Filtering (rejected only / adopted only)
- Multi-select (Ctrl/Cmd+Click, Shift+Click)
- Drag & drop folder loading
- Dark mode / Light mode toggle
- EXIF information display
- Image rotation
- Comparison mode (side-by-side view)
- Export settings (copy / move option)

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `←` | Select previous image |
| `→` | Select next image |
| `↑` | Select image above |
| `↓` | Select image below |
| `1` | Toggle rejection label |
| `Enter` / `Space` | Enter detail view |
| `Esc` | Exit detail view |
| `C` | Enter comparison mode |
| `Ctrl+O` | Open folder |
| `Ctrl+E` | Export |
| `Home` | Go to first image |
| `End` | Go to last image |
| `PageUp` | Page up |
| `PageDown` | Page down |

## System Requirements

### Windows
- Windows 10/11 64bit
- WebView2 Runtime (included by default in Windows 11)

### macOS
- macOS 10.15 (Catalina) or later

## Installation

### Download

Download the latest release from the [Releases](https://github.com/daigotanaka0714/glimpse/releases) page.

- **macOS**: `Glimpse_x.x.x_aarch64.dmg` (Apple Silicon) or `Glimpse_x.x.x_x64.dmg` (Intel)
- **Windows**: `Glimpse_x.x.x_x64-setup.exe`

### Build from Source

#### Prerequisites

- [Node.js](https://nodejs.org/) 20.x or later
- [pnpm](https://pnpm.io/) 9.x or later
- [Rust](https://www.rust-lang.org/) (latest stable)

#### Steps

```bash
# Clone the repository
git clone https://github.com/daigotanaka0714/glimpse.git
cd glimpse

# Install dependencies
pnpm install

# Run in development mode
pnpm tauri dev

# Build for production
pnpm tauri build
```

## Usage

1. Launch the app
2. Click "Open Folder" button or press `Ctrl+O` to select a photo folder (or drag & drop a folder)
3. Once thumbnails are displayed, navigate with arrow keys
4. Press `1` to mark as rejected
5. Press `Enter` or `Space` for detail view
6. When finished, press `Ctrl+E` to export

## Tech Stack

| Layer | Technology | Reason |
|-------|------------|--------|
| Framework | Tauri 2.0 | Lightweight, Rust backend, cross-platform |
| Frontend | React 18 + TypeScript | Virtual scrolling, easy state management |
| Styling | Tailwind CSS | Fast development, consistent design |
| Image Processing | Rust (image, rawloader) | Multi-threaded, NEF support |
| Data Persistence | SQLite (rusqlite) | Session management, cache management |
| Virtual Scrolling | @tanstack/react-virtual | Efficient rendering of large lists |

## Performance Goals

| Metric | Target |
|--------|--------|
| Initial load (5000 images) | < 3 seconds to start displaying |
| Thumbnail generation speed | > 100 images/second |
| Subsequent loads | < 1 second |
| Detail view switch | < 200ms |
| Key input response | < 50ms |
| Memory usage (10000 images) | < 500MB |

## License

MIT License

## Contributing

Pull requests are welcome!
