import { useState } from 'react';
import { X, ChevronRight, Keyboard, Settings, FileImage, Zap, Info } from 'lucide-react';
import { useI18n } from '@/i18n';
import { getModifierKey } from '@/utils/platform';

type Section = 'overview' | 'keyboard' | 'settings' | 'raw';

interface HelpDialogProps {
  onClose: () => void;
}

const getContent = (modKey: string) => ({
  en: {
    title: 'Help',
    language: 'English',
    sections: {
      overview: {
        title: 'Overview',
        icon: Info,
        content: `
Glimpse is a high-speed photo checker designed for selecting stage photography. It allows you to browse and select thousands of images without stress.

## Basic Workflow

1. **Open a folder** - Click "Open Folder" or drag & drop a folder
2. **Browse photos** - Use arrow keys to navigate
3. **Mark rejections** - Press \`1\` to mark unwanted photos as rejected
4. **Detail view** - Press \`Enter\` or \`Space\` for full-size preview
5. **Export** - Click "Export" to save adopted (non-rejected) photos

## Key Features

- **Fast thumbnail generation** - Multi-threaded processing
- **Session persistence** - Your progress is automatically saved
- **Multiple RAW support** - NEF, ARW, CR2, CR3, RAF, and more
- **Comparison mode** - Compare two photos side by side
- **Gallery mode** - Browse with thumbnail strip
        `.trim(),
      },
      keyboard: {
        title: 'Keyboard Shortcuts',
        icon: Keyboard,
        content: `
## Navigation

| Key | Action |
|-----|--------|
| \`←\` | Previous image |
| \`→\` | Next image |
| \`↑\` | Image above |
| \`↓\` | Image below |
| \`Home\` | First image |
| \`End\` | Last image |
| \`PageUp\` | Page up |
| \`PageDown\` | Page down |

## Labels & Views

| Key | Action |
|-----|--------|
| \`1\` | Toggle rejection label |
| \`Enter\` / \`Space\` | Enter detail view |
| \`Esc\` | Exit detail/compare/gallery view |
| \`C\` | Enter comparison mode |
| \`G\` | Enter gallery mode |

## File Operations

| Key | Action |
|-----|--------|
| \`${modKey}+O\` | Open folder |
| \`${modKey}+E\` | Export |

## Multi-Select

| Key | Action |
|-----|--------|
| \`${modKey}+Click\` | Toggle selection |
| \`Shift+Click\` | Range selection |
        `.trim(),
      },
      settings: {
        title: 'Settings',
        icon: Settings,
        content: `
Access Settings from the gear icon in the header.

## Performance Tab

![Performance Settings](/docs/images/settings-performance.png)

Adjust the number of CPU threads used for thumbnail generation:

- **Auto (Recommended)** - Uses 80% of available cores
- **Manual slider** - Choose from 2 to max cores
- Higher values = faster processing but more CPU usage

## Storage Tab

![Storage Settings](/docs/images/settings-storage.png)

Manage cached data:

- **Thumbnail Cache** - Cached thumbnail images for faster loading
  - Clear to free disk space
  - Thumbnails will regenerate when you open folders

- **Label Data** - Adopted/rejected status for all sessions
  - Clearing this cannot be undone

## About Tab

![About Settings](/docs/images/settings-about.png)

- **Version info** - Current app version
- **Language** - Switch between English and Japanese
- **Check for Updates** - Manually check for new releases
- **GitHub** - Visit the project repository
- **Report Issue** - Submit bug reports (English/Japanese)
- **Sponsor** - Support development via GitHub Sponsors
        `.trim(),
      },
      raw: {
        title: 'Supported RAW Formats',
        icon: FileImage,
        content: `
Glimpse supports various RAW image formats from major camera manufacturers:

| Format | Manufacturer |
|--------|-------------|
| **NEF** | Nikon |
| **ARW** | Sony |
| **CR2** | Canon (older) |
| **CR3** | Canon (newer) |
| **RAF** | Fujifilm |
| **ORF** | Olympus |
| **RW2** | Panasonic |
| **PEF** | Pentax |
| **DNG** | Adobe (Universal) |
| **SRW** | Samsung |

In addition to these RAW formats, Glimpse also supports standard image formats:

- **JPEG** (.jpg, .jpeg)
- **PNG** (.png)
- **TIFF** (.tif, .tiff)
- **WebP** (.webp)
- **BMP** (.bmp)
- **GIF** (.gif)

## Tips

- RAW files may take longer to generate thumbnails due to their larger size
- Increasing thread count in Settings can speed up RAW thumbnail generation
- Thumbnail cache helps avoid regenerating thumbnails on subsequent opens
        `.trim(),
      },
    },
  },
  ja: {
    title: 'ヘルプ',
    language: '日本語',
    sections: {
      overview: {
        title: '概要',
        icon: Info,
        content: `
Glimpseは舞台写真の選別作業に特化した高速写真チェッカーです。数千〜数万枚の画像をストレスなく閲覧・選別できます。

## 基本的なワークフロー

1. **フォルダを開く** - 「Open Folder」をクリックするか、フォルダをドラッグ&ドロップ
2. **写真を閲覧** - 矢印キーで移動
3. **不採用をマーク** - \`1\`キーで不要な写真を不採用としてマーク
4. **詳細表示** - \`Enter\`または\`Space\`でフルサイズプレビュー
5. **エクスポート** - 「Export」をクリックして採用写真を保存

## 主な機能

- **高速サムネイル生成** - マルチスレッド処理
- **セッション保存** - 作業進捗は自動保存
- **複数RAW対応** - NEF、ARW、CR2、CR3、RAFなど
- **比較モード** - 2枚の写真を並べて比較
- **ギャラリーモード** - サムネイルストリップで閲覧
        `.trim(),
      },
      keyboard: {
        title: 'キーボードショートカット',
        icon: Keyboard,
        content: `
## ナビゲーション

| キー | 動作 |
|------|------|
| \`←\` | 前の画像 |
| \`→\` | 次の画像 |
| \`↑\` | 上の行の画像 |
| \`↓\` | 下の行の画像 |
| \`Home\` | 最初の画像 |
| \`End\` | 最後の画像 |
| \`PageUp\` | 1ページ上 |
| \`PageDown\` | 1ページ下 |

## ラベル＆表示

| キー | 動作 |
|------|------|
| \`1\` | 不採用ラベルをトグル |
| \`Enter\` / \`Space\` | 詳細表示モードへ |
| \`Esc\` | 詳細/比較/ギャラリー表示から戻る |
| \`C\` | 比較モードへ |
| \`G\` | ギャラリーモードへ |

## ファイル操作

| キー | 動作 |
|------|------|
| \`${modKey}+O\` | フォルダを開く |
| \`${modKey}+E\` | エクスポート |

## 複数選択

| キー | 動作 |
|------|------|
| \`${modKey}+クリック\` | 選択をトグル |
| \`Shift+クリック\` | 範囲選択 |
        `.trim(),
      },
      settings: {
        title: '設定',
        icon: Settings,
        content: `
ヘッダーの歯車アイコンから設定にアクセスできます。

## パフォーマンスタブ

![パフォーマンス設定](/docs/images/settings-performance.png)

サムネイル生成に使用するCPUスレッド数を調整：

- **Auto（推奨）** - 利用可能なコアの80%を使用
- **手動スライダー** - 2からコア数の最大値まで選択可能
- 値が高いほど処理が速くなりますが、CPU使用率も上昇

## ストレージタブ

![ストレージ設定](/docs/images/settings-storage.png)

キャッシュデータの管理：

- **サムネイルキャッシュ** - 高速読み込み用のサムネイル画像
  - クリアするとディスク容量を解放
  - フォルダを開くとサムネイルは再生成

- **ラベルデータ** - 全セッションの採用/不採用ステータス
  - クリアすると元に戻せません

## Aboutタブ

![About設定](/docs/images/settings-about.png)

- **バージョン情報** - 現在のアプリバージョン
- **言語** - 英語と日本語を切り替え
- **Check for Updates** - 新しいリリースを手動で確認
- **GitHub** - プロジェクトリポジトリを表示
- **Report Issue** - バグ報告を送信（英語/日本語）
- **スポンサー** - GitHub Sponsorsで開発を支援
        `.trim(),
      },
      raw: {
        title: '対応RAWフォーマット',
        icon: FileImage,
        content: `
Glimpseは主要カメラメーカーの様々なRAW画像フォーマットに対応しています：

| フォーマット | メーカー |
|------------|---------|
| **NEF** | ニコン |
| **ARW** | ソニー |
| **CR2** | キヤノン（旧型） |
| **CR3** | キヤノン（新型） |
| **RAF** | 富士フイルム |
| **ORF** | オリンパス |
| **RW2** | パナソニック |
| **PEF** | ペンタックス |
| **DNG** | Adobe（汎用） |
| **SRW** | サムスン |

これらのRAWフォーマットに加え、標準的な画像フォーマットもサポート：

- **JPEG** (.jpg, .jpeg)
- **PNG** (.png)
- **TIFF** (.tif, .tiff)
- **WebP** (.webp)
- **BMP** (.bmp)
- **GIF** (.gif)

## ヒント

- RAWファイルはサイズが大きいため、サムネイル生成に時間がかかる場合があります
- 設定でスレッド数を増やすとRAWサムネイル生成が高速化
- サムネイルキャッシュにより、2回目以降の読み込みが高速化
        `.trim(),
      },
    },
  },
});

export function HelpDialog({ onClose }: HelpDialogProps) {
  const { language, setLanguage, t: translations } = useI18n();
  const [activeSection, setActiveSection] = useState<Section>('overview');

  const modKey = getModifierKey();
  const content = getContent(modKey);
  const langContent = language === 'ja' ? content.ja : content.en;
  const sections: Section[] = ['overview', 'keyboard', 'settings', 'raw'];

  const renderMarkdown = (text: string) => {
    // Simple markdown rendering
    const lines = text.split('\n');
    const elements: JSX.Element[] = [];
    let inTable = false;
    let tableRows: string[][] = [];
    let tableKey = 0;

    const processLine = (line: string, index: number) => {
      // Headers
      if (line.startsWith('## ')) {
        return (
          <h3 key={index} className="text-lg font-semibold mt-6 mb-3 text-text-primary">
            {line.slice(3)}
          </h3>
        );
      }

      // Images (placeholder)
      const imgMatch = line.match(/!\[([^\]]*)\]\(([^)]+)\)/);
      if (imgMatch) {
        return (
          <div key={index} className="my-4 p-4 bg-bg-tertiary rounded-lg border border-white/10 text-center">
            <div className="flex items-center justify-center gap-2 text-text-secondary">
              <FileImage size={20} />
              <span className="text-sm">{imgMatch[1] || 'Screenshot'}</span>
            </div>
            <p className="text-xs text-text-secondary mt-2">
              {language === 'en' ? 'Image placeholder' : '画像プレースホルダー'}
            </p>
          </div>
        );
      }

      // Table
      if (line.startsWith('|')) {
        if (!inTable) {
          inTable = true;
          tableRows = [];
        }
        const cells = line.split('|').filter(c => c.trim()).map(c => c.trim());
        if (!line.includes('---')) {
          tableRows.push(cells);
        }
        return null;
      } else if (inTable) {
        inTable = false;
        const currentTableRows = [...tableRows];
        tableRows = [];
        tableKey++;
        return (
          <div key={`table-${tableKey}`} className="my-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  {currentTableRows[0]?.map((cell, i) => (
                    <th key={i} className="text-left py-2 px-3 text-text-secondary font-medium">
                      {cell}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {currentTableRows.slice(1).map((row, rowIndex) => (
                  <tr key={rowIndex} className="border-b border-white/5">
                    {row.map((cell, cellIndex) => (
                      <td key={cellIndex} className="py-2 px-3">
                        {cell.includes('`') ? (
                          <code className="px-1.5 py-0.5 bg-bg-tertiary rounded text-accent text-xs">
                            {cell.replace(/`/g, '')}
                          </code>
                        ) : cell.startsWith('**') && cell.endsWith('**') ? (
                          <strong>{cell.slice(2, -2)}</strong>
                        ) : (
                          cell
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }

      // List items
      if (line.startsWith('- ')) {
        const text = line.slice(2);
        return (
          <li key={index} className="ml-4 mb-1 text-sm text-text-secondary list-disc">
            {renderInlineMarkdown(text)}
          </li>
        );
      }

      // Numbered list
      const numberedMatch = line.match(/^(\d+)\.\s+(.+)$/);
      if (numberedMatch) {
        return (
          <li key={index} className="ml-4 mb-2 text-sm text-text-secondary list-decimal">
            {renderInlineMarkdown(numberedMatch[2])}
          </li>
        );
      }

      // Empty line
      if (line.trim() === '') {
        return <div key={index} className="h-2" />;
      }

      // Regular paragraph
      return (
        <p key={index} className="text-sm text-text-secondary mb-2">
          {renderInlineMarkdown(line)}
        </p>
      );
    };

    const renderInlineMarkdown = (text: string) => {
      // Bold
      const parts = text.split(/(\*\*[^*]+\*\*)/);
      return parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i} className="text-text-primary">{part.slice(2, -2)}</strong>;
        }
        // Inline code
        const codeParts = part.split(/(`[^`]+`)/);
        return codeParts.map((codePart, j) => {
          if (codePart.startsWith('`') && codePart.endsWith('`')) {
            return (
              <code key={`${i}-${j}`} className="px-1.5 py-0.5 bg-bg-tertiary rounded text-accent text-xs">
                {codePart.slice(1, -1)}
              </code>
            );
          }
          return codePart;
        });
      });
    };

    lines.forEach((line, index) => {
      const element = processLine(line, index);
      if (element) {
        elements.push(element);
      }
    });

    // Handle any remaining table
    if (inTable && tableRows.length > 0) {
      elements.push(
        <div key="table-final" className="my-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                {tableRows[0]?.map((cell, i) => (
                  <th key={i} className="text-left py-2 px-3 text-text-secondary font-medium">
                    {cell}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableRows.slice(1).map((row, rowIndex) => (
                <tr key={rowIndex} className="border-b border-white/5">
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex} className="py-2 px-3">
                      {cell.includes('`') ? (
                        <code className="px-1.5 py-0.5 bg-bg-tertiary rounded text-accent text-xs">
                          {cell.replace(/`/g, '')}
                        </code>
                      ) : cell.startsWith('**') && cell.endsWith('**') ? (
                        <strong>{cell.slice(2, -2)}</strong>
                      ) : (
                        cell
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    return elements;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 animate-fade-in">
      <div className="w-full max-w-3xl h-[80vh] bg-bg-secondary rounded-2xl shadow-2xl animate-slide-up overflow-hidden flex flex-col">
        {/* Header */}
        <div className="relative px-6 py-5 border-b border-white/10 shrink-0">
          <div className="absolute inset-0 bg-gradient-to-r from-accent/10 via-transparent to-transparent" />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center">
                <Info size={20} className="text-accent" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">{translations.help.title}</h2>
                <p className="text-xs text-text-secondary">{translations.help.subtitle}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Language toggle */}
              <div className="flex bg-bg-tertiary rounded-lg p-1">
                <button
                  onClick={() => setLanguage('en')}
                  className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                    language === 'en'
                      ? 'bg-accent text-white'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  EN
                </button>
                <button
                  onClick={() => setLanguage('ja')}
                  className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                    language === 'ja'
                      ? 'bg-accent text-white'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  日本語
                </button>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-white/10 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <div className="w-56 border-r border-white/10 p-4 shrink-0">
            <nav className="space-y-1">
              {sections.map((section) => {
                const sectionContent = langContent.sections[section];
                const Icon = sectionContent.icon;
                return (
                  <button
                    key={section}
                    onClick={() => setActiveSection(section)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      activeSection === section
                        ? 'bg-accent/20 text-accent'
                        : 'text-text-secondary hover:bg-white/5 hover:text-text-primary'
                    }`}
                  >
                    <Icon size={18} />
                    <span className="flex-1 text-left">{sectionContent.title}</span>
                    {activeSection === section && (
                      <ChevronRight size={16} className="text-accent" />
                    )}
                  </button>
                );
              })}
            </nav>

            {/* Quick tips */}
            <div className="mt-6 p-3 bg-accent/5 border border-accent/20 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Zap size={14} className="text-accent" />
                <span className="text-xs font-medium text-accent">
                  {translations.help.quickTip}
                </span>
              </div>
              <p className="text-xs text-text-secondary">
                {translations.help.pressToOpen}
              </p>
            </div>
          </div>

          {/* Main content */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-2xl">
              {renderMarkdown(langContent.sections[activeSection].content)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
