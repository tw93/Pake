// Menu functionality is only used on macOS
#![cfg(target_os = "macos")]

use tauri::menu::{AboutMetadata, Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::{AppHandle, Manager, Wry};
use tauri_plugin_opener::OpenerExt;

pub fn get_menu(app: &AppHandle<Wry>) -> tauri::Result<Menu<Wry>> {
    let pake_version = env!("CARGO_PKG_VERSION");
    let pake_menu_item_title = format!("Built with Pake V{}", pake_version);

    let menu = Menu::with_items(
        app,
        &[
            &app_menu(app)?,
            &file_menu(app)?,
            &edit_menu(app)?,
            &view_menu(app)?,
            &navigation_menu(app)?,
            &window_menu(app)?,
            &help_menu(app, &pake_menu_item_title)?,
        ],
    )?;

    Ok(menu)
}

fn app_menu(app: &AppHandle<Wry>) -> tauri::Result<Submenu<Wry>> {
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
    Ok(app_menu)
}

fn file_menu(app: &AppHandle<Wry>) -> tauri::Result<Submenu<Wry>> {
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
    Ok(file_menu)
}

fn edit_menu(app: &AppHandle<Wry>) -> tauri::Result<Submenu<Wry>> {
    let edit_menu = Submenu::new(app, "Edit", true)?;
    edit_menu.append(&PredefinedMenuItem::undo(app, None)?)?;
    edit_menu.append(&PredefinedMenuItem::redo(app, None)?)?;
    edit_menu.append(&PredefinedMenuItem::separator(app)?)?;
    edit_menu.append(&PredefinedMenuItem::cut(app, None)?)?;
    edit_menu.append(&PredefinedMenuItem::copy(app, None)?)?;
    edit_menu.append(&PredefinedMenuItem::paste(app, None)?)?;
    edit_menu.append(&MenuItem::with_id(
        app,
        "paste_and_match_style",
        "Paste and Match Style",
        true,
        Some("CmdOrCtrl+Shift+Option+V"),
    )?)?;
    edit_menu.append(&PredefinedMenuItem::select_all(app, None)?)?;
    edit_menu.append(&PredefinedMenuItem::separator(app)?)?;
    edit_menu.append(&MenuItem::with_id(
        app,
        "copy_url",
        "Copy URL",
        true,
        Some("CmdOrCtrl+L"),
    )?)?;
    Ok(edit_menu)
}

fn view_menu(app: &AppHandle<Wry>) -> tauri::Result<Submenu<Wry>> {
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
    Ok(view_menu)
}

fn navigation_menu(app: &AppHandle<Wry>) -> tauri::Result<Submenu<Wry>> {
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
    Ok(navigation_menu)
}

fn window_menu(app: &AppHandle<Wry>) -> tauri::Result<Submenu<Wry>> {
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
    Ok(window_menu)
}

fn help_menu(app: &AppHandle<Wry>, title: &str) -> tauri::Result<Submenu<Wry>> {
    let help_menu = Submenu::new(app, "Help", true)?;
    let github_item = MenuItem::with_id(app, "pake_github_link", title, true, None::<&str>)?;
    help_menu.append(&github_item)?;
    Ok(help_menu)
}

pub fn handle_menu_click(app_handle: &AppHandle, id: &str) {
    match id {
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
                let _ = window.eval("navigator.clipboard.writeText(window.location.href)");
            }
        }
        "paste_and_match_style" => {
            if let Some(window) = app_handle.get_webview_window("pake") {
                let _ = window.eval("triggerPasteAsPlainText()");
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
}
