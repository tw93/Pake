//! `window.close()` for a popup on macOS.
//!
//! A sign-in popup hands its result to its opener and closes itself. WebKit
//! does not close anything for that call: it tells the UI delegate
//! (`webViewDidClose:`), and Wry's delegate has no such method, so the popup
//! stayed on screen, blank, after the sign-in it was opened for had finished.
//!
//! The method goes on the delegate's own class, as `script_dialogs.rs` adds
//! its panels, and it closes only windows marked here: the popups a page
//! opened. WebKit also sends the message for a main window whose page calls
//! `window.close()`, and that window must stay.
//!
//! The window is hidden at once and closed a moment later. A callback page
//! closes itself while it is still loading, when Pake's own scripts have IPC
//! calls in flight; destroying the web view stops those requests, WebKit
//! raises on an answer to a stopped request, and the release profile's
//! `panic = "abort"` turns that exception into the whole app quitting (Wry's
//! `objc2::exception::catch` around the answer cannot hold under it). Measured
//! on macOS 26.7: closing at once aborted the app on every sign-in.

use objc2::ffi::class_addMethod;
use objc2::msg_send;
use objc2::rc::Retained;
use objc2::runtime::{AnyClass, AnyObject, Imp, Sel};
use objc2_foundation::NSString;
use std::ffi::CStr;
use std::sync::OnceLock;
use std::time::Duration;
use tauri::{AppHandle, Manager};

/// How long a hidden popup outlives its `window.close()`: the IPC calls of a
/// page load answer in milliseconds.
const CLOSE_GRACE: Duration = Duration::from_millis(1_000);

/// `void webViewDidClose:(WKWebView *)webView`: return, self, `_cmd`, webview.
const DID_CLOSE: (&CStr, &CStr) = (c"webViewDidClose:", c"v@:@");

/// The delegate method carries no Rust context; a process hosts one app.
static APP_HANDLE: OnceLock<AppHandle> = OnceLock::new();

/// Its address keys the popup's window label on the webview.
static POPUP_LABEL_KEY: u8 = 0;

extern "C" fn did_close(_this: &AnyObject, _cmd: Sel, webview: *mut AnyObject) {
    if webview.is_null() {
        return;
    }
    // SAFETY: WebKit calls this on the main thread with the live webview, and
    // the associated object is the NSString `install` retained on it.
    let label = unsafe {
        let label = objc2::ffi::objc_getAssociatedObject(
            webview as *const AnyObject,
            &POPUP_LABEL_KEY as *const u8 as *const std::ffi::c_void,
        ) as *const NSString;
        match label.as_ref() {
            Some(label) => label.to_string(),
            // Not a popup: the page's window.close() leaves the window alone.
            None => return,
        }
    };
    let Some(window) = APP_HANDLE
        .get()
        .and_then(|app| app.get_webview_window(&label))
    else {
        return;
    };
    // Gone from the screen now; see the module comment for the wait.
    if let Err(error) = window.hide() {
        eprintln!("[Pake] Failed to hide the popup its page closed: {error}");
    }
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(CLOSE_GRACE).await;
        // Tauri's own close, so the window leaves its window list as it
        // would from the close button.
        if let Err(error) = window.close() {
            eprintln!("[Pake] Failed to close the popup its page closed: {error}");
        }
    });
}

/// Let the page in this popup close its window. `label` is the popup's Tauri
/// window label. Idempotent for the class; every popup is marked.
pub fn install(app: &AppHandle, label: &str, webview: &tauri::webview::PlatformWebview) {
    let _ = APP_HANDLE.set(app.clone());
    let view = webview.inner() as *mut AnyObject;
    if view.is_null() {
        eprintln!("[Pake] Failed to access WKWebView for its popup close");
        return;
    }
    // SAFETY: Tauri runs this on the main thread with the live WKWebView.
    unsafe {
        let delegate: *mut AnyObject = msg_send![view, UIDelegate];
        if delegate.is_null() {
            eprintln!("[Pake] The WKWebView has no UI delegate for its popup close");
            return;
        }
        let marker = NSString::from_str(label);
        objc2::ffi::objc_setAssociatedObject(
            view,
            &POPUP_LABEL_KEY as *const u8 as *const std::ffi::c_void,
            Retained::as_ptr(&marker) as *mut AnyObject,
            objc2::ffi::OBJC_ASSOCIATION_RETAIN_NONATOMIC,
        );

        let class: *const AnyClass = msg_send![delegate, class];
        let class = &*class;
        let selector = Sel::register(DID_CLOSE.0);
        if class.instance_method(selector).is_none() {
            let imp: Imp = std::mem::transmute::<extern "C" fn(&AnyObject, Sel, *mut AnyObject), Imp>(
                did_close,
            );
            let added = class_addMethod(
                class as *const AnyClass as *mut AnyClass,
                selector,
                imp,
                DID_CLOSE.1.as_ptr(),
            );
            if !added.as_bool() {
                eprintln!("[Pake] Failed to install the popup close on the UI delegate.");
                return;
            }
        }
        // WebKit notes which methods a delegate answers when it is set, so
        // the same delegate is set again, as for the script dialogs.
        let Some(delegate) = Retained::retain(delegate) else {
            return;
        };
        let none: *mut AnyObject = std::ptr::null_mut();
        let _: () = msg_send![view, setUIDelegate: none];
        let _: () = msg_send![view, setUIDelegate: &*delegate];
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_close_encoding_matches_its_selector() {
        let selector = DID_CLOSE.0.to_str().unwrap();
        let arguments = DID_CLOSE.1.to_str().unwrap().strip_prefix("v@:").unwrap();
        assert_eq!(arguments.chars().count(), selector.matches(':').count());
    }
}
