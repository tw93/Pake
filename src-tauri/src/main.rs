#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod app;
mod util;

use app::{invoke, menu, window};
use invoke::{download_file, download_file_by_binary};
use menu::{get_system_tray, system_tray_handle};
use tauri::{GlobalShortcutManager, Manager};
use tauri_plugin_window_state::Builder as windowStatePlugin;
use util::{get_data_dir, get_pake_config};
use window::get_window;

pub fn run_app() {
    let (pake_config, tauri_config) = get_pake_config();
    let data_dir = get_data_dir(tauri_config);

    let mut tauri_app = tauri::Builder::default();

    let show_system_tray = pake_config.show_system_tray();
    let system_tray = get_system_tray();

    if show_system_tray {
        tauri_app = tauri_app
            .system_tray(system_tray)
            .on_system_tray_event(system_tray_handle);
    }

    // Save the value of toggle_app_shortcut before pake_config is moved
    let activation_shortcut = pake_config.windows[0].activation_shortcut.clone();

    tauri_app
        .plugin(windowStatePlugin::default().build())
        .plugin(tauri_plugin_oauth::init())
        .invoke_handler(tauri::generate_handler![
            download_file,
            download_file_by_binary
        ])
        .setup(move |app| {
            let _window = get_window(app, pake_config, data_dir);
            // Prevent initial shaking
            _window.show().unwrap();

            if !activation_shortcut.is_empty() {
                let app_handle = app.app_handle().clone();
                app_handle
                    .global_shortcut_manager()
                    .register(activation_shortcut.as_str(), move || {
                        let window = app_handle.get_window("pake").unwrap();
                        match window.is_visible().unwrap() {
                            true => window.hide().unwrap(),
                            false => {
                                window.show().unwrap();
                                window.set_focus().unwrap();
                            }
                        }
                    })
                    .expect("Error registering global evoke shortcuts!");
            }

            Ok(())
        })
        .on_window_event(|event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event.event() {
                #[cfg(target_os = "macos")]
                {
                    event.window().minimize().unwrap();
                    event.window().hide().unwrap();
                }

                #[cfg(not(target_os = "macos"))]
                event.window().close().unwrap();

                api.prevent_close();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn main() {
    run_app()
}
