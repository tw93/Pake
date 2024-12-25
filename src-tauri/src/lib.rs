#[cfg_attr(mobile, tauri::mobile_entry_point)]
mod app;
mod util;

use app::{
    invoke,
    setup::{set_global_shortcut, set_system_tray},
    window::set_window,
};
use invoke::{download_file, download_file_by_binary, send_notification};
use std::time::Duration;

use tauri::Manager;
use tauri_plugin_window_state::Builder as windowStatePlugin;
use util::get_pake_config;

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
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_single_instance::init(|_, _, _| ()))
        .invoke_handler(tauri::generate_handler![
            download_file,
            download_file_by_binary,
            send_notification,
        ])
        .setup(move |app| {
            set_window(app, &pake_config, &tauri_config);

            set_system_tray(app.app_handle(), show_system_tray).unwrap();

            set_global_shortcut(app.app_handle(), activation_shortcut).unwrap();

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
