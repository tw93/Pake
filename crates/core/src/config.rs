use crate::inject::InjectConfig;
use crate::shortcut::ShortcutConfig;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// Top-level application configuration written to `pake.json` at build time.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AppConfig {
    /// Display name and bundle identifier base.
    pub name: String,
    /// Target website URL loaded on startup.
    pub url: String,
    /// Optional custom window title. Defaults to `name`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    /// Window width in logical pixels.
    #[serde(default = "default_width")]
    pub width: u32,
    /// Window height in logical pixels.
    #[serde(default = "default_height")]
    pub height: u32,
    /// Minimum window width.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub min_width: Option<u32>,
    /// Minimum window height.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub min_height: Option<u32>,
    /// Path to icon file (.png/.ico/.icns).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub icon: Option<PathBuf>,
    /// Hide the native title bar (frameless window with drag region).
    #[serde(default)]
    pub hide_title_bar: bool,
    /// Start maximized.
    #[serde(default)]
    pub maximize: bool,
    /// Incognito mode: no persistent cookies/storage.
    #[serde(default)]
    pub incognito: bool,
    /// Allow multiple windows.
    #[serde(default)]
    pub multi_window: bool,
    /// Open external links in the system browser.
    #[serde(default = "default_true")]
    pub open_external_links_in_browser: bool,
    /// User agent override.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub user_agent: Option<String>,
    /// Show icon in the system tray.
    #[serde(default)]
    pub system_tray: bool,
    /// JavaScript/CSS injection settings.
    #[serde(default)]
    pub inject: InjectConfig,
    /// Keyboard shortcut overrides.
    #[serde(default)]
    pub shortcuts: ShortcutConfig,
}

impl AppConfig {
    pub fn new(name: impl Into<String>, url: impl Into<String>) -> Self {
        Self {
            name: name.into(),
            url: url.into(),
            title: None,
            width: default_width(),
            height: default_height(),
            min_width: None,
            min_height: None,
            icon: None,
            hide_title_bar: false,
            maximize: false,
            incognito: false,
            multi_window: false,
            open_external_links_in_browser: true,
            user_agent: None,
            system_tray: false,
            inject: InjectConfig::default(),
            shortcuts: ShortcutConfig::default(),
        }
    }

    pub fn display_title(&self) -> &str {
        self.title.as_deref().unwrap_or(&self.name)
    }

    pub fn identifier(&self) -> String {
        let slug: String = self
            .name
            .chars()
            .map(|c| {
                if c.is_ascii_alphanumeric() {
                    c.to_ascii_lowercase()
                } else {
                    '-'
                }
            })
            .collect();
        format!("com.webpake.{}", slug.trim_matches('-'))
    }
}

fn default_width() -> u32 {
    1200
}

fn default_height() -> u32 {
    800
}

fn default_true() -> bool {
    true
}

/// CLI-facing build options (superset of runtime config).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BuildOptions {
    #[serde(flatten)]
    pub app: AppConfig,
    /// Target platform override: macos, windows, linux.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub target: Option<String>,
    /// Output directory for built artifacts.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub output_dir: Option<std::path::PathBuf>,
    /// Skip `cargo tauri build` and only generate config files.
    #[serde(default)]
    pub config_only: bool,
    /// Development mode: run `cargo tauri dev` instead of build.
    #[serde(default)]
    pub dev: bool,
}

impl Default for BuildOptions {
    fn default() -> Self {
        Self {
            app: AppConfig::new("WebPake", "https://example.com"),
            target: None,
            output_dir: None,
            config_only: false,
            dev: false,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn identifier_slugifies_name() {
        let config = AppConfig::new("GitHub App", "https://github.com");
        assert_eq!(config.identifier(), "com.webpake.github-app");
    }
}
