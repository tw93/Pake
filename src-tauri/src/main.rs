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
use util::{get_data_dir, get_pake_config};
use window::build_window;

#[cfg(target_os = "macos")]
use std::time::Duration;

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
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_oauth::init())
        .invoke_handler(tauri::generate_handler![
            download_file,
            download_file_by_binary
        ])
        .setup(move |app| {
            let _window = build_window(app, pake_config, data_dir);
            _window.show().unwrap();
            if !activation_shortcut.is_empty() {
                let app_handle = app.app_handle().clone();
                app_handle
                    .global_shortcut_manager()
                    .register(activation_shortcut.as_str(), move || {
                        match _window.is_visible().unwrap() {
                            true => _window.hide().unwrap(),
                            false => {
                                _window.show().unwrap();
                                _window.set_focus().unwrap();
                            }
                        }
                    })
                    .expect("Error registering global evoke shortcuts!");
            }

            Ok(())
        })
        .on_window_event(|event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event.event() {
                let window = event.window();

                #[cfg(target_os = "macos")]
                {
                    let window_handle = window.clone();
                    tauri::async_runtime::spawn(async move {
                        if window_handle.is_fullscreen().unwrap_or(false) {
                            window_handle.set_fullscreen(false).unwrap();
                            // Give a small delay to ensure the full-screen exit operation is completed.
                            tokio::time::sleep(Duration::from_millis(900)).await;
                        }
                        window_handle.minimize().unwrap();
                        window_handle.hide().unwrap();
                    });
                }

                #[cfg(not(target_os = "macos"))]
                window.close().unwrap();

                api.prevent_close();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn main() {
    run_app()
}
