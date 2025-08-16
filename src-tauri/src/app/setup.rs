use std::str::FromStr;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{
    image::Image,
    menu::{MenuBuilder, MenuItemBuilder},
    tray::TrayIconBuilder,
    AppHandle, Manager,
};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut};
use tauri_plugin_window_state::{AppHandleExt, StateFlags};

use crate::util::get_pake_config;

pub fn set_system_tray(app: &AppHandle, show_system_tray: bool) -> tauri::Result<()> {
    if !show_system_tray {
        app.remove_tray_by_id("pake-tray");
        return Ok(());
    }

    let hide_app = MenuItemBuilder::with_id("hide_app", "Hide").build(app)?;
    let show_app = MenuItemBuilder::with_id("show_app", "Show").build(app)?;
    let quit = MenuItemBuilder::with_id("quit", "Quit").build(app)?;

    let menu = MenuBuilder::new(app)
        .items(&[&hide_app, &show_app, &quit])
        .build()?;

    app.app_handle().remove_tray_by_id("pake-tray");

    // Get tray icon - use custom tray icon if provided, otherwise use app icon
    let tray_icon = {
        let (config, _) = get_pake_config();
        let tray_path = &config.system_tray_path;

        // Check if this is a custom tray icon or app icon
        if !tray_path.is_empty() && tray_path != "icons/icon.png" {
            // Try to load the tray icon - could be relative or absolute path
            let icon_path = if tray_path.starts_with("/") {
                // Absolute path - use as is
                tray_path.to_string()
            } else if tray_path.starts_with(".pake/") || tray_path.starts_with("png/") {
                // Relative path - prepend manifest dir
                format!("{}/{}", env!("CARGO_MANIFEST_DIR"), tray_path)
            } else {
                // Default fallback path
                format!("{}/{}", env!("CARGO_MANIFEST_DIR"), tray_path)
            };

            match Image::from_path(&icon_path) {
                Ok(icon) => icon,
                Err(e) => {
                    println!(
                        "Failed to load tray icon from {}: {}, using app icon",
                        icon_path, e
                    );
                    app.default_window_icon().unwrap().clone()
                }
            }
        } else {
            // No custom tray icon, use app icon (which could be downloaded custom icon)
            println!("Using app icon for system tray (path: {})", tray_path);
            app.default_window_icon().unwrap().clone()
        }
    };

    let tray = TrayIconBuilder::new()
        .menu(&menu)
        .on_menu_event(move |app, event| match event.id().as_ref() {
            "hide_app" => {
                if let Some(window) = app.get_webview_window("pake") {
                    window.minimize().unwrap();
                }
            }
            "show_app" => {
                if let Some(window) = app.get_webview_window("pake") {
                    window.show().unwrap();
                }
            }
            "quit" => {
                app.save_window_state(StateFlags::all()).unwrap();
                std::process::exit(0);
            }
            _ => (),
        })
        .icon(tray_icon)
        .build(app)?;

    tray.set_icon_as_template(false)?;
    Ok(())
}

pub fn set_global_shortcut(app: &AppHandle, shortcut: String) -> tauri::Result<()> {
    if shortcut.is_empty() {
        return Ok(());
    }

    let app_handle = app.clone();
    let shortcut_hotkey = Shortcut::from_str(&shortcut).unwrap();
    let last_triggered = Arc::new(Mutex::new(Instant::now()));

    app_handle
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler({
                    let last_triggered = Arc::clone(&last_triggered);
                    move |app, event, _shortcut| {
                        let mut last_triggered = last_triggered.lock().unwrap();
                        if Instant::now().duration_since(*last_triggered)
                            < Duration::from_millis(300)
                        {
                            return;
                        }
                        *last_triggered = Instant::now();

                        if shortcut_hotkey.eq(event) {
                            if let Some(window) = app.get_webview_window("pake") {
                                let is_visible = window.is_visible().unwrap();
                                if is_visible {
                                    window.hide().unwrap();
                                } else {
                                    window.show().unwrap();
                                    window.set_focus().unwrap();
                                }
                            }
                        }
                    }
                })
                .build(),
        )
        .expect("Failed to set global shortcut");

    app.global_shortcut().register(shortcut_hotkey).unwrap();

    Ok(())
}
