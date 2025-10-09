use crate::app::config::PakeConfig;
use crate::util::get_data_dir;
// use std::{path::PathBuf, str::FromStr};
use std::{str::FromStr};
use tauri::{App, Config, Url, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

#[cfg(target_os = "macos")]
use tauri::{Theme, TitleBarStyle};

pub fn set_window(
    app: &mut App,
    config: &PakeConfig,
    tauri_config: &Config,
    label: &String,
) -> WebviewWindow {
    let package_name = tauri_config.clone().product_name.unwrap();
    let _data_dir = get_data_dir(app.handle(), package_name);

    let window_config = config
        .windows
        .first()
        .expect("At least one window configuration is required");

    let user_agent = config.user_agent.get();

    // let _url = match window_config.url_type.as_str() {
    //     "web" => WebviewUrl::App(window_config.url.parse().unwrap()),
    //     "local" => WebviewUrl::App(PathBuf::from(&window_config.url)),
    //     _ => panic!("url type can only be web or local"),
    // };
    
    // 启用本地服务
    let dev_url = tauri_config.clone().build.dev_url;
    let url = if let Some(dev_url) = dev_url {
        WebviewUrl::External(dev_url)
    } else {
        WebviewUrl::External("http://localhost:9527".parse().unwrap())
    };

    let config_script = format!(
        "window.pakeConfig = {}",
        serde_json::to_string(&window_config).unwrap()
    );

    let mut window_builder = WebviewWindowBuilder::new(app, label, url)
        .title("")
        .visible(false)
        .user_agent(user_agent)
        .resizable(window_config.resizable)
        .fullscreen(window_config.fullscreen)
        .inner_size(window_config.width, window_config.height)
        .always_on_top(window_config.always_on_top)
        .incognito(window_config.incognito);

    if !window_config.enable_drag_drop {
        window_builder = window_builder.disable_drag_drop_handler();
    }

    // Add initialization scripts
    window_builder = window_builder
        .initialization_script(&config_script)
        .initialization_script(include_str!("../inject/component.js"))
        .initialization_script(include_str!("../inject/event.js"))
        .initialization_script(include_str!("../inject/style.js"))
        .initialization_script(include_str!("../inject/custom.js"));

    if window_config.enable_wasm {
        window_builder = window_builder
            .additional_browser_args("--enable-features=SharedArrayBuffer")
            .additional_browser_args("--enable-unsafe-webgpu");
    }

    if !config.proxy_url.is_empty() {
        if let Ok(proxy_url) = Url::from_str(&config.proxy_url) {
            window_builder = window_builder.proxy_url(proxy_url);
            #[cfg(debug_assertions)]
            println!("Proxy configured: {}", config.proxy_url);
        }
    }

    #[cfg(target_os = "macos")]
    {
        let title_bar_style = if window_config.hide_title_bar {
            TitleBarStyle::Overlay
        } else {
            TitleBarStyle::Visible
        };
        window_builder = window_builder.title_bar_style(title_bar_style);

        if window_config.dark_mode {
            window_builder = window_builder.theme(Some(Theme::Dark));
        }
    }

    // #[cfg(not(target_os = "macos"))]
    // {
    //     window_builder = window_builder
    //         .data_directory(_data_dir)
    //         .title(app.package_info().name.clone());
    // }

    window_builder.build().expect("Failed to build window")
}
