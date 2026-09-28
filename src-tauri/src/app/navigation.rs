//! Cross-platform webview navigation that does not depend on page JS.
//! Blank error shells have no JS context, so `eval("history.back()")` and
//! `location.reload()` are dead exactly when the user is stuck.

use tauri::WebviewWindow;

/// Reload the current document via the native webview API.
pub fn reload_window(window: &WebviewWindow) {
    if let Err(error) = window.reload() {
        eprintln!("[Pake] Failed to reload webview: {error}");
    }
}

/// Step the webview history without requiring a live page JS context.
pub fn history_step(window: &WebviewWindow, back: bool) {
    let stepped = window.with_webview(move |webview| {
        history_step_platform(&webview, back);
    });

    if stepped.is_err() {
        // Last resort when with_webview is unavailable (rare). Still fails on
        // blank error shells, but preserves SPA history when the page is live.
        let script = if back {
            "window.history.back()"
        } else {
            "window.history.forward()"
        };
        if let Err(error) = window.eval(script) {
            eprintln!("[Pake] Failed to step webview history: {error}");
        }
    }
}

/// Enable WebView2's profile-owned password manager for persistent windows.
///
/// This deliberately configures the app's own WebView2 profile; it does not
/// access or share credentials with a Microsoft Edge profile.
#[cfg(windows)]
pub fn enable_password_autosave(webview: &tauri::webview::PlatformWebview) {
    use webview2_com::Microsoft::Web::WebView2::Win32::{ICoreWebView2Profile6, ICoreWebView2_13};
    use windows_core::Interface;

    let controller = webview.controller();
    let result = unsafe {
        controller
            .CoreWebView2()
            .and_then(|core| core.cast::<ICoreWebView2_13>())
            .and_then(|core| core.Profile())
            .and_then(|profile| profile.cast::<ICoreWebView2Profile6>())
            .and_then(|profile| profile.SetIsPasswordAutosaveEnabled(true))
    };

    if let Err(error) = result {
        eprintln!("[Pake] Failed to enable WebView2 password autosave: {error}");
    }
}

#[cfg(target_os = "macos")]
fn history_step_platform(webview: &tauri::webview::PlatformWebview, back: bool) {
    use objc2::msg_send;
    use objc2::runtime::AnyObject;

    let ptr = webview.inner() as *mut AnyObject;
    if ptr.is_null() {
        return;
    }
    unsafe {
        if back {
            let _: *mut AnyObject = msg_send![ptr, goBack];
        } else {
            let _: *mut AnyObject = msg_send![ptr, goForward];
        }
    }
}

#[cfg(target_os = "linux")]
fn history_step_platform(webview: &tauri::webview::PlatformWebview, back: bool) {
    use webkit2gtk::WebViewExt;

    let gtk_webview = webview.inner();
    if back {
        gtk_webview.go_back();
    } else {
        gtk_webview.go_forward();
    }
}

#[cfg(windows)]
fn history_step_platform(webview: &tauri::webview::PlatformWebview, back: bool) {
    let controller = webview.controller();
    unsafe {
        // ICoreWebView2Controller::CoreWebView2 returns the underlying browser.
        let Ok(core) = controller.CoreWebView2() else {
            return;
        };
        if back {
            let _ = core.GoBack();
        } else {
            let _ = core.GoForward();
        }
    }
}

#[cfg(not(any(target_os = "macos", target_os = "linux", windows)))]
fn history_step_platform(_webview: &tauri::webview::PlatformWebview, _back: bool) {}
