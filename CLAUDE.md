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

RAW files (NEF, ARW, CR2, CR3, RAF, ORF, RW2, PEF, DNG, SRW) go through **two paths, in this order**:

1. **`raw_preview.rs` (ours)** — pulls the JPEG the camera embedded in the RAW. Tens of
   milliseconds, and it does not depend on a camera table, so new bodies work on day one.
   This is the path almost every file takes.
2. **`rawloader` + `imagepipe`** — full demosaic. 1–4 seconds per file, and it only handles
   cameras in its table. Used only when path 1 fails or returns an image smaller than the
   requested size.

Why path 1 exists: `rawloader` 0.37 cannot decode CR3 at all, and does not know the
Fujifilm X-T3, so Canon R5 and X-T3 files failed outright (measured on both Windows and
macOS). Culling needs a picture good enough to judge keep/reject, which is exactly what
the camera's own JPEG is.

`rawler` and `quickraw` are both LGPL-2.1, which would bind this MIT project, so the
extraction is written here instead of taking a dependency.

**Formats are gated by real files**: `.github/workflows/raw-samples.yml` downloads one
sample per container structure from raw.pixls.us (CC0) and fails if any of them stops
producing a thumbnail and preview. Unit tests alone missed the CR3/RAF gap.

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

### While working

- **Do not chain shell commands with `&&` or `;`.** Run `cd` as its own call
  too. The auto mode classifier reads a chained command as one unit and
  blocks the whole thing (`cd <dir> && <script that creates a worktree>` was
  blocked; the same commands run separately went through). A chained command
  also stops matching the `Bash(...)` permission rules, which match by prefix

### When opening a PR

- Do not put a Claude session URL (`claude.ai/code/session_...`) or a
  `Claude-Session:` line in the PR body or in any commit message
- Do not add a `🤖 Generated with Claude Code` line to the PR body or to any
  commit message. This is a backstop: the real fix is `attribution.pr: ""` in
  the user's Claude Code settings, which is where the instruction comes from
- **Always name the repository and include the URL when referring to a PR.**
  `#24` alone does not identify anything when several repositories are in play
- Stacked PRs: before merging the base PR, re-target the one stacked on top of
  it to the default branch first (`gh pr edit <n> --base main`). Merging the
  base deletes its branch, and that takes the stacked PR with it. Most of these
  repositories delete the branch on merge automatically, so this is a step you
  have to take, not an option you can decline

<!-- daigo-lab-ops:completion-criteria:end -->
