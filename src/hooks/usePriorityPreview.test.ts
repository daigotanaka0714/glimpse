import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ImageItem } from "@/types";
import { ensurePreview } from "@/utils/tauri";
import { usePriorityPreview } from "./usePriorityPreview";

vi.mock("@/utils/tauri", () => ({
  ensurePreview: vi.fn(),
}));

const item = (filename: string, overrides: Partial<ImageItem> = {}) =>
  ({
    filename,
    path: `/p/${filename}`,
    size: 1,
    modifiedAt: "",
    thumbnailPath: `/cache/${filename}.jpg`,
    thumbnailLoaded: true,
    label: null,
    index: 0,
    ...overrides,
  }) as ImageItem;

describe("usePriorityPreview", () => {
  beforeEach(() => {
    vi.mocked(ensurePreview).mockReset();
  });

  it("表示中の RAW にプレビューが無ければ作らせ、返ったパスを渡す", async () => {
    vi.mocked(ensurePreview).mockResolvedValue("/prev/a_preview.jpg");
    const onReady = vi.fn();

    renderHook(() => usePriorityPreview([item("a.CR3")], onReady));

    expect(ensurePreview).toHaveBeenCalledWith("/p/a.CR3");
    await waitFor(() =>
      expect(onReady).toHaveBeenCalledWith("/p/a.CR3", "/prev/a_preview.jpg"),
    );
  });

  it("JPEG・プレビュー済みの RAW・表示なしでは呼ばない", () => {
    renderHook(() =>
      usePriorityPreview(
        [
          item("a.jpg"),
          item("b.NEF", { previewPath: "/prev/b_preview.jpg" }),
          null,
        ],
        vi.fn(),
      ),
    );
    expect(ensurePreview).not.toHaveBeenCalled();
  });

  it("同じファイルは、失敗しても一度しか頼まない", async () => {
    vi.mocked(ensurePreview).mockRejectedValue("decode failed");
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const onReady = vi.fn();

    const { rerender } = renderHook(
      ({ items }) => usePriorityPreview(items, onReady),
      { initialProps: { items: [item("a.NEF")] } },
    );
    await waitFor(() => expect(consoleError).toHaveBeenCalled());
    rerender({ items: [item("a.NEF")] });

    expect(ensurePreview).toHaveBeenCalledTimes(1);
    expect(onReady).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
