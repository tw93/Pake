use crate::util::{check_file_or_append, get_download_message, show_toast, MessageType};
use std::fs::File;
use std::io::Write;
use tauri::api::http::{ClientBuilder, HttpRequestBuilder, ResponseType};
use tauri::{api, command, AppHandle, Manager, Window};

#[derive(serde::Deserialize)]
pub struct DownloadFileParams {
    url: String,
    filename: String,
}

#[command]
pub async fn download_file(app: AppHandle, params: DownloadFileParams) -> Result<(), String> {
    let window: Window = app.get_window("pake").unwrap();
    show_toast(&window, &get_download_message(MessageType::Start));

    let output_path = api::path::download_dir().unwrap().join(params.filename);
    let file_path = check_file_or_append(output_path.to_str().unwrap());
    let client = ClientBuilder::new().build().unwrap();

    let response = client
        .send(
            HttpRequestBuilder::new("GET", &params.url)
                .unwrap()
                .response_type(ResponseType::Binary),
        )
        .await;

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
