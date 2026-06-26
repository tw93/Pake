use crate::adblock::state::AdblockSession;
use crate::app::window::open_additional_window_safe;
use std::str::FromStr;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{
    menu::{CheckMenuItemBuilder, MenuBuilder, MenuItemBuilder},
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
    allow_multi_window: bool,
    adblock_session: AdblockSession,
    show_adblock_toggle: bool,
) -> tauri::Result<()> {
    if !show_system_tray {
        app.remove_tray_by_id("pake-tray");
        return Ok(());
    }

    let new_window = MenuItemBuilder::with_id("new_window", "New Window").build(app)?;
    let hide_app = MenuItemBuilder::with_id("hide_app", "Hide").build(app)?;
    let show_app = MenuItemBuilder::with_id("show_app", "Show").build(app)?;
    let quit = MenuItemBuilder::with_id("quit", "Quit").build(app)?;
    let adblock_toggle = show_adblock_toggle
        .then(|| {
            CheckMenuItemBuilder::with_id("toggle_youtube_adblock", "Block YouTube ads")
                .checked(adblock_session.is_enabled())
                .build(app)
        })
        .transpose()?;

    let menu = match (allow_multi_window, adblock_toggle.as_ref()) {
        (true, Some(toggle)) => MenuBuilder::new(app)
            .items(&[&new_window, &hide_app, &show_app, toggle, &quit])
            .build()?,
        (false, Some(toggle)) => MenuBuilder::new(app)
            .items(&[&hide_app, &show_app, toggle, &quit])
            .build()?,
        (true, None) => MenuBuilder::new(app)
            .items(&[&new_window, &hide_app, &show_app, &quit])
            .build()?,
        (false, None) => MenuBuilder::new(app)
            .items(&[&hide_app, &show_app, &quit])
            .build()?,
    };

    app.app_handle().remove_tray_by_id("pake-tray");
    let menu_adblock_session = adblock_session.clone();

    let mut tray_builder = TrayIconBuilder::new()
        .menu(&menu)
        .on_menu_event(move |app, event| match event.id().as_ref() {
            "new_window" => {
                open_additional_window_safe(app);
            }
            "hide_app" => {
                if let Some(window) = app.get_webview_window("pake") {
                    let _ = window.minimize();
                }
            }
            "show_app" => {
                if let Some(window) = app.get_webview_window("pake") {
                    let _ = window.show();
                    #[cfg(target_os = "linux")]
                    if _init_fullscreen && !window.is_fullscreen().unwrap_or(false) {
                        let _ = window.set_fullscreen(true);
                        let _ = window.set_focus();
                    }
                }
            }
            "toggle_youtube_adblock" => {
                let enabled = !menu_adblock_session.is_enabled();
                menu_adblock_session.set_enabled(enabled);
                if let Some(window) = app.get_webview_window("pake") {
                    let script = format!(
                        "window.pakeAdblock?.setEnabled({enabled}); window.location.reload();"
                    );
                    let _ = window.eval(&script);
                }
            }
            "quit" => {
                let _ = app.save_window_state(StateFlags::all());
                app.exit(0);
            }
            _ => (),
        })
        .on_tray_icon_event(move |tray, event| match event {
            TrayIconEvent::Click { button, .. } => {
                if button == tauri::tray::MouseButton::Left {
                    if let Some(window) = tray.app_handle().get_webview_window("pake") {
                        let is_visible = window.is_visible().unwrap_or(false);
                        if is_visible {
                            let _ = window.hide();
                        } else {
                            let _ = window.show();
                            let _ = window.set_focus();
                            #[cfg(target_os = "linux")]
                            if _init_fullscreen && !window.is_fullscreen().unwrap_or(false) {
                                let _ = window.set_fullscreen(true);
                            }
                        }
                    }
                }
            }
            _ => {}
        });

    let resolved_icon = if tray_icon_path.is_empty() {
        app.default_window_icon().cloned()
    } else {
        tauri::image::Image::from_path(tray_icon_path)
            .ok()
            .or_else(|| app.default_window_icon().cloned())
    };

    if let Some(icon) = resolved_icon {
        tray_builder = tray_builder.icon(icon);
    } else {
        eprintln!("[Pake] No tray icon available; tray will build without an icon.");
    }

    let tray = tray_builder.build(app)?;

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
    let shortcut_hotkey = match Shortcut::from_str(&shortcut) {
        Ok(s) => s,
        Err(error) => {
            eprintln!("[Pake] Invalid activation shortcut '{shortcut}': {error}");
            return Ok(());
        }
    };
    let last_triggered = Arc::new(Mutex::new(Instant::now()));

    if let Err(error) = app_handle.plugin(
        tauri_plugin_global_shortcut::Builder::new()
            .with_handler({
                let last_triggered = Arc::clone(&last_triggered);
                move |app, event, _shortcut| {
                    let Ok(mut last_triggered) = last_triggered.lock() else {
                        return;
                    };
                    if Instant::now().duration_since(*last_triggered) < Duration::from_millis(300) {
                        return;
                    }
                    *last_triggered = Instant::now();

                    if shortcut_hotkey.eq(event) {
                        if let Some(window) = app.get_webview_window("pake") {
                            let is_visible = window.is_visible().unwrap_or(false);
                            if is_visible {
                                let _ = window.hide();
                            } else {
                                let _ = window.show();
                                let _ = window.set_focus();
                                #[cfg(target_os = "linux")]
                                if _init_fullscreen && !window.is_fullscreen().unwrap_or(false) {
                                    let _ = window.set_fullscreen(true);
                                }
                            }
                        }
                    }
                }
            })
            .build(),
    ) {
        eprintln!(
            "[Pake] Failed to register global shortcut plugin '{shortcut}': {error}; continuing without it."
        );
        return Ok(());
    }

    if let Err(error) = app.global_shortcut().register(shortcut_hotkey) {
        eprintln!("[Pake] Failed to bind global shortcut '{shortcut}': {error}");
    }

    Ok(())
}
