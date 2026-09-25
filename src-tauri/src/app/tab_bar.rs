//! The "+" button on the macOS native tab bar.
//!
//! AppKit draws that button only when the clicked window's responder chain
//! answers `newWindowForTab:`. Neither Tauri nor tao implements the selector,
//! so a `--multi-window` app gets a tab bar with no way to add a tab from it.
//!
//! The action is installed on the window's own class, the first responder-chain
//! link Apple documents for this selector, so the click is handled by the window
//! that was clicked. The class is resolved from a live window rather than by
//! name, so a tao rename cannot silently break this. Installing on the class
//! covers every window tao creates, which is why nothing is installed at all
//! unless native tabbing is on.

use dispatch::Queue;
use objc2::ffi::class_addMethod;
use objc2::runtime::{AnyClass, AnyObject, Imp, Sel};
use objc2::{msg_send, sel};
use std::ffi::c_char;
use std::sync::OnceLock;
use tauri::{AppHandle, WebviewWindow};

use crate::app::window::open_additional_window_safe;

/// The Objective-C action carries no Rust context, so the handle has to reach
/// it through a static. A process hosts exactly one app, so this is set once.
static APP_HANDLE: OnceLock<AppHandle> = OnceLock::new();

/// `void newWindowForTab:(id)sender`: return, self, `_cmd`, sender.
const NEW_WINDOW_FOR_TAB_TYPES: &[u8] = b"v@:@\0";

/// Panicking across the FFI boundary is undefined, so this uses `extern "C"`
/// (which aborts instead) and keeps the body to a single infallible call.
extern "C" fn new_window_for_tab(_this: &AnyObject, _cmd: Sel, _sender: *mut AnyObject) {
    let Some(app) = APP_HANDLE.get() else {
        eprintln!("[Pake] The tab bar + button fired before the app handle was ready.");
        return;
    };
    open_additional_window_safe(app);
}

/// Teach the window's class to open a tab, which is what makes AppKit draw the
/// + button. Idempotent: later windows find the method already present.
pub fn install_new_tab_action(app: &AppHandle, window: &WebviewWindow) {
    let _ = APP_HANDLE.set(app.clone());

    let window = window.clone();
    Queue::main().exec_async(move || {
        let ns_window = match window.ns_window() {
            Ok(ns_window) => ns_window,
            Err(error) => {
                eprintln!("[Pake] Failed to access the macOS window for its tab bar: {error}");
                return;
            }
        };

        // SAFETY: Tauri hands back the window's live NSWindow, and this runs on
        // the main thread where AppKit owns it.
        let object = unsafe { &*(ns_window as *const AnyObject) };
        // KVO swizzles the instance's isa to a hidden `NSKVONotifying_` subclass.
        // Installing there is not enough: AppKit decides whether to draw the +
        // button from `[window class]`, which KVO overrides to report the real
        // class. Asking the window for its own class lands on the class AppKit
        // inspects; `object_getClass` would silently miss it.
        let class: &AnyClass = unsafe {
            let reported: *const AnyClass = msg_send![object, class];
            &*reported
        };
        let selector = sel!(newWindowForTab:);
        if class.instance_method(selector).is_some() {
            // Already installed, or a future tao implements it upstream.
            return;
        }

        // SAFETY: the implementation matches the encoding declared above, and
        // the selector is absent from the class, so nothing is overridden.
        let added = unsafe {
            let imp: Imp = std::mem::transmute::<
                extern "C" fn(&AnyObject, Sel, *mut AnyObject),
                Imp,
            >(new_window_for_tab);
            class_addMethod(
                class as *const AnyClass as *mut AnyClass,
                selector,
                imp,
                NEW_WINDOW_FOR_TAB_TYPES.as_ptr() as *const c_char,
            )
        };
        if !added.as_bool() {
            eprintln!("[Pake] Failed to install the tab bar + button action.");
        }
    });
}
