//! `alert()`, `confirm()` and `prompt()` for pages in a macOS app.
//!
//! WKWebView shows none of the three by itself: it asks its UI delegate, and
//! when the delegate has no answer `alert` returns at once, `confirm` returns
//! false and `prompt` returns null. Wry's delegate implements none of them, so a
//! site that asks "Log out?" before logging out did nothing when clicked.
//!
//! The three delegate methods are added to the delegate's own class, resolved
//! from a live webview as `tab_bar.rs` resolves the window's, and only where
//! the class does not answer them already, so a Wry that grows its own keeps
//! it. WebKit notes which methods a delegate answers when the delegate is set,
//! so after adding them the same delegate is set again, or WebKit goes on
//! believing it has none. Each shows a native alert as a sheet on the page's window and hands
//! WebKit's completion handler the answer when it is dismissed, which is what
//! keeps the page's script waiting, as in a browser.

use block2::{Block, RcBlock};
use objc2::ffi::class_addMethod;
use objc2::rc::Retained;
use objc2::runtime::{AnyClass, AnyObject, Bool, Imp, Sel};
use objc2::{msg_send, MainThreadMarker};
use objc2_app_kit::{NSAlert, NSAlertFirstButtonReturn, NSTextField};
use objc2_foundation::{NSPoint, NSRect, NSSize, NSString};
use std::cell::Cell;
use std::ffi::CStr;

use crate::util::UiLanguage;

/// `void (id webView, NSString *message, WKFrameInfo *frame, block)`.
const MESSAGE_PANEL_TYPES: &CStr = c"v@:@@@@?";
/// The text panel carries the default text before the frame.
const TEXT_PANEL_TYPES: &CStr = c"v@:@@@@@?";
/// The three WKUIDelegate methods, each with the encoding its handler is
/// installed under. A selector takes one argument per colon, and an encoding
/// that disagrees makes the runtime read the wrong registers.
const ALERT_PANEL: (&CStr, &CStr) = (
    c"webView:runJavaScriptAlertPanelWithMessage:initiatedByFrame:completionHandler:",
    MESSAGE_PANEL_TYPES,
);
const CONFIRM_PANEL: (&CStr, &CStr) = (
    c"webView:runJavaScriptConfirmPanelWithMessage:initiatedByFrame:completionHandler:",
    MESSAGE_PANEL_TYPES,
);
const TEXT_PANEL: (&CStr, &CStr) = (
    c"webView:runJavaScriptTextInputPanelWithPrompt:defaultText:initiatedByFrame:completionHandler:",
    TEXT_PANEL_TYPES,
);
const PROMPT_FIELD_WIDTH: f64 = 260.0;
const PROMPT_FIELD_HEIGHT: f64 = 24.0;

/// The two buttons as AppKit names them in each language.
fn button_titles() -> (&'static str, &'static str) {
    match UiLanguage::system() {
        UiLanguage::English => ("OK", "Cancel"),
        UiLanguage::SimplifiedChinese | UiLanguage::TraditionalChinese => ("好", "取消"),
    }
}

/// What the page asked for; only `alert` has no way to say no.
#[derive(Clone, Copy, PartialEq)]
enum Panel {
    Alert,
    Confirm,
    Prompt,
}

/// Show one panel for `webview` and call `finish` exactly once with whether it
/// was accepted and, for a prompt, the text in its field.
///
/// # Safety
/// Main thread only; `webview` is the live WKWebView WebKit passed in, and the
/// strings are valid `NSString` pointers or null.
unsafe fn present(
    webview: *mut AnyObject,
    message: *mut NSString,
    default_text: *mut NSString,
    panel: Panel,
    finish: Box<dyn FnOnce(bool, Option<Retained<NSString>>)>,
) {
    let Some(mtm) = MainThreadMarker::new() else {
        finish(false, None);
        return;
    };
    let alert = NSAlert::new(mtm);
    match message.as_ref() {
        Some(message) => alert.setMessageText(message),
        None => alert.setMessageText(&NSString::new()),
    }
    let field = (panel == Panel::Prompt).then(|| {
        let field = NSTextField::initWithFrame(
            mtm.alloc(),
            NSRect::new(
                NSPoint::new(0.0, 0.0),
                NSSize::new(PROMPT_FIELD_WIDTH, PROMPT_FIELD_HEIGHT),
            ),
        );
        if let Some(text) = default_text.as_ref() {
            field.setStringValue(text);
        }
        alert.setAccessoryView(Some(&field));
        field
    });
    let (accept, cancel) = button_titles();
    alert.addButtonWithTitle(&NSString::from_str(accept));
    if panel != Panel::Alert {
        let cancel = alert.addButtonWithTitle(&NSString::from_str(cancel));
        // AppKit gives Escape to a button titled Cancel, which a translated
        // title is not, so it is bound here.
        cancel.setKeyEquivalent(&NSString::from_str("\u{1b}"));
    }
    if let Some(field) = &field {
        alert.layout();
        alert.window().makeFirstResponder(Some(field));
    }

    // WebKit raises if its handler is never called and again if it is called
    // twice, so the answer leaves through a slot that empties on first use.
    let finish = Cell::new(Some(finish));
    let shown = alert.clone();
    let answer = RcBlock::new(move |response: isize| {
        // Held until the panel is dismissed.
        let _ = &shown;
        let Some(finish) = finish.take() else {
            return;
        };
        let accepted = response == NSAlertFirstButtonReturn;
        let text = field
            .as_ref()
            .filter(|_| accepted)
            .map(|field| field.stringValue());
        finish(accepted, text);
    });

    let window: *mut AnyObject = if webview.is_null() {
        std::ptr::null_mut()
    } else {
        msg_send![webview, window]
    };
    if window.is_null() {
        // No window to hang a sheet on: an app-modal panel still answers.
        let response = alert.runModal();
        answer.call((response,));
        return;
    }
    // On the page's own window even when that window is hidden or minimised,
    // as a closed window is with hide-on-close: the sheet shows with the
    // window, and until then the page waits as a background tab's does. An
    // app-modal panel here would float over whatever else the user is doing.
    let _: () = msg_send![&*alert, beginSheetModalForWindow: window, completionHandler: &*answer];
}

extern "C" fn run_alert(
    _this: &AnyObject,
    _cmd: Sel,
    webview: *mut AnyObject,
    message: *mut NSString,
    _frame: *mut AnyObject,
    handler: *mut Block<dyn Fn()>,
) {
    // SAFETY: WebKit calls this on the main thread with a live webview and a
    // completion handler it expects back exactly once.
    unsafe {
        let Some(done) = RcBlock::copy(handler) else {
            return;
        };
        present(
            webview,
            message,
            std::ptr::null_mut(),
            Panel::Alert,
            Box::new(move |_, _| done.call(())),
        );
    }
}

extern "C" fn run_confirm(
    _this: &AnyObject,
    _cmd: Sel,
    webview: *mut AnyObject,
    message: *mut NSString,
    _frame: *mut AnyObject,
    handler: *mut Block<dyn Fn(Bool)>,
) {
    // SAFETY: as `run_alert`.
    unsafe {
        let Some(done) = RcBlock::copy(handler) else {
            return;
        };
        present(
            webview,
            message,
            std::ptr::null_mut(),
            Panel::Confirm,
            Box::new(move |accepted, _| done.call((Bool::new(accepted),))),
        );
    }
}

extern "C" fn run_prompt(
    _this: &AnyObject,
    _cmd: Sel,
    webview: *mut AnyObject,
    message: *mut NSString,
    default_text: *mut NSString,
    _frame: *mut AnyObject,
    handler: *mut Block<dyn Fn(*mut NSString)>,
) {
    // SAFETY: as `run_alert`.
    unsafe {
        let Some(done) = RcBlock::copy(handler) else {
            return;
        };
        present(
            webview,
            message,
            default_text,
            Panel::Prompt,
            Box::new(move |_, text| match text {
                Some(text) => done.call((Retained::as_ptr(&text) as *mut NSString,)),
                None => done.call((std::ptr::null_mut(),)),
            }),
        );
    }
}

/// Teach this webview's UI delegate to show the three script panels.
/// Idempotent: later webviews find the methods already on the class.
pub fn install(webview: &tauri::webview::PlatformWebview) {
    let view = webview.inner() as *mut AnyObject;
    if view.is_null() {
        eprintln!("[Pake] Failed to access WKWebView for its script dialogs");
        return;
    }
    // SAFETY: Tauri runs this on the main thread with the live WKWebView.
    unsafe {
        let delegate: *mut AnyObject = msg_send![view, UIDelegate];
        if delegate.is_null() {
            eprintln!("[Pake] The WKWebView has no UI delegate for its script dialogs");
            return;
        }
        let class: *const AnyClass = msg_send![delegate, class];
        let class = &*class;
        let alert: Imp = std::mem::transmute::<
            extern "C" fn(
                &AnyObject,
                Sel,
                *mut AnyObject,
                *mut NSString,
                *mut AnyObject,
                *mut Block<dyn Fn()>,
            ),
            Imp,
        >(run_alert);
        let confirm: Imp = std::mem::transmute::<
            extern "C" fn(
                &AnyObject,
                Sel,
                *mut AnyObject,
                *mut NSString,
                *mut AnyObject,
                *mut Block<dyn Fn(Bool)>,
            ),
            Imp,
        >(run_confirm);
        let prompt: Imp = std::mem::transmute::<
            extern "C" fn(
                &AnyObject,
                Sel,
                *mut AnyObject,
                *mut NSString,
                *mut NSString,
                *mut AnyObject,
                *mut Block<dyn Fn(*mut NSString)>,
            ),
            Imp,
        >(run_prompt);
        for ((selector, types), imp) in [
            (ALERT_PANEL, alert),
            (CONFIRM_PANEL, confirm),
            (TEXT_PANEL, prompt),
        ] {
            let selector = Sel::register(selector);
            if class.instance_method(selector).is_some() {
                continue;
            }
            let added = class_addMethod(
                class as *const AnyClass as *mut AnyClass,
                selector,
                imp,
                types.as_ptr(),
            );
            if !added.as_bool() {
                eprintln!("[Pake] Failed to install a script dialog on the UI delegate.");
            }
        }
        // Every webview, not only the first: each one cached its delegate's
        // answers when Wry set it, before the methods were there.
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

    /// The arguments an encoding declares after `self` and `_cmd`; a block is
    /// written `@?` and counts once.
    fn declared_arguments(types: &CStr) -> usize {
        let types = types.to_str().unwrap();
        let arguments = types.strip_prefix("v@:").expect("void, self, _cmd");
        arguments.replace("@?", "B").chars().count()
    }

    #[test]
    fn script_panel_encodings_match_their_selectors() {
        for (selector, types) in [ALERT_PANEL, CONFIRM_PANEL, TEXT_PANEL] {
            let selector = selector.to_str().unwrap();
            let colons = selector.matches(':').count();
            assert_eq!(declared_arguments(types), colons, "{selector}");
            // WebKit's last argument is always the completion handler block.
            assert!(types.to_str().unwrap().ends_with("@?"), "{selector}");
            assert!(selector.ends_with("completionHandler:"), "{selector}");
        }
        // The text panel is the one with a default text before the frame.
        assert_eq!(
            declared_arguments(TEXT_PANEL.1),
            declared_arguments(ALERT_PANEL.1) + 1
        );
    }

    #[test]
    fn cancel_and_accept_are_named_in_every_language() {
        let (accept, cancel) = button_titles();
        assert!(!accept.is_empty() && !cancel.is_empty() && accept != cancel);
    }
}
