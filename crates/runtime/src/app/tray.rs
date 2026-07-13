use crate::app::events;
use crate::state::AppState;
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle,
};

pub fn setup(app: &AppHandle, state: &AppState) -> Result<(), Box<dyn std::error::Error>> {
    if !state.config.system_tray {
        return Ok(());
    }

    let show = MenuItem::with_id(app, "tray_show", "Show Window", true, None::<&str>)?;
    let hide = MenuItem::with_id(app, "tray_hide", "Hide Window", true, None::<&str>)?;
    let quit = PredefinedMenuItem::quit(app, Some("Quit"))?;
    let tray_menu = Menu::with_items(app, &[&show, &hide, &quit])?;

    let icon = app
        .default_window_icon()
        .ok_or("missing default window icon for tray")?
        .clone();

    let app_handle = app.clone();
    TrayIconBuilder::new()
        .icon(icon)
        .menu(&tray_menu)
        .tooltip(state.config.display_title())
        .on_menu_event(move |app, event| match event.id.as_ref() {
            "tray_show" => events::handle_show_window(app),
            "tray_hide" => events::handle_hide_window(app),
            _ => {}
        })
        .on_tray_icon_event(move |tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                events::handle_show_window(tray.app_handle());
            }
        })
        .build(&app_handle)?;

    Ok(())
}
