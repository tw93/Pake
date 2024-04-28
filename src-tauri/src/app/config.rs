use serde::Deserialize;

#[derive(Debug, Deserialize)]
pub struct WindowConfig {
    pub url: String,
    pub transparent: bool,
    pub fullscreen: bool,
    pub width: f64,
    pub height: f64,
    pub resizable: bool,
    pub url_type: String,
}

#[derive(Debug, Deserialize)]
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

#[derive(Debug, Deserialize)]
pub struct PakeConfig {
    pub windows: Vec<WindowConfig>,
    pub user_agent: UserAgent,
    pub system_tray: FunctionON,
}

impl PakeConfig {
    pub fn show_system_tray(&self) -> bool {
        self.system_tray.copied()
    }
}
