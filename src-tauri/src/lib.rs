#[cfg(target_os = "macos")]
use tauri::MenuItem;

use tauri::{
    App, Config, CustomMenuItem, Menu, Submenu, Window, WindowBuilder, WindowMenuEvent, WindowUrl,
};
use tauri_utils::TitleBarStyle;

mod pake;
use pake::PakeConfig;

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
    Menu::new().add_submenu(first_menu)
}

pub fn menu_event_handle(event: WindowMenuEvent) {
    match event.menu_item_id() {
        "hide" => event.window().hide().expect("can't hide window"),
        "show" => event.window().show().expect("can't show window"),
        "close" => event.window().close().expect("can't close window"),
        "quit" => std::process::exit(0),
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

#[cfg(any(target_os = "linux", target_os = "windows"))]
pub fn get_system_tray(show_menu: bool) -> SystemTray {
    let hide_app = CustomMenuItem::new("hide_app".to_string(), "Hide App");
    let show_app = CustomMenuItem::new("show_app".to_string(), "Show App");
    let quit = CustomMenuItem::new("quit".to_string(), "Quit");
    let about = CustomMenuItem::new("about".to_string(), "About");
    let tray_menu = SystemTrayMenu::new().add_item(hide_app).add_item(show_app);
    if show_menu {
        let hide_menu = CustomMenuItem::new("hide_menu".to_string(), "Hide Menu");
        let show_menu = CustomMenuItem::new("show_menu".to_string(), "Show Menu");
        let tray_menu = tray_menu
            .add_item(hide_menu)
            .add_item(show_menu)
            .add_item(quit)
            .add_item(about);
        SystemTray::new().with_menu(tray_menu)
    } else {
        let tray_menu = tray_menu.add_item(quit).add_item(about);
        SystemTray::new().with_menu(tray_menu)
    }
}

#[cfg(any(target_os = "linux", target_os = "windows"))]
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
                .inner_size(600.0, 400.0)
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
        //用于隐藏头部
        .title_bar_style(if window_config.transparent {
            TitleBarStyle::Overlay
        } else {
            TitleBarStyle::Visible
        })
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
