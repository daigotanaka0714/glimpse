import { act, cleanup, render, screen } from "@testing-library/react";
import type { Mock } from "vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

// Drives the real drag & drop path end to end: tauri://drag-drop → useDragAndDrop →
// App's open-folder handler → openFolder (mocked at the IPC boundary). The hook's own
// tests stop at onDrop, which is how a dropped *file* slipped through unnoticed.

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(),
}));

vi.mock("@/i18n", async () => {
  const { en } = await vi.importActual<typeof import("@/i18n/translations/en")>(
    "@/i18n/translations/en",
  );
  return {
    useTranslation: () => en,
    useI18n: () => ({ language: "en", setLanguage: vi.fn(), t: en }),
  };
});

vi.mock("@/utils/tauri", async () => {
  const actual =
    await vi.importActual<typeof import("@/utils/tauri")>("@/utils/tauri");
  return {
    ...actual,
    openFolder: vi.fn(),
    saveSelection: vi.fn(() => Promise.resolve()),
  };
});

import { listen } from "@tauri-apps/api/event";
import { openFolder } from "@/utils/tauri";

type EventHandler = (event: { payload: unknown }) => void;

const FOLDER = "/Users/me/Pictures/stage";
const FILE = `${FOLDER}/IMG_0001.jpg`;

const folderResult = {
  session_id: "s1",
  images: [
    {
      filename: "IMG_0001.jpg",
      path: FILE,
      size: 1,
      modified_at: "2026-01-01T00:00:00Z",
    },
  ],
  labels: [],
  last_selected_index: 0,
  cache_dir: "/cache/s1",
  subfolders: [],
};

describe("App drag & drop", () => {
  const mockListen = listen as unknown as Mock;
  const mockOpenFolder = openFolder as unknown as Mock;
  let handlers: Map<string, EventHandler>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    // The grid's virtualizer calls `new ResizeObserver()`; the shared mock in
    // src/test/setup.ts is not constructible, and no other test renders the grid.
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    handlers = new Map();
    mockListen.mockImplementation((event: string, handler: EventHandler) => {
      handlers.set(event, handler);
      return Promise.resolve(() => {});
    });
    // What the backend really answers for a file path (GlimpseError::NotAFolder)
    mockOpenFolder.mockImplementation((path: string) =>
      path === FOLDER
        ? Promise.resolve(folderResult)
        : Promise.reject(`Not a folder: ${path}`),
    );
  });

  afterEach(() => {
    // Unmount while the ResizeObserver stub is still in place
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const renderApp = async () => {
    render(<App />);
    // Let the listen() promises inside the effects resolve
    await act(async () => {});
  };

  const drop = async (paths: string[]) => {
    const handler = handlers.get("tauri://drag-drop");
    if (!handler) throw new Error("tauri://drag-drop is not being listened to");
    await act(async () => {
      handler({ payload: { paths, position: { x: 0, y: 0 } } });
    });
  };

  it("opens a dropped folder", async () => {
    await renderApp();

    await drop([FOLDER]);

    expect(mockOpenFolder).toHaveBeenCalledWith(FOLDER);
    expect(screen.getByTitle(FOLDER)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("tells the user when a dropped file cannot be opened as a folder", async () => {
    await renderApp();

    await drop([FILE]);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Couldn't open the folder");
    expect(alert).toHaveTextContent(`Not a folder: ${FILE}`);
    // Not the misleading "No images found in this folder" screen for a file
    expect(
      screen.queryByText("No images found in this folder"),
    ).not.toBeInTheDocument();
  });

  it("keeps the open folder when a dropped file fails to open", async () => {
    await renderApp();
    await drop([FOLDER]);

    await drop([FILE]);

    expect(screen.getByRole("alert")).toBeInTheDocument();
    // The header (and export, which reads the same state) still points at the folder
    expect(screen.getByTitle(FOLDER)).toBeInTheDocument();
    expect(screen.queryByTitle(FILE)).not.toBeInTheDocument();
  });

  it("clears the error once a folder opens", async () => {
    await renderApp();
    await drop([FILE]);
    expect(screen.getByRole("alert")).toBeInTheDocument();

    await drop([FOLDER]);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByTitle(FOLDER)).toBeInTheDocument();
  });
});
