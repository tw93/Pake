#[cfg_attr(mobile, tauri::mobile_entry_point)]
mod app;
mod util;

use tauri::Manager;
use tauri_plugin_window_state::Builder as WindowStatePlugin;
use tauri_plugin_window_state::StateFlags;

#[cfg(target_os = "macos")]
use std::time::Duration;

const WINDOW_SHOW_DELAY: u64 = 50;

use app::{
    invoke::{
        clear_cache_and_restart, download_file, download_file_by_binary, send_notification,
        update_theme_mode,
    },
    setup::{set_global_shortcut, set_system_tray},
    window::set_window,
};
use util::get_pake_config;

pub fn run_app() {
    let (pake_config, tauri_config) = get_pake_config();
    let tauri_app = tauri::Builder::default();

    let show_system_tray = pake_config.show_system_tray();
    let hide_on_close = pake_config.windows[0].hide_on_close;
    let activation_shortcut = pake_config.windows[0].activation_shortcut.clone();
    let init_fullscreen = pake_config.windows[0].fullscreen;
    let start_to_tray = pake_config.windows[0].start_to_tray && show_system_tray; // Only valid when tray is enabled
    let multi_instance = pake_config.multi_instance;

    let window_state_plugin = WindowStatePlugin::default()
        .with_state_flags(if init_fullscreen {
            StateFlags::FULLSCREEN
        } else {
            // Prevent flickering on the first open.
            StateFlags::all() & !StateFlags::VISIBLE
        })
        .build();

    #[allow(deprecated)]
    let mut app_builder = tauri_app
        .plugin(window_state_plugin)
        .plugin(tauri_plugin_oauth::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init()); // Add this

    // Only add single instance plugin if multiple instances are not allowed
    if !multi_instance {
        app_builder = app_builder.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("pake") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
        }));
    }

    app_builder
        .invoke_handler(tauri::generate_handler![
            download_file,
            download_file_by_binary,
            send_notification,
            update_theme_mode,
            clear_cache_and_restart,
        ])
        .setup(move |app| {
            // --- Menu Construction Start ---
            #[cfg(target_os = "macos")]
            {
                let menu = app::menu::get_menu(app.app_handle())?;
                app.set_menu(menu)?;

                // Event Handling for Custom Menu Item
                app.on_menu_event(move |app_handle, event| {
                    app::menu::handle_menu_click(app_handle, event.id().as_ref());
                });
            }
            // --- Menu Construction End ---

            let window = set_window(app, &pake_config, &tauri_config);
            set_system_tray(
                app.app_handle(),
                show_system_tray,
                &pake_config.system_tray_path,
            )
            .unwrap();
            set_global_shortcut(app.app_handle(), activation_shortcut).unwrap();

            // Show window after state restoration to prevent position flashing
            // Unless start_to_tray is enabled, then keep it hidden
            if !start_to_tray {
                let window_clone = window.clone();
                tauri::async_runtime::spawn(async move {
                    tokio::time::sleep(tokio::time::Duration::from_millis(WINDOW_SHOW_DELAY)).await;
                    window_clone.show().unwrap();

                    // Fixed: Linux fullscreen issue with virtual keyboard
                    #[cfg(all(not(target_os = "windows"), not(target_os = "macos")))]
                    {
                        if init_fullscreen {
                            window_clone.set_fullscreen(true).unwrap();
                            // Ensure webview maintains focus for input after fullscreen
                            let _ = window_clone.set_focus();
                        }
                    }
                });
            }

            Ok(())
        })
        .on_window_event(move |_window, _event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = _event {
                if hide_on_close {
                    // Hide window when hide_on_close is enabled (regardless of tray status)
                    let window = _window.clone();
                    tauri::async_runtime::spawn(async move {
                        #[cfg(target_os = "macos")]
                        {
                            if window.is_fullscreen().unwrap_or(false) {
                                window.set_fullscreen(false).unwrap();
                                tokio::time::sleep(Duration::from_millis(900)).await;
                            }
                        }
                        #[cfg(all(not(target_os = "windows"), not(target_os = "macos")))]
                        {
                            if window.is_fullscreen().unwrap_or(false) {
                                window.set_fullscreen(false).unwrap();
                                // Restore focus after exiting fullscreen to fix input issues
                                let _ = window.set_focus();
                            }
                        }
                        // On macOS, directly hide without minimize to avoid duplicate Dock icons
                        #[cfg(not(target_os = "macos"))]
                        window.minimize().unwrap();
                        window.hide().unwrap();
                    });
                    api.prevent_close();
                } else {
                    // Exit app completely when hide_on_close is false
                    std::process::exit(0);
                }
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            // Handle macOS dock icon click to reopen hidden window
            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::Reopen {
                has_visible_windows,
                ..
            } = event
            {
                if !has_visible_windows {
                    if let Some(window) = app.get_webview_window("pake") {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
            }
        });
}

pub fn run() {
    run_app()
}
