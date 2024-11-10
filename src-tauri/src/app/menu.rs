use tauri::{
    image::Image,
    menu::{MenuBuilder, MenuItemBuilder},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager,
};
use tauri_plugin_window_state::{AppHandleExt, StateFlags};

use super::config::PakeConfig;

pub fn set_system_tray(app: &AppHandle, pake_config: &PakeConfig) -> tauri::Result<()> {
    let hide_app = MenuItemBuilder::with_id("hide_app", "Hide").build(app)?;
    let show_app = MenuItemBuilder::with_id("show_app", "Show").build(app)?;
    let quit = MenuItemBuilder::with_id("quit", "Quit").build(app)?;
    let menu = MenuBuilder::new(app)
        .items(&[&hide_app, &show_app, &quit])
        .build()?;
    app.app_handle().remove_tray_by_id("pake-tray");
    let tray = TrayIconBuilder::new()
        .icon(Image::from_path(pake_config.system_tray_path.as_str())?)
        .menu(&menu)
        .on_tray_icon_event(move |tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                println!("click");

                let app = tray.app_handle();

                #[cfg(not(target_os = "macos"))]
                {
                    if let Some(webview_window) = app.get_webview_window("pake") {
                        let _ = webview_window.show();
                        let _ = webview_window.set_focus();
                    }
                }
                #[cfg(target_os = "macos")]
                {
                    tauri::AppHandle::show(&app.app_handle()).unwrap();
                }
            }
        })
        .on_menu_event(move |app, event| match event.id().as_ref() {
            "hide_app" => {
                app.get_webview_window("pake").unwrap().minimize().unwrap();
            }
            "show_app" => {
                app.get_webview_window("pake").unwrap().show().unwrap();
            }
            "quit" => {
                let _res = app.save_window_state(StateFlags::all());
                std::process::exit(0);
            }
            _ => (),
        })
        .build(app)?;

    tray.set_icon_as_template(false)?;
    Ok(())
}
