use tauri::{AppHandle, Listener, Manager, WebviewWindow};
use tauri_plugin_clipboard_manager::ClipboardExt;

pub fn register(app: &AppHandle) {
    let app_handle = app.clone();
    app.listen("webpake:navigate-home", move |_event| {
        handle_navigate_home(&app_handle);
    });

    let app_handle = app.clone();
    app.listen("webpake:copy-url", move |_event| {
        handle_copy_url(&app_handle);
    });

    let app_handle = app.clone();
    app.listen("webpake:clear-cache", move |_event| {
        handle_clear_cache(&app_handle);
    });
}

fn main_window(app: &AppHandle) -> Option<WebviewWindow> {
    app.get_webview_window("main")
}

pub fn handle_navigate_home(app: &AppHandle) {
    let Some(window) = main_window(app) else {
        return;
    };
    let Some(state) = app.try_state::<crate::state::AppState>() else {
        return;
    };
    let home = escape_js_string(&state.config.url);
    let _ = window.eval(&format!("window.location.href = '{home}'"));
}

pub fn handle_copy_url(app: &AppHandle) {
    let Some(window) = main_window(app) else {
        return;
    };
    if let Ok(url) = window.url() {
        let _ = app.clipboard().write_text(url.to_string());
    }
}

pub fn handle_clear_cache(app: &AppHandle) {
    clear_app_cache(app);
    let _ = app.restart();
}

pub fn handle_refresh(app: &AppHandle) {
    if let Some(window) = main_window(app) {
        let _ = window.eval("location.reload()");
    }
}

pub fn handle_back(app: &AppHandle) {
    if let Some(window) = main_window(app) {
        let _ = window.eval("history.back()");
    }
}

pub fn handle_forward(app: &AppHandle) {
    if let Some(window) = main_window(app) {
        let _ = window.eval("history.forward()");
    }
}

pub fn handle_zoom(app: &AppHandle, delta: f64) {
    if let Some(window) = main_window(app) {
        let _ = window.eval(&format!(
            "document.body.style.zoom = Math.max(0.1, (parseFloat(document.body.style.zoom || '1') + {delta})).toString()"
        ));
    }
}

pub fn handle_zoom_reset(app: &AppHandle) {
    if let Some(window) = main_window(app) {
        let _ = window.eval("document.body.style.zoom = '1'");
    }
}

pub fn handle_hide_window(app: &AppHandle) {
    if let Some(window) = main_window(app) {
        let _ = window.hide();
    }
}

pub fn handle_show_window(app: &AppHandle) {
    if let Some(window) = main_window(app) {
        let _ = window.show();
        let _ = window.set_focus();
    }
}

pub fn handle_toggle_fullscreen(app: &AppHandle) {
    if let Some(window) = main_window(app) {
        if window.is_fullscreen().unwrap_or(false) {
            let _ = window.set_fullscreen(false);
        } else {
            let _ = window.set_fullscreen(true);
        }
    }
}

pub fn handle_toggle_devtools(app: &AppHandle) {
    if let Some(window) = main_window(app) {
        let _ = window.open_devtools();
    }
}

pub fn clear_app_cache(app: &AppHandle) {
    if let Some(cache_dir) = cache_directory(app) {
        let _ = std::fs::remove_dir_all(cache_dir);
    }
}

fn cache_directory(app: &AppHandle) -> Option<std::path::PathBuf> {
    let identifier = app.config().identifier.as_str();
    dirs::cache_dir().map(|d| d.join(identifier))
}

fn escape_js_string(value: &str) -> String {
    value.replace('\\', "\\\\").replace('\'', "\\'")
}
