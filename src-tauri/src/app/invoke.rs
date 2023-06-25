use std::fs;

use crate::util::{check_file_or_append, get_download_message, show_toast};
use download_rs::sync_download::Download;
use tauri::{api, command, AppHandle, Manager, Window};

#[derive(serde::Deserialize)]
pub struct DownloadFileParams {
    url: String,
    filename: String,
}

#[derive(serde::Deserialize)]
pub struct BinaryDownloadParams {
    filename: String,
    binary: Vec<u8>,
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

#[command]
pub async fn download_file_by_binary(
    app: AppHandle,
    params: BinaryDownloadParams,
) -> Result<(), String> {
    let window: Window = app.get_window("pake").unwrap();
    let output_path = api::path::download_dir().unwrap().join(params.filename);
    let file_path = check_file_or_append(output_path.to_str().unwrap());
    let download_file_result = fs::write(file_path, &params.binary);
    match download_file_result {
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
