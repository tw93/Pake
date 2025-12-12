use tauri::menu::{AboutMetadata, Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::{AppHandle, Manager, Wry};
use tauri_plugin_opener::OpenerExt;

pub fn get_menu(app: &AppHandle<Wry>) -> Menu<Wry> {
    let pake_version = env!("CARGO_PKG_VERSION");
    let pake_menu_item_title = format!("Built with Pake V{}", pake_version);

    // App Menu (macOS specific, e.g., "Pake")
    let app_menu = Submenu::new(app, "Pake", true).unwrap();
    let about_metadata = AboutMetadata::default();
    app_menu
        .append(&PredefinedMenuItem::about(app, Some("Pake"), Some(about_metadata)).unwrap())
        .unwrap();
    app_menu
        .append(&PredefinedMenuItem::separator(app).unwrap())
        .unwrap();
    app_menu
        .append(&PredefinedMenuItem::services(app, None).unwrap())
        .unwrap();
    app_menu
        .append(&PredefinedMenuItem::separator(app).unwrap())
        .unwrap();
    app_menu
        .append(&PredefinedMenuItem::hide(app, None).unwrap())
        .unwrap();
    app_menu
        .append(&PredefinedMenuItem::hide_others(app, None).unwrap())
        .unwrap();
    app_menu
        .append(&PredefinedMenuItem::show_all(app, None).unwrap())
        .unwrap();
    app_menu
        .append(&PredefinedMenuItem::separator(app).unwrap())
        .unwrap();
    app_menu
        .append(&PredefinedMenuItem::quit(app, None).unwrap())
        .unwrap();

    // File Menu
    let file_menu = Submenu::new(app, "File", true).unwrap();
    file_menu
        .append(&PredefinedMenuItem::close_window(app, None).unwrap())
        .unwrap();
    file_menu
        .append(&PredefinedMenuItem::separator(app).unwrap())
        .unwrap();
    file_menu
        .append(
            &MenuItem::with_id(
                app,
                "clear_cache_restart",
                "Clear Cache & Restart",
                true,
                Some("CmdOrCtrl+Shift+Backspace"),
            )
            .unwrap(),
        )
        .unwrap();

    // Edit Menu
    let edit_menu = Submenu::new(app, "Edit", true).unwrap();
    edit_menu
        .append(&PredefinedMenuItem::undo(app, None).unwrap())
        .unwrap();
    edit_menu
        .append(&PredefinedMenuItem::redo(app, None).unwrap())
        .unwrap();
    edit_menu
        .append(&PredefinedMenuItem::separator(app).unwrap())
        .unwrap();
    edit_menu
        .append(&PredefinedMenuItem::cut(app, None).unwrap())
        .unwrap();
    edit_menu
        .append(&PredefinedMenuItem::copy(app, None).unwrap())
        .unwrap();
    edit_menu
        .append(&PredefinedMenuItem::paste(app, None).unwrap())
        .unwrap();
    edit_menu
        .append(&PredefinedMenuItem::select_all(app, None).unwrap())
        .unwrap();
    edit_menu
        .append(&PredefinedMenuItem::separator(app).unwrap())
        .unwrap();
    edit_menu
        .append(&MenuItem::with_id(app, "copy_url", "Copy URL", true, Some("CmdOrCtrl+L")).unwrap())
        .unwrap();

    // View Menu
    let view_menu = Submenu::new(app, "View", true).unwrap();
    view_menu
        .append(&MenuItem::with_id(app, "reload", "Reload", true, Some("CmdOrCtrl+R")).unwrap())
        .unwrap();
    view_menu
        .append(&PredefinedMenuItem::separator(app).unwrap())
        .unwrap();
    view_menu
        .append(&MenuItem::with_id(app, "zoom_in", "Zoom In", true, Some("CmdOrCtrl+=")).unwrap())
        .unwrap();
    view_menu
        .append(&MenuItem::with_id(app, "zoom_out", "Zoom Out", true, Some("CmdOrCtrl+-")).unwrap())
        .unwrap();
    view_menu
        .append(
            &MenuItem::with_id(app, "zoom_reset", "Actual Size", true, Some("CmdOrCtrl+0"))
                .unwrap(),
        )
        .unwrap();
    view_menu
        .append(&PredefinedMenuItem::separator(app).unwrap())
        .unwrap();
    view_menu
        .append(&PredefinedMenuItem::fullscreen(app, None).unwrap())
        .unwrap();
    view_menu
        .append(&PredefinedMenuItem::separator(app).unwrap())
        .unwrap();
    view_menu
        .append(
            &MenuItem::with_id(
                app,
                "toggle_devtools",
                "Toggle Developer Tools",
                cfg!(debug_assertions),
                Some("CmdOrCtrl+Option+I"),
            )
            .unwrap(),
        )
        .unwrap();

    // Navigation Menu
    let navigation_menu = Submenu::new(app, "Navigation", true).unwrap();
    navigation_menu
        .append(&MenuItem::with_id(app, "go_back", "Back", true, Some("CmdOrCtrl+[")).unwrap())
        .unwrap();
    navigation_menu
        .append(
            &MenuItem::with_id(app, "go_forward", "Forward", true, Some("CmdOrCtrl+]")).unwrap(),
        )
        .unwrap();
    navigation_menu
        .append(
            &MenuItem::with_id(app, "go_home", "Go Home", true, Some("CmdOrCtrl+Shift+H")).unwrap(),
        )
        .unwrap();

    // Window Menu
    let window_menu = Submenu::new(app, "Window", true).unwrap();
    window_menu
        .append(&PredefinedMenuItem::minimize(app, None).unwrap())
        .unwrap();
    window_menu
        .append(&PredefinedMenuItem::maximize(app, None).unwrap())
        .unwrap();
    window_menu
        .append(&PredefinedMenuItem::separator(app).unwrap())
        .unwrap();
    window_menu
        .append(
            &MenuItem::with_id(
                app,
                "always_on_top",
                "Toggle Always on Top",
                true,
                None::<&str>,
            )
            .unwrap(),
        )
        .unwrap();
    window_menu
        .append(&PredefinedMenuItem::separator(app).unwrap())
        .unwrap();
    window_menu
        .append(&PredefinedMenuItem::close_window(app, None).unwrap())
        .unwrap();

    // Help Menu (Custom)
    let help_menu = Submenu::new(app, "Help", true).unwrap();
    let github_item = MenuItem::with_id(
        app,
        "pake_github_link",
        &pake_menu_item_title,
        true,
        None::<&str>,
    )
    .unwrap();
    help_menu.append(&github_item).unwrap();

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
    )
    .unwrap();

    menu
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
