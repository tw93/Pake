#[cfg(target_os = "macos")]
use tauri::MenuItem;

#[cfg(target_os = "macos")]
#[macro_use]
extern crate objc;

use tauri::{
    window::PlatformWebview, App, Config, CustomMenuItem, Manager, Menu, Submenu, SystemTray,
    SystemTrayEvent, SystemTrayMenu, Window, WindowBuilder, WindowMenuEvent, WindowUrl,
};
mod pake;
use pake::pake::PakeConfig;

pub fn get_menu() -> Menu {
    // first menu
    let hide = CustomMenuItem::new("hide", "Hide");
    let show = CustomMenuItem::new("show", "Show");
    let close = CustomMenuItem::new("close", "Close");
    let quit = CustomMenuItem::new("quit", "Quit");
    #[cfg(target_os = "macos")]
    let first_menu = Menu::new()
        .add_native_item(MenuItem::EnterFullScreen)
        .add_native_item(MenuItem::Minimize)
        .add_native_item(MenuItem::Separator)
        .add_native_item(MenuItem::Copy)
        .add_native_item(MenuItem::Cut)
        .add_native_item(MenuItem::Paste)
        .add_native_item(MenuItem::Undo)
        .add_native_item(MenuItem::Redo)
        .add_native_item(MenuItem::SelectAll)
        .add_native_item(MenuItem::Separator)
        .add_item(hide)
        .add_item(show)
        .add_item(close)
        .add_item(quit);
    #[cfg(any(target_os = "linux", target_os = "windows"))]
    let first_menu = Menu::new()
        .add_item(hide)
        .add_item(show)
        .add_item(close)
        .add_item(quit);
    let first_menu = Submenu::new("File", first_menu);
    // Hot Key
    // let top = CustomMenuItem::new("top", "Top (↑)");
    // let buttom = CustomMenuItem::new("buttom", "Bottom (↓)");
    // let previous = CustomMenuItem::new("previous", "Previous (←)");
    // let next = CustomMenuItem::new("next", "next (→)");
    // let refresh = CustomMenuItem::new("refresh", "Refresh");
    let zoom_out = CustomMenuItem::new("zoom_out", "Zoom Out (125%)");
    let zoom_in = CustomMenuItem::new("zoom_in", "Zoom In (75%)");
    let zoom_reset = CustomMenuItem::new("reset", "Zoom Reset");
    let hot_key = Menu::new()
        // .add_item(top)
        // .add_item(buttom)
        // .add_item(previous)
        // .add_item(next)
        // .add_item(refresh)
        .add_item(zoom_in)
        .add_item(zoom_out)
        .add_item(zoom_reset);
    let hot_key_menu = Submenu::new("Hot Key", hot_key);

    // Help
    // let instructions = CustomMenuItem::new("instruction", "Instruction");
    // let about = CustomMenuItem::new("about", "About");
    // let help = Menu::new()
    //     .add_item(instructions)
    //     .add_item(about);
    // let help_menu = Submenu::new("Help", help);
    let menu = Menu::new()
        .add_submenu(first_menu)
        .add_submenu(hot_key_menu);
    menu
}

pub fn set_zoom(webview: PlatformWebview, zoom_value: f64) {
    #[cfg(target_os = "linux")]
    {
        // see https://docs.rs/webkit2gtk/0.18.2/webkit2gtk/struct.WebView.html
        // and https://docs.rs/webkit2gtk/0.18.2/webkit2gtk/trait.WebViewExt.html
        use webkit2gtk::traits::WebViewExt;
        webview.inner().set_zoom_level(zoom_value);
    }

    #[cfg(windows)]
    unsafe {
        // see https://docs.rs/webview2-com/0.19.1/webview2_com/Microsoft/Web/WebView2/Win32/struct.ICoreWebView2Controller.html
        webview.controller().SetZoomFactor(zoom_value).unwrap();
    }

    #[cfg(target_os = "macos")]
    unsafe {
        let () = msg_send![webview.inner(), setPageZoom: zoom_value];
        let () = msg_send![webview.controller(), removeAllUserScripts];
        let bg_color: cocoa::base::id =
            msg_send![class!(NSColor), colorWithDeviceRed:0.5 green:0.2 blue:0.4 alpha:1.];
        let () = msg_send![webview.ns_window(), setBackgroundColor: bg_color];
    }
}

pub fn set_zoom_out(webview: PlatformWebview) {
    set_zoom(webview, 1.25);
}

pub fn set_zoom_in(webview: PlatformWebview) {
    set_zoom(webview, 0.75);
}

pub fn zoom_reset(webview: PlatformWebview) {
    set_zoom(webview, 1.0);
}

pub fn menu_event_handle(event: WindowMenuEvent) {
    match event.menu_item_id() {
        "hide" => event.window().hide().expect("can't hide window"),
        "show" => event.window().show().expect("can't show window"),
        "close" => event.window().close().expect("can't close window"),
        "quit" => std::process::exit(0),
        "zoom_out" => {
            event
                .window()
                .with_webview(set_zoom_out)
                .expect("can't set zoom out");
        }
        "zoom_in" => {
            event
                .window()
                .with_webview(set_zoom_in)
                .expect("can't set zoom in");
        }
        "reset" => {
            event
                .window()
                .with_webview(zoom_reset)
                .expect("can't reset zoom");
        }
        _ => {}
    }
}

pub fn get_pake_config() -> (PakeConfig, Config) {
    let pake_config_path = include_str!("../pake.json");
    let pake_config: PakeConfig =
        serde_json::from_str(pake_config_path).expect("failed to parse pake config");
    // println!("{:#?}", config);
    let tauri_config_path = include_str!("../tauri.conf.json");
    let tauri_config: Config =
        serde_json::from_str(tauri_config_path).expect("failed to parse tauri config");
    (pake_config, tauri_config)
}

pub fn get_system_tray(show_menu: bool) -> SystemTray {
    let hide_app = CustomMenuItem::new("hide_app".to_string(), "Hide App");
    let show_app = CustomMenuItem::new("show_app".to_string(), "Show App");
    let quit = CustomMenuItem::new("quit".to_string(), "Quit");
    let about = CustomMenuItem::new("about".to_string(), "About");
    let tray_menu = SystemTrayMenu::new()
        .add_item(hide_app)
        .add_item(show_app)
        .add_item(quit)
        .add_item(about);
    if show_menu {
        let hide_menu = CustomMenuItem::new("hide_menu".to_string(), "Hide Menu");
        let show_menu = CustomMenuItem::new("show_menu".to_string(), "Show Menu");
        let tray_menu = tray_menu.add_item(hide_menu).add_item(show_menu);
        SystemTray::new().with_menu(tray_menu)
    } else {
        SystemTray::new().with_menu(tray_menu)
    }
}

pub fn system_tray_handle(app: &tauri::AppHandle, event: tauri::SystemTrayEvent) {
    if let SystemTrayEvent::MenuItemClick { tray_id: _, id, .. } = event {
        match id.as_str() {
            "hide_app" => {
                app.get_window("pake").unwrap().hide().unwrap();
            }
            "show_app" => {
                app.get_window("pake").unwrap().show().unwrap();
            }
            "hide_menu" => {
                app.get_window("pake")
                    .unwrap()
                    .menu_handle()
                    .hide()
                    .unwrap();
            }
            "show_menu" => {
                app.get_window("pake")
                    .unwrap()
                    .menu_handle()
                    .show()
                    .unwrap();
            }
            "quit" => {
                std::process::exit(0);
            }
            "about" => {
                let _about_window = WindowBuilder::new(
                    app,
                    "about",
                    WindowUrl::App(std::path::PathBuf::from("about_pake.html")),
                )
                .resizable(true)
                .title("About")
                .inner_size(100.0, 100.0)
                .build()
                .expect("can't open about!");
            }
            _ => {}
        }
    };
}

pub fn get_data_dir(_tauri_config: Config) -> std::path::PathBuf {
    #[cfg(any(target_os = "linux", target_os = "windows"))]
    let data_dir = {
        let package_name = _tauri_config.package.product_name.unwrap();
        let home_dir = match home::home_dir() {
            Some(path1) => path1,
            None => panic!("Error, can't found you home dir!!"),
        };
        #[cfg(target_os = "windows")]
        let data_dir = home_dir.join("AppData").join("Roaming").join(package_name);
        #[cfg(target_os = "linux")]
        let data_dir = home_dir.join(".config").join(package_name);
        if !data_dir.exists() {
            std::fs::create_dir(&data_dir)
                .unwrap_or_else(|_| panic!("can't create dir {}", data_dir.display()));
        }
        data_dir
    };
    #[cfg(target_os = "macos")]
    let data_dir = std::path::PathBuf::new();
    data_dir
}

pub fn get_window(app: &mut App, config: PakeConfig, _data_dir: std::path::PathBuf) -> Window {
    let window_config = config.windows.first().unwrap();
    let user_agent = config.user_agent;
    let url = match window_config.url_type.as_str() {
        "web" => WindowUrl::External(window_config.url.parse().unwrap()),
        "local" => WindowUrl::App(std::path::PathBuf::from(&window_config.url)),
        _ => panic!("url type only can be web or local"),
    };
    #[cfg(target_os = "macos")]
    let window = WindowBuilder::new(app, "pake", url)
        .title("")
        .user_agent(user_agent.macos.as_str())
        .resizable(window_config.resizable)
        .fullscreen(window_config.fullscreen)
        // .transparent(window_config.transparent)
        //用于隐藏头部
        .title_bar_style(tauri_utils::TitleBarStyle::Overlay)
        .inner_size(window_config.width, window_config.height)
        .initialization_script(include_str!("pake.js"));

    #[cfg(any(target_os = "linux", target_os = "windows"))]
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
            .initialization_script(include_str!("pake.js"))
    };
    window.build().unwrap()
}
