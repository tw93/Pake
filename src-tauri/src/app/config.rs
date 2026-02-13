use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct WindowConfig {
    pub url: String,
    pub hide_title_bar: bool,
    pub fullscreen: bool,
    pub maximize: bool,
    pub width: f64,
    pub height: f64,
    pub resizable: bool,
    pub url_type: String,
    pub always_on_top: bool,
    pub dark_mode: bool,
    pub disabled_web_shortcuts: bool,
    pub activation_shortcut: String,
    pub hide_on_close: bool,
    pub incognito: bool,
    pub title: Option<String>,
    pub enable_wasm: bool,
    pub enable_drag_drop: bool,
    #[serde(default)]
    pub new_window: bool,
    pub start_to_tray: bool,
    #[serde(default)]
    pub force_internal_navigation: bool,
    #[serde(default = "default_zoom")]
    pub zoom: u32,
    #[serde(default)]
    pub min_width: f64,
    #[serde(default)]
    pub min_height: f64,
    #[serde(default)]
    pub ignore_certificate_errors: bool,
}

fn default_zoom() -> u32 {
    100
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PlatformSpecific<T> {
    pub macos: T,
    pub linux: T,
    pub windows: T,
}

impl<T> PlatformSpecific<T> {
    pub const fn get(&self) -> &T {
        #[cfg(target_os = "macos")]
        let platform = &self.macos;
        #[cfg(target_os = "linux")]
        let platform = &self.linux;
        #[cfg(target_os = "windows")]
        let platform = &self.windows;

        platform
    }
}

impl<T> PlatformSpecific<T>
where
    T: Copy,
{
    pub const fn copied(&self) -> T {
        *self.get()
    }
}

pub type UserAgent = PlatformSpecific<String>;
pub type FunctionON = PlatformSpecific<bool>;

#[derive(Debug, Serialize, Deserialize)]
pub struct PakeConfig {
    pub windows: Vec<WindowConfig>,
    pub user_agent: UserAgent,
    pub system_tray: FunctionON,
    pub system_tray_path: String,
    pub proxy_url: String,
    #[serde(default)]
    pub multi_instance: bool,
}

impl PakeConfig {
    pub fn show_system_tray(&self) -> bool {
        self.system_tray.copied()
    }
}
