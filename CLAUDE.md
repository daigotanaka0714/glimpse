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
- **Frontend**: TypeScript check, ESLint, Vitest
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

## エージェントの完了条件

「完了」と判断してよいのは、以下をすべて満たしたときのみ。

1. `bin/agent-check` が `STATUS: PASS` を返す
2. 変更が依頼された範囲に収まっている
3. **作業ブランチから PR が作成されている**（main への直接 push は禁止）

`bin/agent-check` は CI (`.github/workflows/ci.yml`) と同じ検査を、速い順に fail-fast で実行する。

```
tsc --noEmit  →  eslint  →  vitest run  →  (src-tauri に差分がある時だけ) cargo fmt / clippy / test
```

### ブランチと PR

このリポジトリは main が保護されている。エージェントは必ず次の順で進めること。

```bash
git switch -c <種別>/<内容>        # 例: fix/thumbnail-overflow
# ... 作業 ...
./bin/agent-check                  # green を確認してから
git push -u origin <branch>
gh pr create --fill                # PR 本文に agent-check の結果を書く
```

PR を作ったら、その URL を報告して手を止める。**レビューとマージは人間が行う。**

### 禁止事項

- **`main` へ直接 push しない。** 必ずブランチを切って PR を作る
- `bin/agent-check` が FAIL の状態で PR を作らない
- **マージは絶対に行わない**（`git merge` / `wt merge` / PR のマージ操作すべて）。マージ判断は人間が行う
- 検査を通すために `bin/agent-check` 自体を書き換えない

### 失敗したとき

出力の `FAILED_STAGE` のエラーだけを直し、`bin/agent-check` を再実行する。
フロントエンドのみの変更を反復する間は `--quick`（Rust をスキップ）を使ってよい。

### 警告について

ESLint の警告は現状 1 件（`ThumbnailGrid.tsx` の Compilation Skipped）で頭打ちにしている。
`AGENT_CHECK_MAX_WARNINGS=1` を付けて実行すると、警告が増えた時点で失敗する。
worktree のマージ前フック（`.config/wt.toml`）はこの指定で走るため、**新しい警告を残すとマージできない。**

### 並列作業（git worktree）

`wt switch -c <branch>` で worktree を作ると、`pnpm install` が自動で走る。
複数のエージェントが並列で作業する前提のため、**自分に割り当てられた範囲外のファイルは触らないこと。**
