/**
 * Type definitions for internationalization
 */

export type Language = 'en' | 'ja';

export interface Translations {
  // App
  app: {
    name: string;
    tagline: string;
    version: string;
  };

  // Common
  common: {
    cancel: string;
    close: string;
    save: string;
    delete: string;
    confirm: string;
    loading: string;
    error: string;
    success: string;
  };

  // Empty State
  emptyState: {
    title: string;
    description: string;
    openFolder: string;
    shortcutHint: string;
  };

  // Status Bar
  statusBar: {
    navigation: string;
    reject: string;
    detailView: string;
    openFolder: string;
    multiSelect: string;
    selected: string;
    rejected: string;
  };

  // Compare View
  compareView: {
    navigateLeft: string;
    navigateRight: string;
    rejectLeft: string;
    rejectRight: string;
    close: string;
  };

  // Gallery View
  galleryView: {
    navigate: string;
    reject: string;
    close: string;
    adopted: string;
    rejected: string;
    selected: string;
    clear: string;
    markRejected: string;
    markAdopted: string;
    clickMultiSelect: string;
    clickRangeSelect: string;
  };

  // Detail View
  detailView: {
    rotateLeft: string;
    rotateRight: string;
    showExif: string;
    exifInfo: string;
    camera: string;
    lens: string;
    focalLength: string;
    aperture: string;
    shutterSpeed: string;
    iso: string;
    exposureComp: string;
    dateTaken: string;
    resolution: string;
    noExif: string;
    reject: string;
    rejected: string;
  };

  // Batch Actions
  batchActions: {
    selected: string;
    clear: string;
    markRejected: string;
    markAdopted: string;
    batchReject: string;
    batchClear: string;
    all: string;
    adopted: string;
    rejected: string;
    clearSelection: string;
    toggleReject: string;
  };

  // Settings
  settings: {
    title: string;
    performance: {
      title: string;
      description: string;
      systemInfo: string;
      cores: string;
      threadsInUse: string;
      cpuUsage: string;
      highLoad: string;
      normal: string;
      powerSaving: string;
      processingThreads: string;
      autoRecommended: string;
      info: string;
      recommended: string;
    };
    storage: {
      title: string;
      description: string;
      usage: string;
      sessions: string;
      thumbnailCache: string;
      labelData: string;
      labels: string;
      clear: string;
      clearing: string;
      confirmDelete: string;
      cacheDeleteWarning: string;
      labelDeleteWarning: string;
      cacheCleared: string;
      labelsCleared: string;
      clearFailed: string;
    };
    about: {
      title: string;
      description: string;
      updates: string;
      newVersionAvailable: string;
      latestVersion: string;
      downloadUpdate: string;
      checkForUpdates: string;
      checking: string;
      checkFailed: string;
      github: string;
      reportIssue: string;
      sponsor: string;
      sponsorDescription: string;
      language: string;
      languageDescription: string;
    };
  };

  // Feedback Dialog
  feedback: {
    title: string;
    selectLanguage: string;
    selectMethod: string;
    githubIssue: string;
    githubIssueDesc: string;
    feedbackForm: string;
    feedbackFormDesc: string;
    english: string;
    japanese: string;
    reportInEnglish: string;
    reportInJapanese: string;
  };

  // Help Dialog
  help: {
    title: string;
    subtitle: string;
    quickTip: string;
    pressToOpen: string;
    sections: {
      overview: {
        title: string;
      };
      keyboard: {
        title: string;
      };
      settings: {
        title: string;
      };
      raw: {
        title: string;
      };
    };
  };

  // Keyboard Shortcuts
  shortcuts: {
    navigation: string;
    previous: string;
    next: string;
    above: string;
    below: string;
    first: string;
    last: string;
    pageUp: string;
    pageDown: string;
    labelsViews: string;
    toggleReject: string;
    enterDetail: string;
    exitView: string;
    enterCompare: string;
    enterGallery: string;
    fileOperations: string;
    openFolder: string;
    export: string;
    multiSelect: string;
    toggleSelection: string;
    rangeSelection: string;
  };

  // Header
  header: {
    openFolder: string;
    reload: string;
    generatingThumbnails: string;
    total: string;
    photos: string;
    adopted: string;
    rejected: string;
    export: string;
    help: string;
    settings: string;
  };

  // Toolbar
  toolbar: {
    all: string;
    adopted: string;
    rejected: string;
    light: string;
    dark: string;
    gridView: string;
    galleryView: string;
    galleryViewHint: string;
  };

  // Export
  export: {
    title: string;
    destination: string;
    selectFolder: string;
    mode: string;
    copy: string;
    move: string;
    copyDescription: string;
    moveDescription: string;
    exporting: string;
    success: string;
    failed: string;
  };

  // Filters
  filters: {
    noMatching: string;
    changeFilter: string;
  };
}
