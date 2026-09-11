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
pnpm lint               # Run Biome (format + lint)
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
- `open_folder` - Scan folder and generate thumbnails/previews
- `set_label` - Mark image as rejected/adopted
- `export_adopted` - Export selected images
- `get_exif` - Extract EXIF metadata

Other modules:
- `image_processor.rs` - Thumbnail/preview generation, EXIF extraction
- `database.rs` - SQLite operations

### RAW Image Processing

RAW files (NEF, ARW, CR2, CR3, RAF, ORF, RW2, PEF, DNG, SRW) are processed using:
- **`rawloader`** - Pure Rust RAW file decoder supporting major camera manufacturers (Nikon, Canon, Sony, Fujifilm, Olympus, Panasonic, Pentax, Samsung)
- **`imagepipe`** - RAW data processing pipeline (demosaicing, color conversion to sRGB)

These are the best available pure-Rust libraries for RAW processing. Alternative options:
- **`libraw-rs`** - Rust bindings for LibRAW (C++), supports more formats but adds native dependencies

**Important**: Web browsers cannot natively decode RAW files. The backend generates:
- Thumbnails (300x300 JPEG) for grid view
- Previews (2000x2000 JPEG) for detail view of RAW files

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
- **Frontend**: TypeScript check, Biome, Vitest
- **Backend**: cargo fmt, cargo clippy (fail on warnings), cargo test

Releases are triggered by version tags (e.g., `v0.2.0`) and build for macOS ARM64/x64 and Windows x64.

## コミュニケーション基準

### 事実と推測の区別
技術的な事実を述べる際は厳守：
- **確認済み**: コードやドキュメントで直接確認 → そのまま述べてよい
- **推測**: ログやコンテキストから推測 → 「推測ですが...」と明記
- **未確認**: 確認手段がない → 「未確認ですが...」と明記

**禁止**: 推測を確定事実として提示すること

### 外部サービス連携時のルール
1. **接続確認を最初に行う**
2. **失敗は即時報告**
3. **サイレント失敗の禁止**

### タスク進行ルール
- 1ステップずつ進め、各ステップの完了を確認
- 複数ステップのタスクでは中間結果を報告
- ブロッカーは推測で進めずユーザーに相談
- セッション終了前に進捗と残作業を明示

### カスタムコマンド
- `/bugfix` - 体系的なバグ調査・修正ワークフロー
- `/investigate` - コードベースの網羅的調査

## このリポジトリ固有のこと

### 警告について

Biome の指摘は現状ゼロ。`pnpm lint`（= `biome check --error-on-warnings .`）は
警告が 1 件でも出た時点で失敗する。CI・`bin/agent-check`・worktree のマージ前フック
（`.config/wt.toml`）はいずれもこの同じコマンドを叩くため、**新しい警告を残すとマージできない。**

ESLint 時代は `AGENT_CHECK_MAX_WARNINGS` によるラチェットで頭打ちにしていたが、
Biome 移行で指摘がゼロになったため、ラチェットは廃止した。

### 失敗したとき

出力の `FAILED_STAGE` のエラーだけを直し、`bin/agent-check` を再実行する。
フロントエンドのみの変更を反復する間は `--quick`（Rust をスキップ）を使ってよい。

<!-- daigo-lab-ops:completion-criteria:start -->
<!-- 自動生成。daigo-lab-ops/docs/completion-criteria.md が唯一の出どころ。
     ここを手で編集しない。`lab sync` で作り直す。 -->

## エージェントの完了条件

### Definition of done

1. This repository's `bin/agent-check` returns `STATUS: PASS`
2. The change stays within what was asked for
3. The PR is opened from a branch other than main / master

### Do not

- **Never push directly to the default branch.** Always branch and open a PR.
- **Never merge.** `git merge` and `gh pr merge` are a human's job.
- **Never edit the gate to make it pass.** If the gate needs to be relaxed,
  propose that as its own PR and explain why.
- **Never silence a lint rule to get green.** Fix what it reports.

### When opening a PR

- Do not put a Claude session URL (`claude.ai/code/session_...`) or a
  `Claude-Session:` line in the PR body or in any commit message
- **Always name the repository and include the URL when referring to a PR.**
  `#24` alone does not identify anything when several repositories are in play
- Never use `--delete-branch` on a stacked PR: deleting the base branch makes
  GitHub auto-close the PR stacked on top of it

<!-- daigo-lab-ops:completion-criteria:end -->
