#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use tauri::{
    CustomMenuItem, WindowBuilder, App, Config, Window, WindowUrl, 
    SystemTrayMenu, SystemTray, SystemTrayEvent, Manager
};

#[cfg(target_os = "macos")]
use app::{get_menu, menu_event_handle};
use app::{get_pake_config, pake::PakeConfig};


pub fn get_data_dir(tauri_config: Config) -> std::path::PathBuf {
    let package_name = tauri_config.package.product_name.unwrap(); 
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
}


pub fn get_window(app: & mut App, config: PakeConfig, data_dir: std::path::PathBuf) -> Window {
    let window_config = config.windows.first().unwrap();
    let user_agent = config.user_agent;
    let url = match window_config.url_type.as_str() {
       "web" => WindowUrl::External(window_config.url.parse().unwrap()),
       "local" => WindowUrl::App(std::path::PathBuf::from(&window_config.url)),
       _ => panic!("url type only can be web or local"),
    };
    #[cfg(target_os = "macos")]
    let window = WindowBuilder::new(
        app,
        "pake",
        url
    )
        .title("")
        .user_agent(user_agent.macos.as_str())
        .resizable(window_config.resizable)
        .fullscreen(window_config.fullscreen)
        .transparent(window_config.transparent)
        .inner_size(window_config.width, window_config.height)
        .initialization_script(include_str!("pake.js"));

    #[cfg(any(target_os = "linux", target_os = "windows"))]
    let window = {
        #[cfg(target_os = "linux")]
        let user_agent = user_agent.linux.as_str();
        #[cfg(target_os = "windows")]
        let user_agent = user_agent.windows.as_str();
        WindowBuilder::new(
            app,
            "pake",
            url
        )
        .title("")
        .data_directory(data_dir)
        .resizable(window_config.resizable)
        .fullscreen(window_config.fullscreen)
        .user_agent(user_agent)
        .inner_size(window_config.width, window_config.height)
        .initialization_script(include_str!("pake.js"))
    };
    window.build().unwrap()
    
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
            "about" => {
                let _about_window = WindowBuilder::new(
                    app, 
                    "about",
                    WindowUrl::App(std::path::PathBuf::from("about_pake.html"))
                )
                .resizable(true)
                .title("About")
                .inner_size(100.0, 100.0)
                .build()
                .expect("can't open about!")
                ;
            }
            _ => {},
        }
    };
}


pub fn run_app() {
    let system_tray = get_system_tray();
    #[cfg(target_os = "macos")]
    {
        let (pake_config, _) = get_pake_config();
        let menu = get_menu();
        tauri::Builder::default()
            .menu(menu)
            .on_menu_event(menu_event_handle)
            .system_tray(system_tray)
            .on_system_tray_event(system_tray_handle)
            .plugin(tauri_plugin_window_state::Builder::default().build())
            .invoke_handler(tauri::generate_handler![])
            .setup(|app| {
                let _window = get_window(app, pake_config, std::path::PathBuf::new());
                #[cfg(feature = "devtools")]
                {
                    app.get_window("pake").unwrap().open_devtools();
                }
                Ok(())
            })
            .run(tauri::generate_context!())
            .expect("error while running tauri application");
    }
    #[cfg(any(target_os = "linux", target_os = "windows"))]
    {
        let (pake_config, tauri_config) = get_pake_config();
        let data_dir = get_data_dir(tauri_config);
        // let menu = get_menu();
        tauri::Builder::default()
            // .menu(menu)
            // .on_menu_event(menu_event_handle)
            .system_tray(system_tray)
            .on_system_tray_event(system_tray_handle)
            .plugin(tauri_plugin_window_state::Builder::default().build())
            .invoke_handler(tauri::generate_handler![])
            .setup(|app| {
                let _window = get_window(app, pake_config, data_dir);
                #[cfg(feature = "devtools")]
                {
                    app.get_window("pake").unwrap().open_devtools();
                }
                Ok(())
            })
            .run(tauri::generate_context!())
            .expect("error while running tauri application");
    }


}


fn main() {
    run_app() 
    
}
