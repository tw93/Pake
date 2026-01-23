use std::str::FromStr;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{
    menu::{MenuBuilder, MenuItemBuilder},
    tray::{TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager,
};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut};
use tauri_plugin_window_state::{AppHandleExt, StateFlags};

pub fn set_system_tray(
    app: &AppHandle,
    show_system_tray: bool,
    tray_icon_path: &str,
    _init_fullscreen: bool,
) -> tauri::Result<()> {
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
                    #[cfg(target_os = "linux")]
                    if _init_fullscreen && !window.is_fullscreen().unwrap_or(false) {
                        let _ = window.set_fullscreen(true);
                        let _ = window.set_focus();
                    }
                }
            }
            "quit" => {
                app.save_window_state(StateFlags::all()).unwrap();
                std::process::exit(0);
            }
            _ => (),
        })
        .on_tray_icon_event(move |tray, event| match event {
            TrayIconEvent::Click { button, .. } => {
                if button == tauri::tray::MouseButton::Left {
                    if let Some(window) = tray.app_handle().get_webview_window("pake") {
                        let is_visible = window.is_visible().unwrap_or(false);
                        if is_visible {
                            window.hide().unwrap();
                        } else {
                            window.show().unwrap();
                            window.set_focus().unwrap();
                            #[cfg(target_os = "linux")]
                            if _init_fullscreen && !window.is_fullscreen().unwrap_or(false) {
                                let _ = window.set_fullscreen(true);
                            }
                        }
                    }
                }
            }
            _ => {}
        })
        .icon(if tray_icon_path.is_empty() {
            app.default_window_icon()
                .unwrap_or_else(|| panic!("Failed to get default window icon"))
                .clone()
        } else {
            tauri::image::Image::from_path(tray_icon_path).unwrap_or_else(|_| {
                // If custom tray icon fails to load, fallback to default
                app.default_window_icon()
                    .unwrap_or_else(|| panic!("Failed to get default window icon"))
                    .clone()
            })
        })
        .build(app)?;

    tray.set_icon_as_template(false)?;
    Ok(())
}

pub fn set_global_shortcut(
    app: &AppHandle,
    shortcut: String,
    _init_fullscreen: bool,
) -> tauri::Result<()> {
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
                                    #[cfg(target_os = "linux")]
                                    if _init_fullscreen && !window.is_fullscreen().unwrap_or(false)
                                    {
                                        let _ = window.set_fullscreen(true);
                                    }
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
