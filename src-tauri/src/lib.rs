#[cfg_attr(mobile, tauri::mobile_entry_point)]
mod app;
mod util;

use app::{invoke, menu::set_system_tray, window};
use invoke::{download_file, download_file_by_binary};
use std::str::FromStr;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use tauri::Manager;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut};
use tauri_plugin_window_state::Builder as windowStatePlugin;
use util::{get_data_dir, get_pake_config};
use window::get_window;

pub fn run_app() {
    let (pake_config, tauri_config) = get_pake_config();

    let tauri_app = tauri::Builder::default();

    let show_system_tray = pake_config.show_system_tray();

    // Save the value of toggle_app_shortcut before pake_config is moved
    let activation_shortcut = pake_config.windows[0].activation_shortcut.clone();
    let init_fullscreen = pake_config.windows[0].fullscreen;

    let window_state_plugin = if init_fullscreen {
        windowStatePlugin::default()
            .with_state_flags(tauri_plugin_window_state::StateFlags::FULLSCREEN)
            .build()
    } else {
        windowStatePlugin::default().build()
    };

    tauri_app
        .plugin(window_state_plugin)
        .plugin(tauri_plugin_oauth::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_single_instance::init(|_, _, _| ()))
        .invoke_handler(tauri::generate_handler![
            download_file,
            download_file_by_binary
        ])
        .setup(move |app| {
            let data_dir = get_data_dir(app.app_handle(), tauri_config.clone());

            let _window = get_window(app, &pake_config, data_dir);

            // Prevent initial shaking
            _window.show().unwrap();

            if show_system_tray {
                let _ = set_system_tray(app.app_handle());
            } else {
                app.app_handle().remove_tray_by_id("pake-tray");
            }

            if !activation_shortcut.is_empty() {
                let app_handle = app.app_handle().clone();
                let shortcut_hotkey = Shortcut::from_str(activation_shortcut.as_str()).unwrap();
                let last_triggered = Arc::new(Mutex::new(Instant::now()));

                app_handle
                    .plugin(
                        tauri_plugin_global_shortcut::Builder::new()
                            .with_handler({
                                let last_triggered = Arc::clone(&last_triggered);
                                move |app, event, _shortcut| {
                                    // Fixed the bug of tauri's hidden call, which caused repeated execution
                                    let now = Instant::now();
                                    let mut last = last_triggered.lock().unwrap();
                                    if now.duration_since(*last) < Duration::from_millis(500) {
                                        return;
                                    }
                                    *last = now;

                                    if shortcut_hotkey.eq(event) {
                                        let window = app.get_webview_window("pake").unwrap();
                                        let is_visible = window.is_visible().unwrap();

                                        match is_visible {
                                            true => {
                                                window.minimize().unwrap();
                                            }
                                            false => {
                                                window.unminimize().unwrap();
                                                window.set_focus().unwrap();
                                            }
                                        }
                                    }
                                }
                            })
                            .build(),
                    )
                    .expect("Error registering global evoke shortcuts!");

                app.global_shortcut().register(shortcut_hotkey)?;
            }

            Ok(())
        })
        .on_window_event(|_window, _event| {
            #[cfg(target_os = "macos")]
            if let tauri::WindowEvent::CloseRequested { api, .. } = _event {
                let window = _window.clone();
                {
                    tauri::async_runtime::spawn(async move {
                        if window.is_fullscreen().unwrap_or(false) {
                            window.set_fullscreen(false).unwrap();
                            // Give a small delay to ensure the full-screen exit operation is completed.
                            tokio::time::sleep(Duration::from_millis(900)).await;
                        }
                        window.minimize().unwrap();
                        window.hide().unwrap();
                    });
                }
                api.prevent_close();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

pub fn run() {
    run_app()
}
