import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { UpdateInfo } from "@/utils/updateChecker";

// UpdateNotification は tauri-update-notifier を直接呼び出す（updateChecker.ts は
// 素通しの re-export barrel）ため、ここでもパッケージ自体をモックする。
// updateChecker.ts (barrel) also re-exports clearDismissedVersion, so it must
// be present here too or the re-export resolution fails even though
// UpdateNotification itself never calls it.
vi.mock("tauri-update-notifier", () => ({
  checkForUpdates: vi.fn(),
  isVersionDismissed: vi.fn(),
  dismissVersion: vi.fn(),
  clearDismissedVersion: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-shell", () => ({
  open: vi.fn(),
}));

import { open as shellOpen } from "@tauri-apps/plugin-shell";
import * as notifier from "tauri-update-notifier";
import { UpdateNotification } from "./UpdateNotification";

const defaultProps = {
  owner: "daigotanaka0714",
  repo: "glimpse",
  currentVersion: "0.1.0",
};

const updateInfo: UpdateInfo = {
  currentVersion: "0.1.0",
  latestVersion: "0.2.0",
  isUpdateAvailable: true,
  releaseUrl: "https://github.com/daigotanaka0714/glimpse/releases/tag/v0.2.0",
  releaseNotes: "Bug fixes",
  publishedAt: "2025-01-01T00:00:00Z",
  assets: [],
};

/** マウント時の自動チェックを進めて、通知が表示された状態にする */
async function renderVisible(
  props: Partial<React.ComponentProps<typeof UpdateNotification>> = {},
  info: UpdateInfo = updateInfo,
) {
  vi.mocked(notifier.checkForUpdates).mockResolvedValue(info);
  vi.mocked(notifier.isVersionDismissed).mockReturnValue(false);

  const utils = render(<UpdateNotification {...defaultProps} {...props} />);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(2000);
  });

  return utils;
}

describe("UpdateNotification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("マウント時のチェック", () => {
    it("2000ms 経過するまではチェックしない", async () => {
      vi.mocked(notifier.checkForUpdates).mockResolvedValue(updateInfo);
      render(<UpdateNotification {...defaultProps} />);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1999);
      });

      expect(notifier.checkForUpdates).not.toHaveBeenCalled();
    });

    it("2000ms 経過するとチェックする", async () => {
      vi.mocked(notifier.checkForUpdates).mockResolvedValue(updateInfo);
      render(<UpdateNotification {...defaultProps} />);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000);
      });

      expect(notifier.checkForUpdates).toHaveBeenCalledTimes(1);
      expect(notifier.checkForUpdates).toHaveBeenCalledWith({
        owner: defaultProps.owner,
        repo: defaultProps.repo,
        currentVersion: defaultProps.currentVersion,
      });
    });

    it("checkOnMount が false のときは時間が経過してもチェックしない", async () => {
      vi.mocked(notifier.checkForUpdates).mockResolvedValue(updateInfo);
      render(<UpdateNotification {...defaultProps} checkOnMount={false} />);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(10000);
      });

      expect(notifier.checkForUpdates).not.toHaveBeenCalled();
    });

    it("2000ms 経過前にアンマウントされたらチェックしない", async () => {
      vi.mocked(notifier.checkForUpdates).mockResolvedValue(updateInfo);
      const { unmount } = render(<UpdateNotification {...defaultProps} />);

      unmount();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000);
      });

      expect(notifier.checkForUpdates).not.toHaveBeenCalled();
    });
  });

  describe("定期チェック", () => {
    it("checkInterval が 0（デフォルト）のときは繰り返しチェックしない", async () => {
      vi.mocked(notifier.checkForUpdates).mockResolvedValue(updateInfo);
      render(<UpdateNotification {...defaultProps} checkOnMount={false} />);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(60000);
      });

      expect(notifier.checkForUpdates).not.toHaveBeenCalled();
    });

    it("checkInterval を指定すると一定間隔で繰り返しチェックする", async () => {
      vi.mocked(notifier.checkForUpdates).mockResolvedValue(updateInfo);
      render(
        <UpdateNotification
          {...defaultProps}
          checkOnMount={false}
          checkInterval={5000}
        />,
      );

      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });
      expect(notifier.checkForUpdates).toHaveBeenCalledTimes(1);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });
      expect(notifier.checkForUpdates).toHaveBeenCalledTimes(2);
    });
  });

  describe("通知の表示", () => {
    it("更新があり、かつスキップ済みでなければ通知を表示する", async () => {
      await renderVisible();

      expect(screen.getByText("Update Available")).toBeInTheDocument();
      expect(screen.getByText("0.1.0")).toBeInTheDocument();
      expect(screen.getByText("0.2.0")).toBeInTheDocument();
    });

    it("更新がない場合は通知を表示しない", async () => {
      await renderVisible({}, { ...updateInfo, isUpdateAvailable: false });

      expect(screen.queryByText("Update Available")).not.toBeInTheDocument();
    });

    it("そのバージョンがスキップ済みの場合は通知を表示しない", async () => {
      vi.mocked(notifier.checkForUpdates).mockResolvedValue(updateInfo);
      vi.mocked(notifier.isVersionDismissed).mockReturnValue(true);

      render(<UpdateNotification {...defaultProps} />);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000);
      });

      expect(notifier.isVersionDismissed).toHaveBeenCalledWith(
        defaultProps.repo,
        updateInfo.latestVersion,
      );
      expect(screen.queryByText("Update Available")).not.toBeInTheDocument();
    });

    it("チェックに失敗した場合は通知を表示せず、エラーをログするだけでクラッシュしない", async () => {
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      vi.mocked(notifier.checkForUpdates).mockRejectedValue(
        new Error("Network error"),
      );

      render(<UpdateNotification {...defaultProps} />);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000);
      });

      expect(screen.queryByText("Update Available")).not.toBeInTheDocument();
      expect(consoleError).toHaveBeenCalledWith(
        "Failed to check for updates:",
        expect.any(Error),
      );

      consoleError.mockRestore();
    });
  });

  describe("リリースノートの表示", () => {
    it("200文字以内ならそのまま表示し、省略記号は付かない", async () => {
      await renderVisible({}, { ...updateInfo, releaseNotes: "Bug fixes" });

      expect(screen.getByText("Bug fixes")).toBeInTheDocument();
      expect(screen.queryByText(/Bug fixes\.\.\./)).not.toBeInTheDocument();
    });

    it("200文字を超える場合は200文字に切り詰めて省略記号を付ける", async () => {
      const longNotes = "a".repeat(250);
      await renderVisible({}, { ...updateInfo, releaseNotes: longNotes });

      expect(screen.getByText(`${"a".repeat(200)}...`)).toBeInTheDocument();
    });

    it("リリースノートが空文字なら欄ごと表示しない", async () => {
      const { container } = await renderVisible(
        {},
        { ...updateInfo, releaseNotes: "" },
      );

      expect(container.querySelector(".bg-bg-primary")).not.toBeInTheDocument();
    });
  });

  describe("閉じるボタン", () => {
    it("通知を閉じるだけで、スキップ済みとしては記録しない", async () => {
      await renderVisible();

      fireEvent.click(screen.getByLabelText("Close"));

      expect(screen.queryByText("Update Available")).not.toBeInTheDocument();
      expect(notifier.dismissVersion).not.toHaveBeenCalled();
    });
  });

  describe("スキップボタン", () => {
    it("該当バージョンをスキップ済みとして記録し、通知を閉じる", async () => {
      await renderVisible();

      fireEvent.click(screen.getByText("Skip"));

      expect(notifier.dismissVersion).toHaveBeenCalledWith(
        defaultProps.repo,
        updateInfo.latestVersion,
      );
      expect(screen.queryByText("Update Available")).not.toBeInTheDocument();
    });
  });

  describe("ダウンロードボタン", () => {
    it("releaseUrl を開く", async () => {
      vi.mocked(shellOpen).mockResolvedValue(undefined);
      await renderVisible();

      await act(async () => {
        fireEvent.click(screen.getByText("Download"));
      });

      expect(shellOpen).toHaveBeenCalledWith(updateInfo.releaseUrl);
    });

    it("open() が失敗したら window.open にフォールバックする", async () => {
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const windowOpen = vi
        .spyOn(window, "open")
        .mockImplementation(() => null);
      vi.mocked(shellOpen).mockRejectedValue(new Error("failed to open"));

      await renderVisible();

      await act(async () => {
        fireEvent.click(screen.getByText("Download"));
      });

      expect(windowOpen).toHaveBeenCalledWith(updateInfo.releaseUrl, "_blank");

      consoleError.mockRestore();
      windowOpen.mockRestore();
    });

    it("releaseUrl が空なら何もしない", async () => {
      const windowOpen = vi
        .spyOn(window, "open")
        .mockImplementation(() => null);
      await renderVisible({}, { ...updateInfo, releaseUrl: "" });

      fireEvent.click(screen.getByText("Download"));

      expect(shellOpen).not.toHaveBeenCalled();
      expect(windowOpen).not.toHaveBeenCalled();

      windowOpen.mockRestore();
    });
  });
});
