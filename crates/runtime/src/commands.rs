use crate::app::setup;
use crate::app::events;
use crate::state::AppState;
use tauri::{AppHandle, State, WebviewWindow};
use tauri_plugin_clipboard_manager::ClipboardExt;
use webpake_core::AppConfig;

#[tauri::command]
pub fn get_app_config(state: State<'_, AppState>) -> AppConfig {
    state.config.clone()
}

#[tauri::command]
pub async fn copy_current_url(
    app: AppHandle,
    window: WebviewWindow,
) -> Result<String, String> {
    let url = window
        .url()
        .map(|u| u.to_string())
        .map_err(|e| e.to_string())?;
    app.clipboard()
        .write_text(url.clone())
        .map_err(|e| e.to_string())?;
    Ok(url)
}

#[tauri::command]
pub async fn navigate_home(
    window: WebviewWindow,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let home = state.home_url().replace('\'', "\\'");
    window
        .eval(&format!("window.location.href = '{home}'"))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn clear_cache_and_restart(app: AppHandle) -> Result<(), String> {
    events::clear_app_cache(&app);
    app.restart();
}

#[tauri::command]
pub async fn show_notification(
    app: AppHandle,
    title: String,
    body: String,
) -> Result<(), String> {
    use tauri_plugin_notification::NotificationExt;
    app.notification()
        .builder()
        .title(title)
        .body(body)
        .show()
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn open_new_window(
    app: AppHandle,
    state: State<'_, AppState>,
    url: Option<String>,
) -> Result<(), String> {
    if !state.config.multi_window {
        return Err("multi-window mode is disabled".into());
    }
    setup::open_window(&app, &state, url.as_deref()).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn hide_window(window: WebviewWindow) -> Result<(), String> {
    window.hide().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn toggle_fullscreen(window: WebviewWindow) -> Result<(), String> {
    let next = !window.is_fullscreen().map_err(|e| e.to_string())?;
    window.set_fullscreen(next).map_err(|e| e.to_string())
}
