import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ImageItem } from "@/types";
import { CompareView } from "./CompareView";
import { DetailView } from "./DetailView";
import { GalleryView } from "./GalleryView";

// Windows の WebView2（Chromium）は RAW をデコードできない。macOS の WebKit は
// ImageIO で読めてしまうため、RAW を <img> に直接渡しても macOS では不具合が
// 見えない。実機の Windows で確かめられない代わりに、「3つのビューが RAW 本体を
// src にしない」ことをここで固定する。

vi.mock("@/utils/tauri", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/utils/tauri")>()),
  getExif: vi.fn().mockResolvedValue({}),
}));

const rawItem = (overrides: Partial<ImageItem> = {}): ImageItem => ({
  filename: "DSC_0001.NEF",
  path: "C:/photos/DSC_0001.NEF",
  thumbnailPath: "C:/cache/thumbnails/DSC_0001.jpg",
  thumbnailLoaded: true,
  size: 30 * 1024 * 1024,
  modifiedAt: "2024-01-01",
  label: null,
  index: 0,
  ...overrides,
});

// GalleryView は下のサムネイル帯にも同じ alt の画像を持つ。メイン画像は DOM 上で先頭
const srcOf = (alt: string) =>
  decodeURIComponent(screen.getAllByAltText(alt)[0].getAttribute("src") ?? "");

const allSrcs = (alt: string) =>
  screen
    .queryAllByAltText(alt)
    .map((img) => decodeURIComponent(img.getAttribute("src") ?? ""));

const noop = () => {};

const views = {
  DetailView: (item: ImageItem) => (
    <DetailView
      item={item}
      totalItems={1}
      onClose={noop}
      onPrevious={noop}
      onNext={noop}
      onToggleLabel={noop}
    />
  ),
  CompareView: (item: ImageItem) => (
    <CompareView
      leftItem={item}
      rightItem={{ ...item, filename: "other.NEF", index: 1 }}
      totalItems={2}
      onClose={noop}
      onSelectLeft={noop}
      onSelectRight={noop}
      onToggleLabelLeft={noop}
      onToggleLabelRight={noop}
    />
  ),
  GalleryView: (item: ImageItem) => (
    <GalleryView
      items={[item]}
      selectedIndex={0}
      onClose={noop}
      onSelect={noop}
      onToggleLabel={noop}
      onBatchToggleLabel={noop}
    />
  ),
};

describe.each(Object.entries(views))("%s の RAW 表示", (_name, renderView) => {
  it("プレビューが無い RAW は、RAW 本体ではなくサムネイルを表示する", () => {
    render(renderView(rawItem()));
    const src = srcOf("DSC_0001.NEF");
    expect(src).not.toContain("DSC_0001.NEF");
    expect(src).toContain("C:/cache/thumbnails/DSC_0001.jpg");
  });

  it("プレビューがある RAW は、プレビューを表示する", () => {
    render(
      renderView(
        rawItem({ previewPath: "C:/cache/previews/DSC_0001_preview.jpg" }),
      ),
    );
    expect(srcOf("DSC_0001.NEF")).toContain(
      "C:/cache/previews/DSC_0001_preview.jpg",
    );
  });

  it("サムネイルもまだ無い RAW は、RAW 本体を <img> に渡さない", () => {
    render(renderView(rawItem({ thumbnailLoaded: false })));
    for (const src of allSrcs("DSC_0001.NEF")) {
      expect(src).not.toContain("DSC_0001.NEF");
    }
  });
});
