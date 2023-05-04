use crate::util::{check_file_or_append, get_download_message, show_toast};
use download_rs::sync_download::Download;
use tauri::{api, command, AppHandle, Manager, Window};

#[derive(serde::Deserialize)]
pub struct DownloadFileParams {
    url: String,
    filename: String,
}

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

#[command]
pub fn open_browser(app: AppHandle, url: String) {
    api::shell::open(&app.shell_scope(), url, None).unwrap();
}

#[command]
pub async fn download_file(app: AppHandle, params: DownloadFileParams) -> Result<(), String> {
    let window: Window = app.get_window("pake").unwrap();
    let output_path = api::path::download_dir().unwrap().join(params.filename);
    let file_path = check_file_or_append(output_path.to_str().unwrap());
    let download = Download::new(&params.url, Some(&file_path), None);
    match download.download() {
        Ok(_) => {
            show_toast(&window, &get_download_message());
            Ok(())
        }
        Err(e) => {
            show_toast(&window, &e.to_string());
            Err(e.to_string())
        }
    }
}
