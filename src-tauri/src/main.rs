#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]


#[cfg(target_os = "macos")]
use app::{get_menu, menu_event_handle};
use app::{get_window, get_system_tray, get_data_dir, get_pake_config, system_tray_handle};


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
