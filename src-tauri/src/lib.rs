#[cfg_attr(mobile, tauri::mobile_entry_point)]
mod app;
mod util;

use std::str::FromStr;

use app::{invoke, menu::set_system_tray, window};
use invoke::{download_file, download_file_by_binary};
use tauri::Manager;
use tauri_plugin_window_state::Builder as windowStatePlugin;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut};
use util::{get_data_dir, get_pake_config};
use window::get_window;

pub fn run_app() {
    let (pake_config, tauri_config) = get_pake_config();

    let tauri_app = tauri::Builder::default();

    let show_system_tray = pake_config.show_system_tray();

    // Save the value of toggle_app_shortcut before pake_config is moved
    let activation_shortcut = pake_config.windows[0].activation_shortcut.clone();

    tauri_app
        .plugin(windowStatePlugin::default().build())
        .plugin(tauri_plugin_oauth::init())
        .plugin(tauri_plugin_http::init())
        .invoke_handler(tauri::generate_handler![
            download_file,
            download_file_by_binary
        ])
        .setup(move |app| {
            let data_dir = get_data_dir(&app.app_handle(), tauri_config.clone());

            let _window = get_window(app, &pake_config, data_dir);
            // Prevent initial shaking
            _window.show().unwrap();

            if show_system_tray {
                let _ = set_system_tray(&app.app_handle(), &pake_config);
            } else {
                app.app_handle().remove_tray_by_id("pake-tray");
            }

            if !activation_shortcut.is_empty() {
                let app_handle = app.app_handle().clone();
                let shortcut_hotkey = Shortcut::from_str(&activation_shortcut.as_str()).unwrap();

                app_handle
                    .plugin(
                        tauri_plugin_global_shortcut::Builder::new()
                            .with_handler(move |app, event, _shortcut| {

                                if shortcut_hotkey.eq(event) {
                                    let window = app.get_webview_window("pake").unwrap();
                                    match window.is_visible().unwrap() {
                                        true => window.hide().unwrap(),
                                        false => {
                                            window.show().unwrap();
                                            window.set_focus().unwrap();
                                        }
                                    }
                                }
                            }
                    ).build())
                    .expect("Error registering global evoke shortcuts!");

                app.global_shortcut().register(shortcut_hotkey)?;
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                #[cfg(target_os = "macos")]
                {
                    window.minimize().unwrap();
                    window.hide().unwrap();
                }

                #[cfg(not(target_os = "macos"))]
                event.window().close().unwrap();

                api.prevent_close();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

pub fn run() {
    run_app()
}
