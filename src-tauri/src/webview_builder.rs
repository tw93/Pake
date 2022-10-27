use tauri_utils::config::WindowConfig;
use wry::{
    application::window::{Fullscreen, Window},
    webview::{WebView, WebViewBuilder},
};

pub fn get_webview(window_config: &WindowConfig, window: Window) -> WebView {
    // --------------------------------------------------------
    // 创建 webview
    // --------------------------------------------------------
    let handler = move |window: &Window, req: String| {
        if req == "drag_window" {
            let _ = window.drag_window();
        } else if req == "fullscreen" {
            if window.fullscreen().is_some() {
                window.set_fullscreen(None);
            } else {
                window.set_fullscreen(Some(Fullscreen::Borderless(None)));
            }
        }
    };

    let webview = WebViewBuilder::new(window)
        .unwrap()
        .with_url(&window_config.url.to_string())
        .unwrap()
        // .with_devtools(true)
        .with_initialization_script(include_str!("pake.js"))
        .with_ipc_handler(handler)
        .build()
        .unwrap();

    webview
}
