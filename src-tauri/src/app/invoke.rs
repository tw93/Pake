use std::fs;
use crate::util::{check_file_or_append, get_download_message, MessageType, show_toast};
use tauri::{api, command, AppHandle, Manager, Window};
use tauri::api::http::{ClientBuilder, HttpRequestBuilder, ResponseType};
use std::fs::File;
use std::io::Write;

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
    show_toast(&window, &get_download_message(MessageType::Start));

    let output_path = api::path::download_dir().unwrap().join(params.filename);
    let file_path = check_file_or_append(output_path.to_str().unwrap());
    let client = ClientBuilder::new().build().unwrap();

    let response = client.send(
        HttpRequestBuilder::new("GET", &params.url)
            .unwrap()
            .response_type(ResponseType::Binary)
    ).await;

    match response {
        Ok(res) => {
            let bytes = res.bytes().await.unwrap().data;

            let mut file = File::create(file_path).unwrap();
            file.write_all(&bytes).unwrap();
            show_toast(&window, &get_download_message(MessageType::Success));
            Ok(())
        }
        Err(e) => {
            show_toast(&window, &get_download_message(MessageType::Failure));
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
    show_toast(&window, &get_download_message(MessageType::Start));
    let output_path = api::path::download_dir().unwrap().join(params.filename);
    let file_path = check_file_or_append(output_path.to_str().unwrap());
    let download_file_result = fs::write(file_path, &params.binary);
    match download_file_result {
        Ok(_) => {
            show_toast(&window, &get_download_message(MessageType::Success));
            Ok(())
        }
        Err(e) => {
            show_toast(&window, &get_download_message(MessageType::Failure));
            Err(e.to_string())
        }
    }
}
