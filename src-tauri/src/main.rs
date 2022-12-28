#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use app::{
    get_data_dir, get_menu, get_pake_config, get_system_tray, get_window, menu_event_handle,
    system_tray_handle,
};

pub fn run_app() {
    let system_tray = get_system_tray();
    let (pake_config, tauri_config) = get_pake_config();
    let data_dir = get_data_dir(tauri_config);
    let menu = get_menu();
    tauri::Builder::default()
        .menu(menu)
        .on_menu_event(menu_event_handle)
        .system_tray(system_tray)
        .on_system_tray_event(system_tray_handle)
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
