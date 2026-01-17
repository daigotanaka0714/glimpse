# Glimpse - 高速写真チェッカー

## 概要

舞台写真の選別作業に特化した、高速・軽量なデスクトップアプリケーション。
数千〜数万枚の大容量画像（NEF/JPEG）をストレスなく閲覧・選別できることを目指す。

## 技術スタック

| レイヤー | 技術 | 理由 |
|---------|------|------|
| フレームワーク | Tauri 2.0 | 軽量、Rustバックエンド、クロスプラットフォーム |
| フロントエンド | React 18 + TypeScript | 仮想スクロール、状態管理が容易 |
| スタイリング | Tailwind CSS | 高速な開発、一貫したデザイン |
| 画像処理 | Rust (image, rawloader) | マルチスレッド、NEF対応 |
| データ永続化 | SQLite (rusqlite) | セッション管理、キャッシュ管理 |
| 仮想スクロール | @tanstack/react-virtual | 大量アイテムの効率的レンダリング |
| パッケージマネージャ | pnpm 9+ | 高速、ディスク効率 |
| Node.js | 22+ (LTS) | セキュリティ、最新機能 |

## アーキテクチャ

```
┌─────────────────────────────────────────────────────────────────┐
│                        Tauri Window                             │
├─────────────────────────────────────────────────────────────────┤
│  React Frontend                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │ ThumbnailGrid│  │ DetailView  │  │ StatusBar   │            │
│  │ (Virtual)    │  │             │  │             │            │
│  └─────────────┘  └─────────────┘  └─────────────┘            │
│         │                │                │                    │
│         └────────────────┴────────────────┘                    │
│                          │                                      │
│                    Tauri IPC                                   │
├─────────────────────────────────────────────────────────────────┤
│  Rust Backend                                                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │ ImageLoader │  │ ThumbnailGen│  │ SessionMgr  │            │
│  │ (rawloader) │  │ (rayon)     │  │ (SQLite)    │            │
│  └─────────────┘  └─────────────┘  └─────────────┘            │
│         │                │                │                    │
│         └────────────────┴────────────────┘                    │
│                          │                                      │
│                    File System                                  │
└─────────────────────────────────────────────────────────────────┘
```

## 機能一覧

### Phase 1: MVP（最小実用版）

- [x] フォルダ選択・画像一覧取得
- [x] サムネイル生成（バックグラウンド・マルチスレッド）
- [x] サムネイルキャッシュ
- [x] 仮想スクロールによる一覧表示
- [x] キーボードナビゲーション（矢印キー）
- [x] 不採用ラベル付与（1キー）
- [x] 詳細表示モード（Enter/Space）
- [x] セッション保存・復元（中断・再開）
- [x] 採用ファイルを別フォルダにコピー（エクスポート）

### Phase 2: 改善

- [x] サムネイルサイズ調整（スライダー）
- [x] フィルタリング表示（不採用のみ/採用のみ）
- [x] 複数選択
- [x] ドラッグ&ドロップでフォルダ読み込み
- [x] ダークモード/ライトモード切り替え

### Phase 3: 拡張

- [x] EXIF情報表示
- [x] 画像の回転
- [x] 簡易比較モード（2枚並べて表示）
- [x] エクスポート設定（コピー/移動の選択）

## データ構造

### セッションDB（SQLite）

```sql
-- セッション情報
CREATE TABLE sessions (
    id TEXT PRIMARY KEY,           -- フォルダパスのハッシュ
    folder_path TEXT NOT NULL,
    last_opened DATETIME,
    last_selected_index INTEGER DEFAULT 0,
    total_files INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ラベル情報
CREATE TABLE labels (
    session_id TEXT,
    filename TEXT,
    label TEXT,                    -- 'rejected' or NULL
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (session_id, filename),
    FOREIGN KEY (session_id) REFERENCES sessions(id)
);

-- サムネイルキャッシュメタデータ
CREATE TABLE thumbnail_cache (
    session_id TEXT,
    filename TEXT,
    cache_path TEXT,
    original_modified DATETIME,    -- 元ファイルの更新日時
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (session_id, filename),
    FOREIGN KEY (session_id) REFERENCES sessions(id)
);
```

### ファイル構造

```
Windows: %APPDATA%/Glimpse/
macOS:   ~/Library/Application Support/Glimpse/

Glimpse/
├── glimpse.db           # SQLiteデータベース
└── cache/
    └── {session_id}/
        └── thumbnails/
            ├── DSC_0001.jpg
            ├── DSC_0002.jpg
            └── ...
```

## UI/UXデザイン

### カラースキーム

ダークテーマベース（写真チェックに集中しやすい）

```css
:root {
  --bg-primary: #0a0a0a;
  --bg-secondary: #141414;
  --bg-tertiary: #1e1e1e;
  --text-primary: #ffffff;
  --text-secondary: #a0a0a0;
  --accent: #3b82f6;          /* Blue-500 */
  --rejected: #ef4444;         /* Red-500 */
  --border: #2a2a2a;
}
```

### レイアウト仕様

#### サムネイル一覧

- グリッドレイアウト（レスポンシブ）
- 40インチモニター全画面時：横16枚 × 縦6-7行
- サムネイルサイズ：150px〜200px（調整可能）
- 選択中のアイテム：青ボーダー
- 不採用マーク：赤いバツアイコン + 半透明オーバーレイ

#### 詳細表示

- 画面中央に大きく表示
- 画像の下部に情報バー（ファイル名、位置、ラベル状態）
- ESCで一覧に戻る

### キーボードショートカット

| キー | 動作 |
|------|------|
| `←` | 前の画像を選択 |
| `→` | 次の画像を選択 |
| `↑` | 上の行の画像を選択 |
| `↓` | 下の行の画像を選択 |
| `1` | 不採用ラベルをトグル |
| `Enter` / `Space` | 詳細表示モードへ |
| `Esc` | 詳細表示から一覧へ戻る |
| `Ctrl+O` | フォルダを開く |
| `Ctrl+E` | エクスポート |
| `Home` | 最初の画像へ |
| `End` | 最後の画像へ |
| `PageUp` | 1ページ上へ |
| `PageDown` | 1ページ下へ |

## パフォーマンス目標

| 指標 | 目標値 |
|------|--------|
| 初回起動（5000枚） | < 3秒で一覧表示開始 |
| サムネイル生成速度 | > 100枚/秒 |
| 2回目以降起動 | < 1秒で一覧表示 |
| 詳細表示切替 | < 200ms |
| キー入力応答 | < 50ms |
| メモリ使用量 | < 500MB（10000枚時） |

## 開発フェーズ

### Step 1: プロジェクトセットアップ
- Tauri 2.0プロジェクト作成
- React + TypeScript + Tailwind設定
- 基本的なウィンドウ表示

### Step 2: Rustバックエンド
- フォルダスキャン機能
- サムネイル生成（image crate）
- NEF対応（rawloader crate）
- SQLiteセッション管理

### Step 3: フロントエンド基本UI
- サムネイルグリッド（仮想スクロール）
- キーボードナビゲーション
- ラベル付与UI

### Step 4: 詳細表示・エクスポート
- 詳細表示モード
- エクスポート機能

### Step 5: 仕上げ
- パフォーマンス最適化
- エラーハンドリング
- Windows向けビルド・配布設定
