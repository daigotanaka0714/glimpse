// Glimpse ダウンロードページのボタンを最新版につなぐ（英語 / 日本語で共通）
//
// ボタンの href は、この JS が動かなくても最新リリースのページへ落ちるように
// HTML 側に書いてある。ここでは GitHub API から最新の公開リリースを引き、
// .dmg / -setup.exe へ直接つなぎ替える。リリースのたびにページを直さなくてよい。
(() => {
  const REPO = "daigotanaka0714/glimpse";
  const lang = document.documentElement.lang === "ja" ? "ja" : "en";

  const primary = document.getElementById("dl-primary");
  const secondary = document.getElementById("dl-secondary");
  const macOther = document.getElementById("dl-mac-other");
  const isWindows = /Windows/i.test(navigator.userAgent);

  // Windows から来た人には Windows 版を大きいボタンにして先頭へ。
  if (isWindows) {
    secondary.classList.replace("btn-secondary", "btn-primary");
    primary.classList.replace("btn-primary", "btn-secondary");
    primary.parentElement.prepend(secondary);
  }

  // 日本語環境のブラウザで英語ページを開いた人にだけ、日本語ページを案内する。
  // 自動で飛ばさないのは、英語を読みたくて来た人の邪魔をしないため。
  const hint = document.getElementById("lang-hint");
  if (hint && (navigator.language || "").toLowerCase().startsWith("ja")) {
    hint.hidden = false;
  }

  const fmtDate = (iso) => {
    const d = new Date(iso);
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}`;
  };

  const TEXT = {
    ja: (v, d, url) =>
      `最新版 ${v}（${d}）／ <a href="${url}">変更内容</a> ／ 無料 ／ macOS 10.15 以降・Windows 10 以降`,
    en: (v, d, url) =>
      `Latest ${v} (${d}) · <a href="${url}">What’s new</a> · Free · macOS 10.15+ · Windows 10+`,
  };

  const load = async () => {
    // Mac のチップはブラウザから確実には分からない。既定は利用者の多い
    // Apple Silicon とし、Chromium 系で Intel と判定できたときだけ切り替える。
    let macArch = "aarch64";
    if (!isWindows && navigator.userAgentData?.getHighEntropyValues) {
      try {
        const { architecture } = await navigator.userAgentData.getHighEntropyValues(["architecture"]);
        if (architecture === "x86") macArch = "x64";
      } catch {}
    }

    // releases/latest は下書きとプレリリースを含まない。公開した版だけが出る。
    let release;
    try {
      const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
        headers: { Accept: "application/vnd.github+json" },
      });
      if (!res.ok) return;
      release = await res.json();
    } catch {
      return;
    }

    const assets = release.assets || [];
    const find = (re) => assets.find((a) => re.test(a.name));
    const mac = { aarch64: find(/_aarch64\.dmg$/), x64: find(/_x64\.dmg$/) };
    const win = find(/_x64-setup\.exe$/);
    const other = macArch === "aarch64" ? "x64" : "aarch64";

    if (mac[macArch]) primary.href = mac[macArch].browser_download_url;
    if (mac[other]) macOther.href = mac[other].browser_download_url;
    if (win) secondary.href = win.browser_download_url;

    document.getElementById("dl-primary-note").textContent =
      macArch === "aarch64" ? "Apple Silicon" : "Intel";
    document.getElementById("dl-mac-other-label").textContent =
      macArch === "aarch64"
        ? lang === "ja" ? "Intel 搭載の Mac は" : "Intel Mac?"
        : lang === "ja" ? "Apple Silicon の Mac は" : "Apple Silicon Mac?";

    document.getElementById("release-meta").innerHTML = TEXT[lang](
      release.tag_name,
      fmtDate(release.published_at),
      release.html_url,
    );
  };

  load();
})();
