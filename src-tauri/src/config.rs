use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::OnceLock;

static CONFIG: OnceLock<std::sync::RwLock<AppConfig>> = OnceLock::new();

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    /// サムネイル生成に使用するスレッド数
    /// None の場合は自動計算（CPU論理コア数の80%）
    pub thumbnail_threads: Option<usize>,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            thumbnail_threads: None,
        }
    }
}

impl AppConfig {
    /// 設定ファイルのパスを取得
    fn config_path() -> Option<PathBuf> {
        dirs::config_dir().map(|p| p.join("Glimpse").join("config.json"))
    }

    /// 設定を読み込み
    pub fn load() -> Self {
        Self::config_path()
            .and_then(|path| fs::read_to_string(&path).ok())
            .and_then(|content| serde_json::from_str(&content).ok())
            .unwrap_or_default()
    }

    /// 設定を保存
    pub fn save(&self) -> Result<(), String> {
        let path = Self::config_path().ok_or("Cannot find config directory")?;

        // ディレクトリを作成
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }

        let content = serde_json::to_string_pretty(self).map_err(|e| e.to_string())?;
        fs::write(&path, content).map_err(|e| e.to_string())
    }
}

/// グローバル設定を取得
pub fn get_config() -> AppConfig {
    CONFIG
        .get_or_init(|| std::sync::RwLock::new(AppConfig::load()))
        .read()
        .unwrap()
        .clone()
}

/// グローバル設定を更新
pub fn update_config(config: AppConfig) -> Result<(), String> {
    config.save()?;

    if let Some(lock) = CONFIG.get() {
        let mut current = lock.write().unwrap();
        *current = config;
    }

    Ok(())
}

/// システムのCPU論理コア数を取得
pub fn get_cpu_count() -> usize {
    std::thread::available_parallelism()
        .map(|n| n.get())
        .unwrap_or(4)
}

/// サムネイル生成に使用するスレッド数を取得
pub fn get_thumbnail_thread_count() -> usize {
    let config = get_config();
    let cpu_count = get_cpu_count();

    config.thumbnail_threads.unwrap_or_else(|| {
        // デフォルト: CPU論理コア数の80%（最低2）
        calculate_default_threads(cpu_count)
    })
}

/// デフォルトのスレッド数を計算（CPU論理コア数の80%、最低2）
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
        // Noneの場合
        let config = AppConfig::default();
        let json = serde_json::to_string(&config).unwrap();
        let parsed: AppConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(config.thumbnail_threads, parsed.thumbnail_threads);

        // Some値の場合
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

        // 設定を保存
        let config = AppConfig {
            thumbnail_threads: Some(6),
        };
        let content = serde_json::to_string_pretty(&config).unwrap();
        std::fs::write(&config_path, &content).unwrap();

        // 設定を読み込み
        let loaded_content = std::fs::read_to_string(&config_path).unwrap();
        let loaded: AppConfig = serde_json::from_str(&loaded_content).unwrap();

        assert_eq!(loaded.thumbnail_threads, Some(6));
    }

    #[test]
    fn test_get_cpu_count() {
        let count = get_cpu_count();
        // CPUコア数は少なくとも1以上
        assert!(count >= 1);
        // 通常は256コア以下
        assert!(count <= 256);
    }

    #[test]
    fn test_calculate_default_threads() {
        // 1コアの場合（最低2）
        assert_eq!(calculate_default_threads(1), 2);

        // 2コアの場合
        assert_eq!(calculate_default_threads(2), 2);

        // 4コアの場合（80% = 3.2 -> 3）
        assert_eq!(calculate_default_threads(4), 3);

        // 8コアの場合（80% = 6.4 -> 6）
        assert_eq!(calculate_default_threads(8), 6);

        // 10コアの場合（80% = 8）
        assert_eq!(calculate_default_threads(10), 8);

        // 16コアの場合（80% = 12.8 -> 13）
        assert_eq!(calculate_default_threads(16), 13);
    }

    #[test]
    fn test_calculate_default_threads_minimum() {
        // 最低2スレッドが保証される
        for cpu in 1..=3 {
            assert!(calculate_default_threads(cpu) >= 2);
        }
    }
}
