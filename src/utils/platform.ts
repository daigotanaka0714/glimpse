/**
 * Platform detection and keyboard modifier utilities
 */

export type Platform = 'mac' | 'windows' | 'linux';

/**
 * Detect the current operating system
 */
export function detectPlatform(): Platform {
  const userAgent = navigator.userAgent.toLowerCase();

  if (userAgent.includes('mac')) {
    return 'mac';
  }
  if (userAgent.includes('win')) {
    return 'windows';
  }
  return 'linux';
}

/**
 * Check if the current platform is macOS
 */
export function isMac(): boolean {
  return detectPlatform() === 'mac';
}

/**
 * Get the appropriate modifier key symbol for the current platform
 * @returns '⌘' on macOS, 'Ctrl' on Windows/Linux
 */
export function getModifierKey(): string {
  return isMac() ? '⌘' : 'Ctrl';
}

/**
 * Get the modifier key for display in UI (with proper formatting)
 * @returns 'Cmd' on macOS, 'Ctrl' on Windows/Linux
 */
export function getModifierKeyText(): string {
  return isMac() ? 'Cmd' : 'Ctrl';
}

/**
 * Format a keyboard shortcut for display
 * @param key - The key (e.g., 'O', 'E', 'S')
 * @param useSymbol - Whether to use symbol (⌘) or text (Cmd)
 * @returns Formatted shortcut string (e.g., '⌘+O' or 'Ctrl+O')
 */
export function formatShortcut(key: string, useSymbol = true): string {
  const modifier = useSymbol ? getModifierKey() : getModifierKeyText();
  return `${modifier}+${key}`;
}
