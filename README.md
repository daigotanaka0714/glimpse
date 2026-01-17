# Glimpse

高速写真チェッカー - 舞台写真の選別作業に特化したデスクトップアプリケーション

## 特徴

- **爆速** - 数千〜数万枚の画像をストレスなく閲覧
- **NEF対応** - Nikon RAWファイルをネイティブサポート
- **キーボード操作** - 矢印キーとラベルキーで高速選別
- **中断・再開** - 作業途中でも安心して中断可能
- **軽量** - Tauri + Rustで低メモリ消費

## システム要件

### Windows
- Windows 10/11 64bit
- WebView2 Runtime（Windows 11は標準搭載）

### macOS
- macOS 10.15 (Catalina) 以降

### 開発環境
- Node.js 22+
- Rust 1.70+
- pnpm 9+

## インストール

[Releases](https://github.com/xxx/glimpse/releases)から最新版をダウンロードしてください。

### Windows
1. `Glimpse_x.x.x_x64-setup.exe` をダウンロード
2. インストーラーを実行

### macOS
1. `Glimpse_x.x.x_aarch64.dmg` をダウンロード
2. アプリケーションフォルダにドラッグ

## 使い方

### 基本操作

1. アプリを起動
2. 「フォルダを開く」ボタン or `Ctrl+O` で写真フォルダを選択
3. サムネイルが表示されたら、矢印キーで移動
4. `1` キーで不採用マーク
5. `Enter` or `Space` で詳細表示
6. 作業完了後、`Ctrl+E` でエクスポート

### キーボードショートカット

| キー | 動作 |
|------|------|
| `←` `→` `↑` `↓` | 選択移動 |
| `1` | 不採用ラベル ON/OFF |
| `Enter` / `Space` | 詳細表示 |
| `Esc` | 一覧に戻る |
| `Ctrl+O` | フォルダを開く |
| `Ctrl+E` | エクスポート |
| `Home` / `End` | 最初/最後へ |
| `PageUp` / `PageDown` | ページ移動 |

## 開発

### 必要な環境

- Node.js 22+
- Rust 1.70+
- pnpm 9+
- Tauri CLI

### セットアップ

```bash
# リポジトリをクローン
git clone https://github.com/xxx/glimpse.git
cd glimpse

# 依存関係をインストール
pnpm install

# 開発サーバー起動
pnpm tauri dev

# ビルド
pnpm tauri build
```

## ライセンス

MIT License
