use tauri::{CustomMenuItem, Manager, SystemTray, SystemTrayEvent, SystemTrayMenu};
use tauri_plugin_window_state::{AppHandleExt, StateFlags};

pub fn get_system_tray() -> SystemTray {
    let hide_app = CustomMenuItem::new("hide_app".to_string(), "Hide");
    let show_app = CustomMenuItem::new("show_app".to_string(), "Show");
    let quit = CustomMenuItem::new("quit".to_string(), "Quit");
    let tray_menu = SystemTrayMenu::new()
        .add_item(show_app)
        .add_item(hide_app)
        .add_item(quit);
    SystemTray::new().with_menu(tray_menu)
}

pub fn system_tray_handle(app: &tauri::AppHandle, event: SystemTrayEvent) {
    if let SystemTrayEvent::MenuItemClick { tray_id: _, id, .. } = event {
        match id.as_str() {
            "hide_app" => {
                app.get_window("pake").unwrap().minimize().unwrap();
            }
            "show_app" => {
                app.get_window("pake").unwrap().show().unwrap();
            }
            "quit" => {
                let _res = app.save_window_state(StateFlags::all());
                std::process::exit(0);
            }
            _ => {}
        }
    };
}
