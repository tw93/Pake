#[cfg(target_os = "macos")]
pub mod auth;
pub mod autostart;
#[cfg(any(target_os = "linux", test))]
pub mod color_scheme;
pub mod config;
#[cfg(target_os = "windows")]
pub mod download;
pub mod invoke;
#[cfg(target_os = "linux")]
pub mod media_permission;
#[cfg(target_os = "macos")]
pub mod menu;
pub mod navigation;
pub mod notification;
#[cfg(any(target_os = "linux", target_os = "windows", test))]
pub mod recovery;
pub mod setup;
#[cfg(target_os = "macos")]
pub mod tab_bar;
pub mod window;
