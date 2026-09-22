import { describe, expect, it } from "vitest";
import { getDisplayImagePath, isRawFile, RAW_EXTENSIONS } from "./imageSource";

const base = {
  thumbnailPath: "/cache/thumbnails/a.jpg",
  thumbnailLoaded: true,
};

describe("getDisplayImagePath", () => {
  it("RAW でプレビューが無いときはサムネイルを返す", () => {
    expect(
      getDisplayImagePath({ ...base, filename: "a.NEF", path: "/p/a.NEF" }),
    ).toBe("/cache/thumbnails/a.jpg");
  });

  it("プレビューがあればプレビューを返す", () => {
    expect(
      getDisplayImagePath({
        ...base,
        filename: "a.NEF",
        path: "/p/a.NEF",
        previewPath: "/cache/previews/a_preview.jpg",
      }),
    ).toBe("/cache/previews/a_preview.jpg");
  });

  it("JPEG は元ファイルを返す", () => {
    expect(
      getDisplayImagePath({ ...base, filename: "a.jpg", path: "/p/a.jpg" }),
    ).toBe("/p/a.jpg");
  });

  it("RAW でサムネイルもまだ無ければ null を返す（RAW 本体は返さない）", () => {
    expect(
      getDisplayImagePath({
        ...base,
        thumbnailLoaded: false,
        filename: "a.NEF",
        path: "/p/a.NEF",
      }),
    ).toBeNull();
  });

  it.each(RAW_EXTENSIONS.flatMap((ext) => [ext, ext.toUpperCase()]))(
    "どの RAW 形式（.%s）でも RAW 本体を返さない",
    (ext) => {
      const path = `/p/a.${ext}`;
      expect(
        getDisplayImagePath({ ...base, filename: `a.${ext}`, path }),
      ).not.toBe(path);
    },
  );
});

describe("isRawFile", () => {
  it("拡張子で判定し、大文字小文字を区別しない", () => {
    expect(isRawFile("a.cr3")).toBe(true);
    expect(isRawFile("a.CR3")).toBe(true);
    expect(isRawFile("a.Raf")).toBe(true);
    expect(isRawFile("a.jpeg")).toBe(false);
    expect(isRawFile("a.png")).toBe(false);
    expect(isRawFile("nef")).toBe(false);
  });
});
