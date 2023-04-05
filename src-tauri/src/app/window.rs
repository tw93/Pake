use crate::app::config::PakeConfig;
use std::path::PathBuf;
use tauri::{App, TitleBarStyle, Window, WindowBuilder, WindowUrl};

pub fn get_window(app: &mut App, config: PakeConfig, _data_dir: PathBuf) -> Window {
    let window_config = config
        .windows
        .first()
        .expect("At least one window configuration is required");

    #[cfg(target_os = "macos")]
    let user_agent = config.user_agent.macos.as_str();
    #[cfg(target_os = "linux")]
    let user_agent = config.user_agent.linux.as_str();
    #[cfg(target_os = "windows")]
    let user_agent = config.user_agent.windows.as_str();

    let url = match window_config.url_type.as_str() {
        "web" => WindowUrl::App(window_config.url.parse().unwrap()),
        "local" => WindowUrl::App(PathBuf::from(&window_config.url)),
        _ => panic!("url type only can be web or local"),
    };

    let title_bar_style = if window_config.transparent {
        TitleBarStyle::Overlay
    } else {
        TitleBarStyle::Visible
    };

    let window_builder = WindowBuilder::new(app, "pake", url)
        .title("")
        .user_agent(user_agent)
        .resizable(window_config.resizable)
        .fullscreen(window_config.fullscreen)
        .title_bar_style(title_bar_style)
        .inner_size(window_config.width, window_config.height)
        .initialization_script(include_str!("../inject/style.js"))
        .initialization_script(include_str!("../inject/index.js"));

    #[cfg(not(target_os = "macos"))]
    {
        window_builder = window_builder.data_directory(_data_dir);
    }

    window_builder.build().unwrap()
}
