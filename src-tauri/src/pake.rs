pub mod pake {
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
    pub struct UserAgent {
        pub macos: String,
        pub linux: String,
        pub windows: String,
    }

    #[derive(Debug, Deserialize)]
    pub struct FunctionON {
        pub macos: bool,
        pub linux: bool,
        pub windows: bool,
    }

    #[derive(Debug, Deserialize)]
    pub struct PakeConfig {
        pub windows: Vec<WindowConfig>,
        pub user_agent: UserAgent,
        pub menu: FunctionON,
        pub system_tray: FunctionON,
    }

    impl PakeConfig {
        pub fn show_menu(&self) -> bool {
            #[cfg(target_os = "macos")]
            let menu_status = self.menu.macos;
            #[cfg(target_os = "linux")]
            let menu_status = self.menu.linux;
            #[cfg(target_os = "windows")]
            let menu_status = self.menu.windows;
            menu_status
        }

        pub fn show_system_tray(&self) -> bool {
            #[cfg(target_os = "macos")]
            let tray_status = self.system_tray.macos;
            #[cfg(target_os = "linux")]
            let tary_status = self.system_tray.linux;
            #[cfg(target_os = "windows")]
            let tary_status = self.system_tray.windows;
            tary_status
        }
    }
}
