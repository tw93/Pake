use tauri::{
    menu::{MenuBuilder, MenuItemBuilder},
    tray::TrayIconBuilder,
    AppHandle, Manager,
};
use tauri_plugin_window_state::{AppHandleExt, StateFlags};

pub fn set_system_tray(app: &AppHandle) -> tauri::Result<()> {
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
        .icon(app.default_window_icon().unwrap().clone())
        .build(app)?;

    tray.set_icon_as_template(false)?;
    Ok(())
}
