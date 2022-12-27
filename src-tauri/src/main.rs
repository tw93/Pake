#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]
#[cfg(target_os = "macos")]
use tauri::MenuItem;

use tauri::{
    CustomMenuItem, Menu, Submenu, WindowBuilder, App,
    Window, WindowUrl, WindowMenuEvent, window::PlatformWebview,
    SystemTrayMenu, SystemTray, SystemTrayEvent, Manager
};

// use tauri::Config;

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
        pub url_type: String
    }


    // #[derive(Debug, Deserialize)]
    // pub struct SystemTray {
    //     pub icon_path: String, 
    //     pub icon_as_template: bool,
    // }
    
    #[derive(Debug, Deserialize)]
    pub struct PakeConfig {
        pub windows: Vec<WindowConfig>,
        // pub system_tray: SystemTray,
    }
}

use pake::PakeConfig;

pub fn get_pake_config() -> PakeConfig{
    let config_path = include_str!("../pake.json");
    let config: PakeConfig = serde_json::from_str(config_path)
        .expect("failed to parse common config");
    // println!("{:#?}", config);
    config
}


pub fn get_menu() -> Menu {
    // first menu
    let debug = CustomMenuItem::new("debug", "Debug");
    let hide = CustomMenuItem::new("hide", "Hide");
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
        .add_item(debug)
        .add_item(hide)
        .add_item(close)
        .add_item(quit);
    #[cfg(any(target_os = "linux", target_os = "windows"))]
    let first_menu = Menu::new()
        .add_item(debug)
        .add_item(hide)
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
    let hot_key_menu = Submenu::new("Hot Key",  hot_key);

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
        // .add_submenu(help_menu);
    menu


}


pub fn get_window(app: & mut App, config: PakeConfig) -> Window {
    let window_config = config.windows.first().unwrap();
    let url = match window_config.url_type.as_str() {
       "web" => WindowUrl::External(window_config.url.parse().unwrap()),
       "local" => WindowUrl::App(std::path::PathBuf::from(&window_config.url)),
       _ => panic!("url type only can be web or local"),
    };
    let window = WindowBuilder::new(
        app,
        "pake",
        url
    )
        .title("")
        .resizable(window_config.resizable)
        .fullscreen(window_config.fullscreen)
        .inner_size(window_config.width, window_config.height)
        .initialization_script(include_str!("pake.js"));

    window.build().unwrap()
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
       let bg_color: cocoa::base::id = msg_send![class!(NSColor), colorWithDeviceRed:0.5 green:0.2 blue:0.4 alpha:1.];
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
        "debug" => event.window().open_devtools(),
        "hide" => event.window().hide().expect("can't hide window"),
        "close" => event.window().close().expect("can't close window"),
        "quit" => std::process::exit(0),
        "zoom_out" => {
            event.window()
                .with_webview(set_zoom_out)
                .expect("can't set zoom out");
        },
        "zoom_in" => {
            event.window()
                .with_webview(set_zoom_in)
                .expect("can't set zoom in");
        },
        "reset" => {
            event.window()
                .with_webview(zoom_reset)
                .expect("can't reset zoom");
        },
        _ => {},
    }
}


pub fn get_system_tray() -> SystemTray {
    let hide = CustomMenuItem::new("hide".to_string(), "Hide");
    let show = CustomMenuItem::new("show".to_string(), "Show");
    let quit = CustomMenuItem::new("quit".to_string(), "Quit");
    let about = CustomMenuItem::new("about".to_string(), "About");
    let tray_menu = SystemTrayMenu::new()
        .add_item(hide)
        .add_item(show)
        .add_item(quit)
        .add_item(about);
    SystemTray::new().with_menu(tray_menu)
}


pub fn system_tray_handle(app: &tauri::AppHandle, event: tauri::SystemTrayEvent) {
    if let SystemTrayEvent::MenuItemClick { tray_id: _, id, .. } = event {
        match id.as_str() {
            "hide" => {
                app.get_window("pake").unwrap().hide().unwrap();
            },
            "show" => {
                app.get_window("pake").unwrap().show().unwrap();
            },
            "quit" => {
                std::process::exit(0);
            },
            _ => {},
        }
    };
}



fn main() {
    let pake_config = get_pake_config();
    let menu = get_menu();
    let system_tray = get_system_tray();
    tauri::Builder::default()
        .menu(menu)
        .on_menu_event(menu_event_handle)
        .system_tray(system_tray)
        .on_system_tray_event(system_tray_handle)
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .invoke_handler(tauri::generate_handler![])
        .setup(|app| {
            let _window = get_window(app, pake_config);
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
    
}
