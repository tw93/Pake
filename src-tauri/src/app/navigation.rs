//! Cross-platform webview navigation that does not depend on page JS.
//! Blank error shells have no JS context, so `eval("history.back()")` and
//! `location.reload()` are dead exactly when the user is stuck.

use crate::app::window::{MultiWindowState, POPUP_WINDOW_LABEL_PREFIX};
use tauri::{Manager, WebviewWindow};

/// Reload the current document via the native webview API.
pub fn reload_window(window: &WebviewWindow) {
    if let Err(error) = window.reload() {
        eprintln!("[Pake] Failed to reload webview: {error}");
    }
}

/// Resolve the app's real home URL from its window config. Split out from
/// `home_url` so the mapping can be unit-tested without an AppHandle.
pub fn resolve_home_url(url_type: &str, url: &str) -> Option<tauri::Url> {
    match url_type {
        // A web app's configured url is already absolute.
        "web" => tauri::Url::parse(url).ok(),
        // A local-file app's url is only a basename; Tauri serves bundled assets
        // from tauri://localhost on macOS/Linux and http://tauri.localhost on Windows.
        // Resolving it against the currently loaded remote origin (as the old eval path did)
        // would point at the wrong server.
        "local" => {
            #[cfg(windows)]
            let base = "http://tauri.localhost";
            #[cfg(not(windows))]
            let base = "tauri://localhost";
            tauri::Url::parse(&format!("{base}/{url}")).ok()
        }
        _ => None,
    }
}

pub fn home_url(app: &tauri::AppHandle) -> Option<tauri::Url> {
    let state = app.try_state::<MultiWindowState>()?;
    let window_config = state.pake_config.windows.first()?;
    resolve_home_url(&window_config.url_type, &window_config.url)
}

/// A window a page opened, such as a sign-in popup, is not the app's: going
/// home there would throw the sign-in away. Every way home (the macOS menu's
/// Cmd+Shift+H, Ctrl+Shift+H on Windows and Linux, the IPC command) ends in
/// `navigate_home`, so it is checked here once.
pub fn goes_home(label: &str) -> bool {
    !label.starts_with(POPUP_WINDOW_LABEL_PREFIX)
}

/// Navigate the webview to the packaged home URL. Native navigation works
/// from a blank error page, where eval cannot run, and sends a local-file app
/// to its bundled asset instead of a path on the current origin.
pub fn navigate_home(window: &WebviewWindow) {
    if !goes_home(window.label()) {
        return;
    }
    match home_url(window.app_handle()) {
        Some(url) => {
            if let Err(error) = window.navigate(url) {
                eprintln!("[Pake] Failed to navigate to home URL: {error}");
            }
        }
        None => {
            let _ = window.eval("window.location.href = window.pakeConfig.url");
        }
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

/// Apply the password-save prompt setting, including explicit opt-out.
///
/// This deliberately configures the app's own WebView2 profile; it does not
/// access or share credentials with a Microsoft Edge profile.
#[cfg(windows)]
pub fn set_password_autosave(webview: &tauri::webview::PlatformWebview, enabled: bool) {
    use webview2_com::Microsoft::Web::WebView2::Win32::ICoreWebView2Settings4;
    use windows_core::Interface;

    let controller = webview.controller();
    let result = unsafe {
        controller
            .CoreWebView2()
            .and_then(|core| core.Settings())
            .and_then(|settings| settings.cast::<ICoreWebView2Settings4>())
            .and_then(|settings| settings.SetIsPasswordAutosaveEnabled(enabled))
    };

    if let Err(error) = result {
        eprintln!("[Pake] Failed to configure WebView2 password autosave: {error}");
    }
}

/// Let a two-finger horizontal trackpad swipe step history, as in Safari.
///
/// WKWebView leaves `allowsBackForwardNavigationGestures` off, and Tauri does
/// not expose Wry's builder switch, so set it on the native view directly.
#[cfg(target_os = "macos")]
pub fn enable_back_forward_gestures(webview: &tauri::webview::PlatformWebview) {
    use objc2::msg_send;
    use objc2::runtime::{AnyObject, Bool};

    let ptr = webview.inner() as *mut AnyObject;
    if ptr.is_null() {
        eprintln!("[Pake] Failed to access WKWebView for history swipe gestures");
        return;
    }
    unsafe {
        let _: () = msg_send![ptr, setAllowsBackForwardNavigationGestures: Bool::YES];
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn home_url_resolution() {
        assert_eq!(
            resolve_home_url("web", "https://github.com").map(|u| u.to_string()),
            Some("https://github.com/".to_string())
        );
        #[cfg(not(windows))]
        assert_eq!(
            resolve_home_url("local", "launcher.html").map(|u| u.to_string()),
            Some("tauri://localhost/launcher.html".to_string())
        );
        #[cfg(windows)]
        assert_eq!(
            resolve_home_url("local", "launcher.html").map(|u| u.to_string()),
            Some("http://tauri.localhost/launcher.html".to_string())
        );
        assert!(resolve_home_url("bogus", "whatever").is_none());
    }

    #[test]
    fn a_window_the_page_opened_never_goes_home() {
        assert!(goes_home("pake"));
        assert!(goes_home("pake-2"), "a Cmd+N clone is the app's own window");
        assert!(!goes_home("pake-popup-3"), "a sign-in popup keeps its page");
    }

    #[test]
    fn a_home_url_with_a_path_keeps_it() {
        assert_eq!(
            resolve_home_url("web", "https://example.com/app/").map(|u| u.to_string()),
            Some("https://example.com/app/".to_string())
        );
    }
}
