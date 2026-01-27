/**
 * Update Checker Utility
 * Checks GitHub Releases for new versions and notifies users
 */

export interface UpdateInfo {
  currentVersion: string;
  latestVersion: string;
  isUpdateAvailable: boolean;
  releaseUrl: string;
  releaseNotes: string;
  publishedAt: string;
}

export interface UpdateCheckerOptions {
  owner: string;
  repo: string;
  currentVersion: string;
}

interface GitHubRelease {
  tag_name: string;
  html_url: string;
  body: string;
  published_at: string;
  draft: boolean;
  prerelease: boolean;
}

/**
 * Compare two semver version strings
 * Returns: 1 if v1 > v2, -1 if v1 < v2, 0 if equal
 */
function compareVersions(v1: string, v2: string): number {
  // Remove 'v' prefix if present
  const normalize = (v: string) => v.replace(/^v/, '');

  const parts1 = normalize(v1).split('.').map(Number);
  const parts2 = normalize(v2).split('.').map(Number);

  const maxLength = Math.max(parts1.length, parts2.length);

  for (let i = 0; i < maxLength; i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;

    if (p1 > p2) return 1;
    if (p1 < p2) return -1;
  }

  return 0;
}

/**
 * Check for updates from GitHub Releases
 */
export async function checkForUpdates(options: UpdateCheckerOptions): Promise<UpdateInfo> {
  const { owner, repo, currentVersion } = options;

  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/releases/latest`;

  const response = await fetch(apiUrl, {
    headers: {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': `${repo}-update-checker`,
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      // No releases yet
      return {
        currentVersion,
        latestVersion: currentVersion,
        isUpdateAvailable: false,
        releaseUrl: '',
        releaseNotes: '',
        publishedAt: '',
      };
    }
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  }

  const release: GitHubRelease = await response.json();

  // Skip draft and prerelease
  if (release.draft || release.prerelease) {
    return {
      currentVersion,
      latestVersion: currentVersion,
      isUpdateAvailable: false,
      releaseUrl: '',
      releaseNotes: '',
      publishedAt: '',
    };
  }

  const latestVersion = release.tag_name;
  const isUpdateAvailable = compareVersions(latestVersion, currentVersion) > 0;

  return {
    currentVersion,
    latestVersion,
    isUpdateAvailable,
    releaseUrl: release.html_url,
    releaseNotes: release.body || '',
    publishedAt: release.published_at,
  };
}

/**
 * Get the key for storing dismissed version in localStorage
 */
function getDismissedKey(repo: string): string {
  return `${repo}-dismissed-version`;
}

/**
 * Check if a version has been dismissed by the user
 */
export function isVersionDismissed(repo: string, version: string): boolean {
  try {
    const dismissed = localStorage.getItem(getDismissedKey(repo));
    return dismissed === version;
  } catch {
    return false;
  }
}

/**
 * Dismiss a version (user clicked "Skip this version")
 */
export function dismissVersion(repo: string, version: string): void {
  try {
    localStorage.setItem(getDismissedKey(repo), version);
  } catch {
    // Ignore localStorage errors
  }
}

/**
 * Clear dismissed version
 */
export function clearDismissedVersion(repo: string): void {
  try {
    localStorage.removeItem(getDismissedKey(repo));
  } catch {
    // Ignore localStorage errors
  }
}
