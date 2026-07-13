use crate::app::events;
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem, Submenu},
    AppHandle, Manager,
};

pub fn build_menu(handle: &AppHandle) -> tauri::Result<()> {
    let navigate_back = MenuItem::with_id(handle, "navigate_back", "Back", true, None::<&str>)?;
    let navigate_forward =
        MenuItem::with_id(handle, "navigate_forward", "Forward", true, None::<&str>)?;
    let navigate_home = MenuItem::with_id(handle, "navigate_home", "Home", true, None::<&str>)?;
    let refresh = MenuItem::with_id(handle, "refresh", "Refresh", true, None::<&str>)?;
    let copy_url = MenuItem::with_id(handle, "copy_url", "Copy URL", true, None::<&str>)?;
    let zoom_in = MenuItem::with_id(handle, "zoom_in", "Zoom In", true, None::<&str>)?;
    let zoom_out = MenuItem::with_id(handle, "zoom_out", "Zoom Out", true, None::<&str>)?;
    let zoom_reset = MenuItem::with_id(handle, "zoom_reset", "Reset Zoom", true, None::<&str>)?;
    let clear_cache =
        MenuItem::with_id(handle, "clear_cache", "Clear Cache && Restart", true, None::<&str>)?;
    let toggle_fullscreen =
        MenuItem::with_id(handle, "toggle_fullscreen", "Toggle Fullscreen", true, None::<&str>)?;

    let nav_submenu = Submenu::with_items(
        handle,
        "Navigate",
        true,
        &[
            &navigate_back,
            &navigate_forward,
            &navigate_home,
            &refresh,
            &copy_url,
        ],
    )?;

    let zoom_submenu = Submenu::with_items(
        handle,
        "View",
        true,
        &[&zoom_in, &zoom_out, &zoom_reset, &toggle_fullscreen],
    )?;

    let menu = Menu::with_items(
        handle,
        &[
            &nav_submenu,
            &zoom_submenu,
            &PredefinedMenuItem::separator(handle)?,
            &clear_cache,
            &PredefinedMenuItem::quit(handle, None)?,
        ],
    )?;

    if let Some(window) = handle.get_webview_window("main") {
        window.set_menu(menu)?;
        let app_handle = handle.clone();
        window.on_menu_event(move |_window, event| {
            match event.id().as_ref() {
                "navigate_back" => events::handle_back(&app_handle),
                "navigate_forward" => events::handle_forward(&app_handle),
                "navigate_home" => events::handle_navigate_home(&app_handle),
                "refresh" => events::handle_refresh(&app_handle),
                "copy_url" => events::handle_copy_url(&app_handle),
                "zoom_in" => events::handle_zoom(&app_handle, 0.1),
                "zoom_out" => events::handle_zoom(&app_handle, -0.1),
                "zoom_reset" => events::handle_zoom_reset(&app_handle),
                "toggle_fullscreen" => events::handle_toggle_fullscreen(&app_handle),
                "clear_cache" => events::handle_clear_cache(&app_handle),
                _ => {}
            }
        });
    }

    Ok(())
}
