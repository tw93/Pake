use tauri::{api, command, AppHandle, Manager};

#[command]
pub fn drag_window(app: AppHandle) {
    app.get_window("pake").unwrap().start_dragging().unwrap();
}

#[command]
pub fn fullscreen(app: AppHandle) {
    let win = app.get_window("pake").unwrap();
    if win.is_fullscreen().unwrap() {
        win.set_fullscreen(false).unwrap();
    } else {
        win.set_fullscreen(true).unwrap();
    }
}

#[tauri::command]
pub fn open_browser(app: AppHandle, url: String) {
    api::shell::open(&app.shell_scope(), url, None).unwrap();
}
