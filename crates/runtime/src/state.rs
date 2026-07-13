use std::path::PathBuf;
use webpake_core::{load_config, AppConfig};

/// Shared application state loaded from `pake.json`.
#[derive(Debug, Clone)]
pub struct AppState {
    pub config: AppConfig,
    #[allow(dead_code)]
    pub config_path: PathBuf,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            config: AppConfig::new("WebPake", "https://example.com"),
            config_path: PathBuf::from("pake.json"),
        }
    }
}

impl AppState {
    pub fn load() -> Option<Self> {
        let candidates = [
            PathBuf::from("pake.json"),
            PathBuf::from("crates/runtime/pake.json"),
        ];

        for path in candidates {
            if path.exists() {
                if let Ok(config) = load_config(&path) {
                    return Some(Self {
                        config,
                        config_path: path,
                    });
                }
            }
        }
        None
    }

    pub fn home_url(&self) -> &str {
        &self.config.url
    }
}
