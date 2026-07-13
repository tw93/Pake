use crate::state::AppState;
use serde_json::json;
use tauri::{AppHandle, Listener, Manager, WebviewWindow};

const BOOTSTRAP: &str = include_str!("../../inject/bootstrap.js");

pub fn build_inject_script(state: &AppState) -> String {
    let config = json!({
        "customCss": state.config.inject.custom_css,
        "blockAds": state.config.inject.block_ads,
        "clipboardBridge": state.config.inject.clipboard_bridge,
        "inlineAuthPopups": state.config.inject.inline_auth_popups,
        "multiWindow": state.config.multi_window,
        "openExternalLinksInBrowser": state.config.open_external_links_in_browser,
        "homeUrl": state.config.url,
    });

    format!(
        "(function(){{\n\
         if(window.__WEBPAKE_LOADED__)return;\n\
         window.__WEBPAKE_LOADED__=true;\n\
         window.__WEBPAKE__={config};\n\
         {BOOTSTRAP}\n\
         }})();"
    )
}

pub fn inject_into_window(window: &WebviewWindow, state: &AppState) -> Result<(), tauri::Error> {
    window.eval(&build_inject_script(state))
}

pub fn register_inject_hooks(app: &AppHandle, state: &AppState) {
    let state = state.clone();
    let app_handle = app.clone();

    if let Some(window) = app.get_webview_window("main") {
        let window_label = window.label().to_string();
        window.listen("tauri://page-load", move |_event| {
            if let Some(w) = app_handle.get_webview_window(&window_label) {
                let script = format!(
                    "window.__WEBPAKE_LOADED__=false;\n{}",
                    build_inject_script(&state)
                );
                let _ = w.eval(&script);
            }
        });
    }
}

pub fn apply_user_agent(window: &WebviewWindow, user_agent: Option<&str>) {
    if let Some(ua) = user_agent {
        let _ = window.eval(&format!(
            "Object.defineProperty(navigator,'userAgent',{{get:()=>{ua:?}}});"
        ));
    }
}
