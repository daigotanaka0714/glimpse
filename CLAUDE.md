# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Glimpse is a high-speed desktop application for selecting and reviewing stage photography. Built with Tauri 2.0 (Rust backend + React frontend), it handles thousands of large images including RAW formats (NEF, ARW, CR2, CR3, RAF, ORF, RW2, PEF, DNG, SRW).

## Common Commands

```bash
# Development
pnpm tauri dev          # Run app in development mode (frontend + backend)
pnpm dev                # Frontend dev server only (port 1420)

# Building
pnpm build              # Build frontend (TypeScript + Vite)
pnpm tauri build        # Full production build for current platform

# Testing
pnpm test:run           # Run all tests once
pnpm test               # Run tests in watch mode
pnpm test:coverage      # Generate coverage report

# Linting
pnpm lint               # Run ESLint
pnpm lint:fix           # Auto-fix linting issues

# Rust-specific (from src-tauri/)
cargo fmt               # Format Rust code
cargo clippy            # Lint Rust code
cargo test              # Run Rust tests
```

## Architecture

### Frontend (src/)
- **React 18 + TypeScript** with Tailwind CSS
- **Virtual scrolling** via @tanstack/react-virtual for 10K+ images
- **State management**: React hooks (useState, useRef, useCallback)
- Path alias: `@/` maps to `src/`

Key components:
- `App.tsx` - Root component with app-level state
- `ThumbnailGrid.tsx` - Virtual scrolling grid
- `DetailView.tsx` - Full-screen image viewer
- `CompareView.tsx` - Side-by-side comparison

Custom hooks in `src/hooks/`:
- `useKeyboardNavigation` - Keyboard shortcuts (arrow keys, number keys, Enter, Esc, C, ?)
- `useGridConfig` - Responsive grid layout
- `useDragAndDrop` - Folder drag-and-drop

### Backend (src-tauri/)
- **Rust** with image processing via `image`, `rawloader`, `imagepipe` crates
- **SQLite** for session/label/cache persistence

Key Tauri commands in `commands.rs`:
- `open_folder` - Scan folder and generate thumbnails
- `set_label` - Mark image as rejected/adopted
- `export_adopted` - Export selected images
- `get_exif` - Extract EXIF metadata

Other modules:
- `image_processor.rs` - Thumbnail generation, EXIF extraction
- `database.rs` - SQLite operations

### Data Flow
```
Frontend → Tauri IPC (invoke) → Rust Command → Image Processor/Database → Result → Frontend State
```

### Database Schema
Three SQLite tables: `sessions` (folder tracking), `labels` (rejection marks), `thumbnail_cache` (cache metadata).

Storage location:
- macOS: `~/Library/Application Support/Glimpse/`
- Windows: `%APPDATA%/Glimpse/`

## Testing

Tests use **Vitest** with jsdom environment. Test files are colocated with source (`*.test.tsx`, `*.test.ts`).

The test setup (`src/test/setup.ts`) mocks:
- Tauri APIs (@tauri-apps/api/core, @tauri-apps/api/event, dialog plugin)
- Browser APIs (matchMedia, ResizeObserver)

Run a single test file:
```bash
pnpm vitest run src/components/ThumbnailItem.test.tsx
```

## CI/CD

GitHub Actions run on PR/push to main:
- **Frontend**: TypeScript check, ESLint, Vitest
- **Backend**: cargo fmt, cargo clippy (fail on warnings), cargo test

Releases are triggered by version tags (e.g., `v0.2.0`) and build for macOS ARM64/x64 and Windows x64.
