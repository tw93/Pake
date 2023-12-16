use crate::app::config::PakeConfig;
use std::path::PathBuf;
use tauri::{App, GlobalShortcutManager, Window, WindowBuilder, WindowUrl};

#[cfg(target_os = "macos")]
use tauri::TitleBarStyle;
use crate::app::menu::{windows_show_handle, windows_top_handle};

pub fn get_window(app: &mut App, config: PakeConfig, _data_dir: PathBuf) -> Window {
    let window_config = config
        .windows
        .first()
        .expect("At least one window configuration is required");

    let user_agent = config.user_agent.get();

    let url = match window_config.url_type.as_str() {
        "web" => WindowUrl::App(window_config.url.parse().unwrap()),
        "local" => WindowUrl::App(PathBuf::from(&window_config.url)),
        _ => panic!("url type can only be web or local"),
    };

    let mut window_builder = WindowBuilder::new(app, "pake", url)
        .title("")
        .user_agent(user_agent)
        .visible(false) // Prevent initial shaking
        .resizable(window_config.resizable)
        .fullscreen(window_config.fullscreen)
        .inner_size(window_config.width, window_config.height)
        .disable_file_drop_handler()
        .initialization_script(include_str!("../inject/component.js"))
        .initialization_script(include_str!("../inject/event.js"))
        .initialization_script(include_str!("../inject/style.js"))
        //This is necessary to allow for file injection by external developers for customization purposes.
        .initialization_script(include_str!("../inject/custom.js"));

    let mut short_cut = app.global_shortcut_manager(); //获取快捷键管理实例
    let app_handler = app.handle();

    let _ = short_cut.register(config.shortcut.show_hide.get(), move || {
        windows_show_handle(&app_handler)
    });

    let app_handler = app.handle();
    let _ = short_cut.register(config.shortcut.top.get(), move || {
        windows_top_handle(&app_handler)
    });

    // For dynamic display of header styles
    if window_config.transparent {
        let transparent_script = "window.pakeWindowTitleTransparent = true;";
        window_builder = window_builder.initialization_script(transparent_script);
    }

    #[cfg(target_os = "macos")]
    {
        let title_bar_style = if window_config.transparent {
            TitleBarStyle::Overlay
        } else {
            TitleBarStyle::Visible
        };
        window_builder = window_builder.title_bar_style(title_bar_style)
    }

    #[cfg(not(target_os = "macos"))]
    {
        window_builder = window_builder.data_directory(_data_dir);
    }

    window_builder.build().expect("Failed to build window")
}
