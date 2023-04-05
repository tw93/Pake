use crate::app::config::PakeConfig;
use tauri::{App, TitleBarStyle, Window, WindowBuilder, WindowUrl};

pub fn get_window(app: &mut App, config: PakeConfig, _data_dir: std::path::PathBuf) -> Window {
    let window_config = config.windows.first().unwrap();
    let user_agent = config.user_agent;
    let url = match window_config.url_type.as_str() {
        "web" => WindowUrl::App(window_config.url.parse().unwrap()),
        "local" => WindowUrl::App(std::path::PathBuf::from(&window_config.url)),
        _ => panic!("url type only can be web or local"),
    };
    #[cfg(target_os = "macos")]
    let window = WindowBuilder::new(app, "pake", url)
        .title("")
        .user_agent(user_agent.macos.as_str())
        .resizable(window_config.resizable)
        .fullscreen(window_config.fullscreen)
        //用于隐藏头部
        .title_bar_style(if window_config.transparent {
            TitleBarStyle::Overlay
        } else {
            TitleBarStyle::Visible
        })
        .inner_size(window_config.width, window_config.height)
        .initialization_script(include_str!("../inject.js"));

    #[cfg(not(target_os = "macos"))]
    let window = {
        #[cfg(target_os = "linux")]
        let user_agent = user_agent.linux.as_str();
        #[cfg(target_os = "windows")]
        let user_agent = user_agent.windows.as_str();
        WindowBuilder::new(app, "pake", url)
            .title("")
            .data_directory(_data_dir)
            .resizable(window_config.resizable)
            .fullscreen(window_config.fullscreen)
            .user_agent(user_agent)
            .inner_size(window_config.width, window_config.height)
            .initialization_script(include_str!("../inject.js"))
    };
    window.build().unwrap()
}
