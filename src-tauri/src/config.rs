use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::OnceLock;

static CONFIG: OnceLock<std::sync::RwLock<AppConfig>> = OnceLock::new();

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct AppConfig {
    /// Number of threads for thumbnail generation
    /// If None, auto-calculate (80% of CPU logical cores)
    pub thumbnail_threads: Option<usize>,
}

impl AppConfig {
    /// Get config file path
    fn config_path() -> Option<PathBuf> {
        dirs::config_dir().map(|p| p.join("Glimpse").join("config.json"))
    }

    /// Load config
    pub fn load() -> Self {
        Self::config_path()
            .and_then(|path| fs::read_to_string(&path).ok())
            .and_then(|content| serde_json::from_str(&content).ok())
            .unwrap_or_default()
    }

    /// Save config
    pub fn save(&self) -> Result<(), String> {
        let path = Self::config_path().ok_or("Cannot find config directory")?;

        // Create directory
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }

        let content = serde_json::to_string_pretty(self).map_err(|e| e.to_string())?;
        fs::write(&path, content).map_err(|e| e.to_string())
    }
}

/// Get global config
pub fn get_config() -> AppConfig {
    CONFIG
        .get_or_init(|| std::sync::RwLock::new(AppConfig::load()))
        .read()
        .unwrap()
        .clone()
}

/// Update global config
pub fn update_config(config: AppConfig) -> Result<(), String> {
    config.save()?;

    if let Some(lock) = CONFIG.get() {
        let mut current = lock.write().unwrap();
        *current = config;
    }

    Ok(())
}

/// Get system CPU logical core count
pub fn get_cpu_count() -> usize {
    std::thread::available_parallelism()
        .map(|n| n.get())
        .unwrap_or(4)
}

/// Get number of threads for thumbnail generation
pub fn get_thumbnail_thread_count() -> usize {
    let config = get_config();
    let cpu_count = get_cpu_count();

    config.thumbnail_threads.unwrap_or_else(|| {
        // Default: 80% of CPU logical cores (minimum 2)
        calculate_default_threads(cpu_count)
    })
}

/// Calculate default thread count (80% of CPU logical cores, minimum 2)
pub fn calculate_default_threads(cpu_count: usize) -> usize {
    ((cpu_count as f64 * 0.8).round() as usize).max(2)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_app_config_default() {
        let config = AppConfig::default();
        assert!(config.thumbnail_threads.is_none());
    }

    #[test]
    fn test_app_config_serialization() {
        // None case
        let config = AppConfig::default();
        let json = serde_json::to_string(&config).unwrap();
        let parsed: AppConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(config.thumbnail_threads, parsed.thumbnail_threads);

        // Some value case
        let config = AppConfig {
            thumbnail_threads: Some(4),
        };
        let json = serde_json::to_string(&config).unwrap();
        let parsed: AppConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(config.thumbnail_threads, parsed.thumbnail_threads);
    }

    #[test]
    fn test_app_config_save_and_load() {
        let dir = tempdir().unwrap();
        let config_path = dir.path().join("config.json");

        // Save config
        let config = AppConfig {
            thumbnail_threads: Some(6),
        };
        let content = serde_json::to_string_pretty(&config).unwrap();
        std::fs::write(&config_path, &content).unwrap();

        // Load config
        let loaded_content = std::fs::read_to_string(&config_path).unwrap();
        let loaded: AppConfig = serde_json::from_str(&loaded_content).unwrap();

        assert_eq!(loaded.thumbnail_threads, Some(6));
    }

    #[test]
    fn test_get_cpu_count() {
        let count = get_cpu_count();
        // CPU core count should be at least 1
        assert!(count >= 1);
        // Usually 256 cores or less
        assert!(count <= 256);
    }

    #[test]
    fn test_calculate_default_threads() {
        // 1 core (minimum 2)
        assert_eq!(calculate_default_threads(1), 2);

        // 2 cores
        assert_eq!(calculate_default_threads(2), 2);

        // 4 cores (80% = 3.2 -> 3)
        assert_eq!(calculate_default_threads(4), 3);

        // 8 cores (80% = 6.4 -> 6)
        assert_eq!(calculate_default_threads(8), 6);

        // 10 cores (80% = 8)
        assert_eq!(calculate_default_threads(10), 8);

        // 16 cores (80% = 12.8 -> 13)
        assert_eq!(calculate_default_threads(16), 13);
    }

    #[test]
    fn test_calculate_default_threads_minimum() {
        // Minimum 2 threads guaranteed
        for cpu in 1..=3 {
            assert!(calculate_default_threads(cpu) >= 2);
        }
    }
}
