import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock Tauri APIs
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
  convertFileSrc: vi.fn((path: string) => `asset://localhost/${encodeURIComponent(path)}`),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
}));

// Mock i18n
vi.mock('@/i18n', () => ({
  useI18n: () => ({
    language: 'en',
    setLanguage: vi.fn(),
    t: {
      app: { name: 'Glimpse', tagline: 'High-speed photo checker', version: 'Version' },
      common: { cancel: 'Cancel', close: 'Close', save: 'Save', delete: 'Delete', confirm: 'Confirm', loading: 'Loading...', error: 'Error', success: 'Success' },
      emptyState: { title: 'Glimpse', description: 'High-speed photo checker\nSelect a folder', openFolder: 'Open Folder', shortcutHint: 'or' },
      statusBar: { navigation: 'Navigate', reject: 'Reject', detailView: 'Detail view', openFolder: 'Open folder', multiSelect: 'Multi-select', selected: 'selected', rejected: 'Rejected' },
      compareView: { navigateLeft: 'navigate left', navigateRight: 'navigate right', rejectLeft: 'reject left', rejectRight: 'reject right', close: 'close' },
      galleryView: { navigate: 'Navigate', reject: 'Reject', close: 'Close', adopted: 'Adopted', rejected: 'Rejected', selected: 'selected', clear: 'Clear', markRejected: 'Mark Rejected', markAdopted: 'Mark Adopted', clickMultiSelect: 'Click multi', clickRangeSelect: 'Click range' },
      toolbar: { all: 'All', adopted: 'Adopted', rejected: 'Rejected', light: 'Light', dark: 'Dark', gridView: 'Grid View', galleryView: 'Gallery View', galleryViewHint: 'Select an image first' },
      detailView: { rotateLeft: 'Rotate left', rotateRight: 'Rotate right', showExif: 'Show EXIF', exifInfo: 'EXIF Info', camera: 'Camera', lens: 'Lens', focalLength: 'Focal Length', aperture: 'Aperture', shutterSpeed: 'Shutter Speed', iso: 'ISO', exposureComp: 'Exposure Comp.', dateTaken: 'Date Taken', resolution: 'Resolution', noExif: 'No EXIF', reject: 'Reject', rejected: 'Rejected' },
      batchActions: { selected: 'selected', clear: 'Clear', markRejected: 'Mark Rejected', markAdopted: 'Mark Adopted', batchReject: 'Batch Reject', batchClear: 'Batch Clear', all: 'All', adopted: 'Adopted', rejected: 'Rejected', clearSelection: 'Clear selection', toggleReject: 'Toggle reject' },
      settings: {
        title: 'Settings',
        performance: { title: 'Performance', description: 'Adjust speed', systemInfo: 'System Info', cores: 'cores', threadsInUse: 'threads in use', cpuUsage: 'CPU Usage', highLoad: 'High Load', normal: 'Normal', powerSaving: 'Power Saving', processingThreads: 'Threads', autoRecommended: 'Auto', info: 'Info', recommended: 'Recommended' },
        storage: { title: 'Storage', description: 'Manage storage', usage: 'Usage', sessions: 'sessions', thumbnailCache: 'Cache', labelData: 'Labels', labels: 'labels', clear: 'Clear', clearing: 'Clearing...', confirmDelete: 'Confirm', cacheDeleteWarning: 'Warning', labelDeleteWarning: 'Warning', cacheCleared: 'Cleared', labelsCleared: 'Cleared', clearFailed: 'Failed' },
        about: { title: 'About', description: 'Info', updates: 'Updates', newVersionAvailable: 'New version', latestVersion: 'Latest', downloadUpdate: 'Download', checkForUpdates: 'Check', checking: 'Checking...', checkFailed: 'Failed', github: 'GitHub', reportIssue: 'Report', sponsor: 'Sponsor', sponsorDescription: 'Support', language: 'Language', languageDescription: 'Choose' }
      },
      feedback: { title: 'Report', selectLanguage: 'Select', selectMethod: 'Select', githubIssue: 'GitHub', githubIssueDesc: 'For devs', feedbackForm: 'Form', feedbackFormDesc: 'Easy', english: 'English', japanese: 'Japanese', reportInEnglish: 'English', reportInJapanese: 'Japanese' },
      help: { title: 'Help', subtitle: 'Guide', quickTip: 'Tip', pressToOpen: 'Press ?', sections: { overview: { title: 'Overview' }, keyboard: { title: 'Keyboard' }, settings: { title: 'Settings' }, raw: { title: 'RAW' } } },
      shortcuts: { navigation: 'Navigation', previous: 'Previous', next: 'Next', above: 'Above', below: 'Below', first: 'First', last: 'Last', pageUp: 'Page Up', pageDown: 'Page Down', labelsViews: 'Labels', toggleReject: 'Toggle', enterDetail: 'Detail', exitView: 'Exit', enterCompare: 'Compare', enterGallery: 'Gallery', fileOperations: 'File', openFolder: 'Open', export: 'Export', multiSelect: 'Multi', toggleSelection: 'Toggle', rangeSelection: 'Range' },
      header: { openFolder: 'Open Folder', reload: 'Reload', generatingThumbnails: 'Generating thumbnails...', total: 'Total', photos: 'photos', adopted: 'Adopted', rejected: 'Rejected', export: 'Export', help: 'Help', settings: 'Settings' },
      export: { title: 'Export', destination: 'Destination', selectFolder: 'Select', mode: 'Mode', copy: 'Copy', move: 'Move', copyDescription: 'Keep', moveDescription: 'Move', exporting: 'Exporting...', success: 'Success', failed: 'Failed' },
      filters: { noMatching: 'No match', changeFilter: 'Change filter' }
    }
  }),
  useTranslation: () => ({
    app: { name: 'Glimpse', tagline: 'High-speed photo checker', version: 'Version' },
    common: { cancel: 'Cancel', close: 'Close', save: 'Save', delete: 'Delete', confirm: 'Confirm', loading: 'Loading...', error: 'Error', success: 'Success' },
    emptyState: { title: 'Glimpse', description: 'High-speed photo checker\nSelect a folder', openFolder: 'Open Folder', shortcutHint: 'or' },
    statusBar: { navigation: 'Navigate', reject: 'Reject', detailView: 'Detail view', openFolder: 'Open folder', multiSelect: 'Multi-select', selected: 'selected', rejected: 'Rejected' },
    compareView: { navigateLeft: 'navigate left', navigateRight: 'navigate right', rejectLeft: 'reject left', rejectRight: 'reject right', close: 'close' },
    galleryView: { navigate: 'Navigate', reject: 'Reject', close: 'Close', adopted: 'Adopted', rejected: 'Rejected', selected: 'selected', clear: 'Clear', markRejected: 'Mark Rejected', markAdopted: 'Mark Adopted', clickMultiSelect: 'Click multi', clickRangeSelect: 'Click range' },
    toolbar: { all: 'All', adopted: 'Adopted', rejected: 'Rejected', light: 'Light', dark: 'Dark', gridView: 'Grid View', galleryView: 'Gallery View', galleryViewHint: 'Select an image first' },
    detailView: { rotateLeft: 'Rotate left', rotateRight: 'Rotate right', showExif: 'Show EXIF', exifInfo: 'EXIF Info', camera: 'Camera', lens: 'Lens', focalLength: 'Focal Length', aperture: 'Aperture', shutterSpeed: 'Shutter Speed', iso: 'ISO', exposureComp: 'Exposure Comp.', dateTaken: 'Date Taken', resolution: 'Resolution', noExif: 'No EXIF', reject: 'Reject', rejected: 'Rejected' },
    batchActions: { selected: 'selected', clear: 'Clear', markRejected: 'Mark Rejected', markAdopted: 'Mark Adopted', batchReject: 'Batch Reject', batchClear: 'Batch Clear', all: 'All', adopted: 'Adopted', rejected: 'Rejected', clearSelection: 'Clear selection', toggleReject: 'Toggle reject' },
    settings: {
      title: 'Settings',
      performance: { title: 'Performance', description: 'Adjust speed', systemInfo: 'System Info', cores: 'cores', threadsInUse: 'threads in use', cpuUsage: 'CPU Usage', highLoad: 'High Load', normal: 'Normal', powerSaving: 'Power Saving', processingThreads: 'Threads', autoRecommended: 'Auto', info: 'Info', recommended: 'Recommended' },
      storage: { title: 'Storage', description: 'Manage storage', usage: 'Usage', sessions: 'sessions', thumbnailCache: 'Cache', labelData: 'Labels', labels: 'labels', clear: 'Clear', clearing: 'Clearing...', confirmDelete: 'Confirm', cacheDeleteWarning: 'Warning', labelDeleteWarning: 'Warning', cacheCleared: 'Cleared', labelsCleared: 'Cleared', clearFailed: 'Failed' },
      about: { title: 'About', description: 'Info', updates: 'Updates', newVersionAvailable: 'New version', latestVersion: 'Latest', downloadUpdate: 'Download', checkForUpdates: 'Check', checking: 'Checking...', checkFailed: 'Failed', github: 'GitHub', reportIssue: 'Report', sponsor: 'Sponsor', sponsorDescription: 'Support', language: 'Language', languageDescription: 'Choose' }
    },
    feedback: { title: 'Report', selectLanguage: 'Select', selectMethod: 'Select', githubIssue: 'GitHub', githubIssueDesc: 'For devs', feedbackForm: 'Form', feedbackFormDesc: 'Easy', english: 'English', japanese: 'Japanese', reportInEnglish: 'English', reportInJapanese: 'Japanese' },
    help: { title: 'Help', subtitle: 'Guide', quickTip: 'Tip', pressToOpen: 'Press ?', sections: { overview: { title: 'Overview' }, keyboard: { title: 'Keyboard' }, settings: { title: 'Settings' }, raw: { title: 'RAW' } } },
    shortcuts: { navigation: 'Navigation', previous: 'Previous', next: 'Next', above: 'Above', below: 'Below', first: 'First', last: 'Last', pageUp: 'Page Up', pageDown: 'Page Down', labelsViews: 'Labels', toggleReject: 'Toggle', enterDetail: 'Detail', exitView: 'Exit', enterCompare: 'Compare', enterGallery: 'Gallery', fileOperations: 'File', openFolder: 'Open', export: 'Export', multiSelect: 'Multi', toggleSelection: 'Toggle', rangeSelection: 'Range' },
    header: { openFolder: 'Open Folder', reload: 'Reload', generatingThumbnails: 'Generating thumbnails...', total: 'Total', photos: 'photos', adopted: 'Adopted', rejected: 'Rejected', export: 'Export', help: 'Help', settings: 'Settings' },
    export: { title: 'Export', destination: 'Destination', selectFolder: 'Select', mode: 'Mode', copy: 'Copy', move: 'Move', copyDescription: 'Keep', moveDescription: 'Move', exporting: 'Exporting...', success: 'Success', failed: 'Failed' },
    filters: { noMatching: 'No match', changeFilter: 'Change filter' }
  }),
  I18nProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock platform utilities
vi.mock('@/utils/platform', () => ({
  detectPlatform: () => 'mac',
  isMac: () => true,
  getModifierKey: () => '⌘',
  getModifierKeyText: () => 'Cmd',
  formatShortcut: (key: string) => `⌘+${key}`,
}));

// Mock window.matchMedia for responsive tests
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));
