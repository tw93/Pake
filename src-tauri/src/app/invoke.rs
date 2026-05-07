use crate::util::{check_file_or_append, get_download_message_with_lang, show_toast, MessageType};
use std::fs::{self, File};
use std::io::Write;
use std::str::FromStr;
use std::sync::atomic::{AtomicI64, Ordering};
use tauri::http::Method;
use tauri::{command, AppHandle, Manager, Url, WebviewWindow};
use tauri_plugin_http::reqwest::{ClientBuilder, Request};

#[cfg(target_os = "macos")]
use tauri::Theme;

static BADGE_COUNT: AtomicI64 = AtomicI64::new(0);

fn apply_badge(app: &AppHandle, count: Option<i64>) -> Result<(), String> {
    let label = count.filter(|n| *n > 0).map(|n| n.to_string());
    apply_badge_label(app, label.as_deref())
}

#[cfg(target_os = "macos")]
fn apply_badge_label(app: &AppHandle, label: Option<&str>) -> Result<(), String> {
    use objc2::MainThreadMarker;
    use objc2_app_kit::NSApplication;
    use objc2_foundation::NSString;

    let label = label.map(str::to_owned);
    app.run_on_main_thread(move || {
        let Some(mtm) = MainThreadMarker::new() else {
            return;
        };
        let dock_tile = NSApplication::sharedApplication(mtm).dockTile();
        let ns_label = label.as_deref().map(NSString::from_str);
        dock_tile.setBadgeLabel(ns_label.as_deref());
    })
    .map_err(|e| format!("Failed to dispatch dock badge update: {e}"))
}

#[cfg(not(target_os = "macos"))]
fn apply_badge_label(app: &AppHandle, label: Option<&str>) -> Result<(), String> {
    let window = app
        .get_webview_window("pake")
        .ok_or("Main window not found")?;
    let count = label.and_then(|s| s.parse::<i64>().ok());
    window
        .set_badge_count(count)
        .map_err(|e| format!("Failed to set badge count: {e}"))
}

#[derive(serde::Deserialize)]
pub struct DownloadFileParams {
    url: String,
    filename: String,
    language: Option<String>,
}

#[derive(serde::Deserialize)]
pub struct BinaryDownloadParams {
    filename: String,
    binary: Vec<u8>,
    language: Option<String>,
}

#[derive(serde::Deserialize)]
pub struct NotificationParams {
    title: String,
    body: String,
    icon: String,
}

#[command]
pub async fn download_file(app: AppHandle, params: DownloadFileParams) -> Result<(), String> {
    let window: WebviewWindow = app.get_webview_window("pake").ok_or("Window not found")?;

    show_toast(
        &window,
        &get_download_message_with_lang(MessageType::Start, params.language.clone()),
    );

    let download_dir = app
        .path()
        .download_dir()
        .map_err(|e| format!("Failed to get download dir: {}", e))?;

    let output_path = download_dir.join(&params.filename);

    let path_str = output_path.to_str().ok_or("Invalid output path")?;

    let file_path = check_file_or_append(path_str);

    let client = ClientBuilder::new()
        .build()
        .map_err(|e| format!("Failed to build client: {}", e))?;

    let url = Url::from_str(&params.url).map_err(|e| format!("Invalid URL: {}", e))?;

    let request = Request::new(Method::GET, url);

    let response = client.execute(request).await;

    match response {
        Ok(mut res) => {
            let mut file =
                File::create(file_path).map_err(|e| format!("Failed to create file: {}", e))?;

            while let Some(chunk) = res
                .chunk()
                .await
                .map_err(|e| format!("Failed to get chunk: {}", e))?
            {
                file.write_all(&chunk)
                    .map_err(|e| format!("Failed to write chunk: {}", e))?;
            }

            show_toast(
                &window,
                &get_download_message_with_lang(MessageType::Success, params.language.clone()),
            );
            Ok(())
        }
        Err(e) => {
            show_toast(
                &window,
                &get_download_message_with_lang(MessageType::Failure, params.language),
            );
            Err(e.to_string())
        }
    }
}

#[command]
pub async fn download_file_by_binary(
    app: AppHandle,
    params: BinaryDownloadParams,
) -> Result<(), String> {
    let window: WebviewWindow = app.get_webview_window("pake").ok_or("Window not found")?;

    show_toast(
        &window,
        &get_download_message_with_lang(MessageType::Start, params.language.clone()),
    );

    let download_dir = app
        .path()
        .download_dir()
        .map_err(|e| format!("Failed to get download dir: {}", e))?;

    let output_path = download_dir.join(&params.filename);

    let path_str = output_path.to_str().ok_or("Invalid output path")?;

    let file_path = check_file_or_append(path_str);

    match fs::write(file_path, &params.binary) {
        Ok(_) => {
            show_toast(
                &window,
                &get_download_message_with_lang(MessageType::Success, params.language.clone()),
            );
            Ok(())
        }
        Err(e) => {
            show_toast(
                &window,
                &get_download_message_with_lang(MessageType::Failure, params.language),
            );
            Err(e.to_string())
        }
    }
}

#[command]
pub fn send_notification(app: AppHandle, params: NotificationParams) -> Result<(), String> {
    use tauri_plugin_notification::NotificationExt;
    app.notification()
        .builder()
        .title(&params.title)
        .body(&params.body)
        .icon(&params.icon)
        .show()
        .map_err(|e| format!("Failed to show notification: {}", e))?;

    let next = BADGE_COUNT.fetch_add(1, Ordering::SeqCst) + 1;
    if let Err(error) = apply_badge(&app, Some(next)) {
        eprintln!("[Pake] Failed to update dock badge: {error}");
    }
    Ok(())
}

#[command]
pub fn set_dock_badge(app: AppHandle, count: Option<i64>) -> Result<(), String> {
    let normalized = count.filter(|n| *n > 0);
    BADGE_COUNT.store(normalized.unwrap_or(0), Ordering::SeqCst);
    apply_badge(&app, normalized)
}

#[command]
pub fn clear_dock_badge(app: AppHandle) -> Result<(), String> {
    BADGE_COUNT.store(0, Ordering::SeqCst);
    apply_badge(&app, None)
}

#[command]
pub fn set_dock_badge_label(app: AppHandle, label: Option<String>) -> Result<(), String> {
    BADGE_COUNT.store(0, Ordering::SeqCst);
    apply_badge_label(&app, label.as_deref().filter(|s| !s.is_empty()))
}

#[command]
pub async fn update_theme_mode(app: AppHandle, mode: String) {
    #[cfg(target_os = "macos")]
    {
        if let Some(window) = app.get_webview_window("pake") {
            let theme = if mode == "dark" {
                Theme::Dark
            } else {
                Theme::Light
            };
            let _ = window.set_theme(Some(theme));
        }
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = app;
        let _ = mode;
    }
}

#[command]
#[allow(unreachable_code)]
pub fn clear_cache_and_restart(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("pake") {
        match window.clear_all_browsing_data() {
            Ok(_) => {
                // Clear all browsing data successfully
                app.restart();
                Ok(())
            }
            Err(e) => {
                eprintln!("Failed to clear browsing data: {}", e);
                Err(format!("Failed to clear browsing data: {}", e))
            }
        }
    } else {
        Err("Main window not found".to_string())
    }
}
