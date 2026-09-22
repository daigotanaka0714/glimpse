import { act, renderHook } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ImageItem } from "@/types";
import type { ThumbnailResult } from "@/utils/tauri";
import {
  applyThumbnailResults,
  THUMBNAIL_FLUSH_INTERVAL_MS,
  useThumbnailResults,
} from "./useThumbnailResults";

const handlers = vi.hoisted(() => ({
  ready: null as null | ((r: ThumbnailResult) => void),
  complete: null as null | ((r: ThumbnailResult[]) => void),
}));

vi.mock("@/utils/tauri", () => ({
  onThumbnailReady: vi.fn(async (cb: (r: ThumbnailResult) => void) => {
    handlers.ready = cb;
    return () => {};
  }),
  onThumbnailsComplete: vi.fn(async (cb: (r: ThumbnailResult[]) => void) => {
    handlers.complete = cb;
    return () => {};
  }),
}));

const item = (filename: string, overrides: Partial<ImageItem> = {}) =>
  ({
    filename,
    path: `/p/${filename}`,
    size: 1,
    modifiedAt: "",
    thumbnailPath: `/cache/${filename}.jpg`,
    thumbnailLoaded: false,
    label: null,
    index: 0,
    ...overrides,
  }) as ImageItem;

const ok = (filename: string, preview_path: string | null = null) => ({
  filename,
  thumbnail_path: `/cache/${filename}.jpg`,
  preview_path,
  success: true,
  error: null,
});

describe("applyThumbnailResults", () => {
  it("成功した結果でサムネイル読み込み済みとプレビューを反映する", () => {
    const next = applyThumbnailResults(
      [item("a.NEF"), item("b.jpg")],
      [ok("a.NEF", "/prev/a_preview.jpg"), ok("b.jpg")],
    );
    expect(next[0]).toMatchObject({
      thumbnailLoaded: true,
      previewPath: "/prev/a_preview.jpg",
    });
    expect(next[1]).toMatchObject({ thumbnailLoaded: true });
    expect(next[1].previewPath).toBeUndefined();
  });

  it("失敗した結果は反映しない", () => {
    const images = [item("a.NEF")];
    const next = applyThumbnailResults(images, [
      { ...ok("a.NEF"), success: false, error: "boom" },
    ]);
    expect(next).toBe(images);
  });

  it("先に取れたプレビューを null で上書きしない", () => {
    const next = applyThumbnailResults(
      [item("a.NEF", { previewPath: "/prev/a_preview.jpg" })],
      [ok("a.NEF", null)],
    );
    expect(next[0].previewPath).toBe("/prev/a_preview.jpg");
  });

  it("何も変わらなければ同じ配列を返す", () => {
    const images = [item("a.jpg", { thumbnailLoaded: true })];
    expect(applyThumbnailResults(images, [ok("a.jpg")])).toBe(images);
  });
});

describe("useThumbnailResults", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    handlers.ready = null;
    handlers.complete = null;
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const setup = (initial: ImageItem[]) => {
    const onComplete = vi.fn();
    let renders = 0;
    const hook = renderHook(() => {
      renders++;
      const [images, setImages] = useState(initial);
      useThumbnailResults(setImages, onComplete);
      return images;
    });
    return { hook, onComplete, renders: () => renders };
  };

  it("1枚ごとの結果を、全件の完了を待たずに反映する", async () => {
    const { hook } = setup([item("a.NEF"), item("b.NEF")]);
    await act(async () => {});

    act(() => handlers.ready?.(ok("a.NEF", "/prev/a_preview.jpg")));
    act(() => vi.advanceTimersByTime(THUMBNAIL_FLUSH_INTERVAL_MS));

    expect(hook.result.current[0].previewPath).toBe("/prev/a_preview.jpg");
    expect(hook.result.current[1].thumbnailLoaded).toBe(false);
  });

  it("続けて届いた結果は、1回の state 更新にまとめる", async () => {
    const names = Array.from({ length: 500 }, (_, i) => `img${i}.NEF`);
    const { hook, renders } = setup(names.map((n) => item(n)));
    await act(async () => {});
    const before = renders();

    act(() => {
      for (const n of names) handlers.ready?.(ok(n, `/prev/${n}`));
    });
    expect(renders()).toBe(before);

    act(() => vi.advanceTimersByTime(THUMBNAIL_FLUSH_INTERVAL_MS));
    expect(renders()).toBe(before + 1);
    expect(hook.result.current.every((i) => i.previewPath)).toBe(true);
  });

  it("完了通知で残りを反映し、onComplete を呼ぶ", async () => {
    const { hook, onComplete } = setup([item("a.NEF")]);
    await act(async () => {});

    act(() => handlers.complete?.([ok("a.NEF", "/prev/a_preview.jpg")]));

    expect(hook.result.current[0].previewPath).toBe("/prev/a_preview.jpg");
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
