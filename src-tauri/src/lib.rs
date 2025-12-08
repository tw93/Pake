#[cfg_attr(mobile, tauri::mobile_entry_point)]
mod app;
mod util;

use tauri::Manager;
use tauri_plugin_window_state::Builder as WindowStatePlugin;
use tauri_plugin_window_state::StateFlags;

#[cfg(target_os = "macos")]
use std::time::Duration;

use tauri::menu::{AboutMetadata, Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri_plugin_opener::OpenerExt; // Add this

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
            let pake_version = env!("CARGO_PKG_VERSION");
            let pake_menu_item_title = format!("Built with Pake V{}", pake_version);

            // App Menu (macOS specific, e.g., "Pake")
            let app_menu = Submenu::new(app, "Pake", true)?;
            let about_metadata = AboutMetadata::default();
            app_menu.append(&PredefinedMenuItem::about(
                app,
                Some("Pake"),
                Some(about_metadata),
            )?)?;
            app_menu.append(&PredefinedMenuItem::separator(app)?)?;
            app_menu.append(&PredefinedMenuItem::services(app, None)?)?;
            app_menu.append(&PredefinedMenuItem::separator(app)?)?;
            app_menu.append(&PredefinedMenuItem::hide(app, None)?)?;
            app_menu.append(&PredefinedMenuItem::hide_others(app, None)?)?;
            app_menu.append(&PredefinedMenuItem::show_all(app, None)?)?;
            app_menu.append(&PredefinedMenuItem::separator(app)?)?;
            app_menu.append(&PredefinedMenuItem::quit(app, None)?)?;

            // File Menu
            let file_menu = Submenu::new(app, "File", true)?;
            file_menu.append(&PredefinedMenuItem::close_window(app, None)?)?;
            file_menu.append(&PredefinedMenuItem::separator(app)?)?;
            file_menu.append(&MenuItem::with_id(
                app,
                "clear_cache_restart",
                "Clear Cache & Restart",
                true,
                Some("CmdOrCtrl+Shift+Backspace"),
            )?)?;

            // Edit Menu
            let edit_menu = Submenu::new(app, "Edit", true)?;
            edit_menu.append(&PredefinedMenuItem::undo(app, None)?)?;
            edit_menu.append(&PredefinedMenuItem::redo(app, None)?)?;
            edit_menu.append(&PredefinedMenuItem::separator(app)?)?;
            edit_menu.append(&PredefinedMenuItem::cut(app, None)?)?;
            edit_menu.append(&PredefinedMenuItem::copy(app, None)?)?;
            edit_menu.append(&PredefinedMenuItem::paste(app, None)?)?;
            edit_menu.append(&PredefinedMenuItem::select_all(app, None)?)?;
            edit_menu.append(&PredefinedMenuItem::separator(app)?)?;
            edit_menu.append(&MenuItem::with_id(
                app,
                "copy_url",
                "Copy URL",
                true,
                Some("CmdOrCtrl+L"),
            )?)?;

            // View Menu
            let view_menu = Submenu::new(app, "View", true)?;
            view_menu.append(&MenuItem::with_id(
                app,
                "reload",
                "Reload",
                true,
                Some("CmdOrCtrl+R"),
            )?)?;
            view_menu.append(&PredefinedMenuItem::separator(app)?)?;
            view_menu.append(&MenuItem::with_id(
                app,
                "zoom_in",
                "Zoom In",
                true,
                Some("CmdOrCtrl+="),
            )?)?;
            view_menu.append(&MenuItem::with_id(
                app,
                "zoom_out",
                "Zoom Out",
                true,
                Some("CmdOrCtrl+-"),
            )?)?;
            view_menu.append(&MenuItem::with_id(
                app,
                "zoom_reset",
                "Actual Size",
                true,
                Some("CmdOrCtrl+0"),
            )?)?;
            view_menu.append(&PredefinedMenuItem::separator(app)?)?;
            view_menu.append(&PredefinedMenuItem::fullscreen(app, None)?)?;
            view_menu.append(&PredefinedMenuItem::separator(app)?)?;
            view_menu.append(&MenuItem::with_id(
                app,
                "toggle_devtools",
                "Toggle Developer Tools",
                cfg!(debug_assertions),
                Some("CmdOrCtrl+Option+I"),
            )?)?;

            // Navigation Menu
            let navigation_menu = Submenu::new(app, "Navigation", true)?;
            navigation_menu.append(&MenuItem::with_id(
                app,
                "go_back",
                "Back",
                true,
                Some("CmdOrCtrl+["),
            )?)?;
            navigation_menu.append(&MenuItem::with_id(
                app,
                "go_forward",
                "Forward",
                true,
                Some("CmdOrCtrl+]"),
            )?)?;
            navigation_menu.append(&MenuItem::with_id(
                app,
                "go_home",
                "Go Home",
                true,
                Some("CmdOrCtrl+Shift+H"),
            )?)?;

            // Window Menu
            let window_menu = Submenu::new(app, "Window", true)?;
            window_menu.append(&PredefinedMenuItem::minimize(app, None)?)?;
            window_menu.append(&PredefinedMenuItem::maximize(app, None)?)?;
            window_menu.append(&PredefinedMenuItem::separator(app)?)?;
            window_menu.append(&MenuItem::with_id(
                app,
                "always_on_top",
                "Toggle Always on Top",
                true,
                None::<&str>,
            )?)?;
            window_menu.append(&PredefinedMenuItem::separator(app)?)?;
            window_menu.append(&PredefinedMenuItem::close_window(app, None)?)?;

            // Help Menu (Custom)
            let help_menu = Submenu::new(app, "Help", true)?;
            let github_item = MenuItem::with_id(
                app,
                "pake_github_link",
                &pake_menu_item_title,
                true,
                None::<&str>,
            )?;
            help_menu.append(&github_item)?;

            // Construct the Menu Bar
            let menu = Menu::with_items(
                app,
                &[
                    &app_menu,
                    &file_menu,
                    &edit_menu,
                    &view_menu,
                    &navigation_menu,
                    &window_menu,
                    &help_menu,
                ],
            )?;

            app.set_menu(menu)?;

            // Event Handling for Custom Menu Item
            app.on_menu_event(move |app_handle, event| {
                match event.id().as_ref() {
                    "pake_github_link" => {
                        let _ = app_handle
                            .opener()
                            .open_url("https://github.com/tw93/Pake", None::<&str>);
                    }
                    "reload" => {
                        if let Some(window) = app_handle.get_webview_window("pake") {
                            let _ = window.eval("window.location.reload()");
                        }
                    }
                    "toggle_devtools" => {
                        #[cfg(debug_assertions)] // Only allow in debug builds
                        if let Some(window) = app_handle.get_webview_window("pake") {
                            if window.is_devtools_open() {
                                window.close_devtools();
                            } else {
                                window.open_devtools();
                            }
                        }
                    }
                    "zoom_in" => {
                        if let Some(window) = app_handle.get_webview_window("pake") {
                            let _ = window.eval("zoomIn()");
                        }
                    }
                    "zoom_out" => {
                        if let Some(window) = app_handle.get_webview_window("pake") {
                            let _ = window.eval("zoomOut()");
                        }
                    }
                    "zoom_reset" => {
                        if let Some(window) = app_handle.get_webview_window("pake") {
                            let _ = window.eval("setZoom('100%')");
                        }
                    }
                    "go_back" => {
                        if let Some(window) = app_handle.get_webview_window("pake") {
                            let _ = window.eval("window.history.back()");
                        }
                    }
                    "go_forward" => {
                        if let Some(window) = app_handle.get_webview_window("pake") {
                            let _ = window.eval("window.history.forward()");
                        }
                    }
                    "go_home" => {
                        if let Some(window) = app_handle.get_webview_window("pake") {
                            let _ = window.eval("window.location.href = window.pakeConfig.url");
                        }
                    }
                    "copy_url" => {
                        if let Some(window) = app_handle.get_webview_window("pake") {
                            let _ =
                                window.eval("navigator.clipboard.writeText(window.location.href)");
                        }
                    }
                    "clear_cache_restart" => {
                        if let Some(window) = app_handle.get_webview_window("pake") {
                            if let Ok(_) = window.clear_all_browsing_data() {
                                app_handle.restart();
                            }
                        }
                    }
                    "always_on_top" => {
                        if let Some(window) = app_handle.get_webview_window("pake") {
                            let is_on_top = window.is_always_on_top().unwrap_or(false);
                            let _ = window.set_always_on_top(!is_on_top);
                        }
                    }
                    _ => {}
                }
            });
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
                    tokio::time::sleep(tokio::time::Duration::from_millis(50)).await;
                    window_clone.show().unwrap();
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
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

pub fn run() {
    run_app()
}
