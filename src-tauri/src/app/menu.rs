// Menu functionality is only used on macOS; the module is gated in app/mod.rs.
use crate::app::window::{open_additional_window_safe, MultiWindowState};
use tauri::menu::{AboutMetadata, Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::{AppHandle, Manager, Wry};
use tauri_plugin_opener::OpenerExt;

pub fn set_app_menu(
    app: &AppHandle<Wry>,
    allow_multi_window: bool,
    enable_find: bool,
) -> tauri::Result<()> {
    let pake_version = env!("CARGO_PKG_VERSION");
    let pake_menu_item_title = format!("Built with Pake V{}", pake_version);

    let window_submenu = window_menu(app)?;

    let menu = Menu::with_items(
        app,
        &[
            &app_menu(app)?,
            &file_menu(app, allow_multi_window)?,
            &edit_menu(app, enable_find)?,
            &view_menu(app)?,
            &navigation_menu(app)?,
            &window_submenu,
            &help_menu(app, &pake_menu_item_title)?,
        ],
    )?;

    app.set_menu(menu)?;

    // AppKit injects Move & Resize, Fill, Center, Full Screen Tile, and
    // window-cycling once the submenu is registered as the windows menu.
    window_submenu.set_as_windows_menu_for_nsapp()?;

    Ok(())
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

fn file_menu(app: &AppHandle<Wry>, allow_multi_window: bool) -> tauri::Result<Submenu<Wry>> {
    let file_menu = Submenu::new(app, "File", true)?;
    if allow_multi_window {
        file_menu.append(&MenuItem::with_id(
            app,
            "new_window",
            "New Window",
            true,
            Some("CmdOrCtrl+N"),
        )?)?;
        file_menu.append(&PredefinedMenuItem::separator(app)?)?;
    }
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

fn edit_menu(app: &AppHandle<Wry>, enable_find: bool) -> tauri::Result<Submenu<Wry>> {
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
    if enable_find {
        edit_menu.append(&MenuItem::with_id(
            app,
            "find",
            "Find",
            true,
            Some("CmdOrCtrl+F"),
        )?)?;
        edit_menu.append(&MenuItem::with_id(
            app,
            "find_next",
            "Find Next",
            true,
            Some("CmdOrCtrl+G"),
        )?)?;
        edit_menu.append(&MenuItem::with_id(
            app,
            "find_previous",
            "Find Previous",
            true,
            Some("CmdOrCtrl+Shift+G"),
        )?)?;
        edit_menu.append(&PredefinedMenuItem::separator(app)?)?;
    }
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

// Resolve the app's real home URL from its window config. Split out from
// `home_url` so the mapping can be unit-tested without an AppHandle.
fn resolve_home_url(url_type: &str, url: &str) -> Option<tauri::Url> {
    match url_type {
        // A web app's configured url is already absolute.
        "web" => tauri::Url::parse(url).ok(),
        // A local-file app's url is only a basename; Tauri serves bundled assets
        // from tauri://localhost on macOS (this menu is macOS-only). Resolving it
        // against the currently loaded remote origin (as the old eval path did)
        // would point at the wrong server.
        "local" => tauri::Url::parse(&format!("tauri://localhost/{url}")).ok(),
        _ => None,
    }
}

fn home_url(app: &AppHandle) -> Option<tauri::Url> {
    let state = app.try_state::<MultiWindowState>()?;
    let window_config = state.pake_config.windows.first()?;
    resolve_home_url(&window_config.url_type, &window_config.url)
}

pub fn handle_menu_click(app_handle: &AppHandle, id: &str) {
    match id {
        "new_window" => {
            open_additional_window_safe(app_handle);
        }
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
                // Native navigation works even from a blank error page (where
                // eval cannot run) and resolves local-file apps to the correct
                // bundled asset instead of a path on the current origin.
                match home_url(app_handle) {
                    Some(url) => {
                        let _ = window.navigate(url);
                    }
                    None => {
                        let _ = window.eval("window.location.href = window.pakeConfig.url");
                    }
                }
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
        "find" => {
            if let Some(window) = app_handle.get_webview_window("pake") {
                let _ = window.eval("window.pakeFind?.open()");
            }
        }
        "find_next" => {
            if let Some(window) = app_handle.get_webview_window("pake") {
                let _ = window.eval("window.pakeFind?.next()");
            }
        }
        "find_previous" => {
            if let Some(window) = app_handle.get_webview_window("pake") {
                let _ = window.eval("window.pakeFind?.previous()");
            }
        }
        "clear_cache_restart" => {
            if let Some(window) = app_handle.get_webview_window("pake") {
                if window.clear_all_browsing_data().is_ok() {
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

#[cfg(test)]
mod tests {
    use super::resolve_home_url;

    #[test]
    fn web_url_passes_through_unchanged() {
        assert_eq!(
            resolve_home_url("web", "https://github.com").map(|u| u.to_string()),
            Some("https://github.com/".to_string())
        );
    }

    #[test]
    fn local_basename_resolves_to_bundled_asset_url() {
        // The fix: a local app's basename must become the bundled asset URL,
        // not a path resolved against whatever origin is currently loaded.
        assert_eq!(
            resolve_home_url("local", "launcher.html").map(|u| u.to_string()),
            Some("tauri://localhost/launcher.html".to_string())
        );
    }

    #[test]
    fn unknown_url_type_is_none() {
        assert!(resolve_home_url("bogus", "whatever").is_none());
    }
}
