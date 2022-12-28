#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use app::{get_data_dir, get_menu, get_pake_config, get_window, menu_event_handle};

pub fn run_app() {
    let (pake_config, tauri_config) = get_pake_config();
    let show_menu = pake_config.show_menu();
    let menu = get_menu();
    let data_dir = get_data_dir(tauri_config);
    #[cfg(any(target_os = "linux", target_os = "windows"))]
    let tauri_app = {
        use app::{get_system_tray, system_tray_handle};

        let show_system_tray = pake_config.show_system_tray();
        let system_tray = get_system_tray(show_menu);
        let tauri_app = if show_menu && !show_system_tray {
            tauri::Builder::default()
                .menu(menu)
                .on_menu_event(menu_event_handle)
        } else if !show_menu && show_system_tray {
            tauri::Builder::default()
                .system_tray(system_tray)
                .on_system_tray_event(system_tray_handle)
        } else if show_menu && show_system_tray {
            tauri::Builder::default()
                .menu(menu)
                .on_menu_event(menu_event_handle)
                .system_tray(system_tray)
                .on_system_tray_event(system_tray_handle)
        } else {
            tauri::Builder::default()
        };
    };
    #[cfg(target_os = "macos")]
    let tauri_app = if show_menu {
        tauri::Builder::default()
            .menu(menu)
            .on_menu_event(menu_event_handle)
    } else {
        tauri::Builder::default()
    };

    tauri_app
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .invoke_handler(tauri::generate_handler![])
        .setup(|app| {
            let _window = get_window(app, pake_config, data_dir);
            #[cfg(feature = "devtools")]
            {
                _window.open_devtools();
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn main() {
    run_app()
}
