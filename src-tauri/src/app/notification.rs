//! Native notification delivery with a real click callback.
//!
//! `tauri-plugin-notification` is fire-and-forget on desktop: `show()` hands the
//! notification to `notify_rust` and drops the handle, so nothing ever tells the
//! page which notification the user clicked. Because Pake replaces the page's
//! `window.Notification` wholesale, that also kills the page's own click
//! routing: Slack never jumps to the conversation the notification came from.
//!
//! macOS therefore delivers notifications itself through
//! `NSUserNotificationCenter` with a delegate and routes the click back to the
//! originating webview. Other platforms keep the plugin path, and the page falls
//! back to the focus heuristic in `inject/event.js`.

use tauri::{AppHandle, WebviewWindow};

/// Ids are minted by the packaged (untrusted) page and echoed into a native
/// notification identifier and a webview `eval`, so keep them short and opaque.
const MAX_NOTIFICATION_ID_LEN: usize = 64;

#[derive(serde::Deserialize)]
pub struct NotificationParams {
    id: String,
    title: String,
    body: String,
    icon: String,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NotificationOutcome {
    /// True when this platform reports the click back to the page. The page
    /// keeps its focus-based fallback disabled in that case, so an ordinary app
    /// switch never fires a phantom click on the newest notification.
    native_click: bool,
}

fn validate_id(id: &str) -> Result<(), String> {
    if id.is_empty() || id.len() > MAX_NOTIFICATION_ID_LEN {
        return Err(format!(
            "Notification id must be 1-{MAX_NOTIFICATION_ID_LEN} characters"
        ));
    }
    if !id
        .bytes()
        .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
    {
        return Err("Notification id must be alphanumeric, '-' or '_'".to_string());
    }
    Ok(())
}

/// Set up the platform click callback. Runs on the main thread during setup so
/// the availability probe is a plain synchronous check later on.
pub fn init_native_click(app: &AppHandle) {
    #[cfg(target_os = "macos")]
    macos::init(app);
    #[cfg(not(target_os = "macos"))]
    let _ = app;
}

pub fn send(
    app: &AppHandle,
    window: &WebviewWindow,
    params: &NotificationParams,
) -> Result<NotificationOutcome, String> {
    validate_id(&params.id)?;

    #[cfg(target_os = "macos")]
    if macos::deliver(app, window.label(), params)? {
        return Ok(NotificationOutcome { native_click: true });
    }
    #[cfg(not(target_os = "macos"))]
    let _ = window;

    use tauri_plugin_notification::NotificationExt;
    app.notification()
        .builder()
        .title(&params.title)
        .body(&params.body)
        .icon(&params.icon)
        .show()
        .map_err(|e| format!("Failed to show notification: {e}"))?;

    Ok(NotificationOutcome {
        native_click: false,
    })
}

/// Reveal the window the notification came from and hand the click to the page.
///
/// A hidden or minimized window is exactly the case where a notification click
/// matters most, so this goes through the same show + `reapply_window_icon` +
/// focus sequence as every other hidden-to-visible path (#1323).
#[cfg(target_os = "macos")]
fn dispatch_click(app: &AppHandle, window_label: &str, id: &str) {
    use tauri::Manager;

    let Some(window) = app.get_webview_window(window_label) else {
        return;
    };

    let _ = window.unminimize();
    let _ = window.show();
    crate::app::window::reapply_window_icon(&window);
    let _ = window.set_focus();

    // `id` passed `validate_id`, so it cannot break out of the string literal.
    let _ = window.eval(format!(
        "window.__pakeNotificationClick && window.__pakeNotificationClick('{id}')"
    ));
}

#[cfg(target_os = "macos")]
mod macos {
    // The whole NSUserNotification family is deprecated in favour of
    // UserNotifications.framework, which needs a provisioned bundle and a
    // permission prompt that a webpage wrapper cannot meaningfully ask for.
    // This is also the API the notification plugin already reaches through
    // notify-rust, so staying on it keeps notification appearance unchanged.
    #![allow(deprecated)]

    use super::{dispatch_click, NotificationParams};
    use objc2::rc::Retained;
    use objc2::runtime::{AnyClass, ProtocolObject};
    use objc2::{define_class, msg_send, DefinedClass, MainThreadMarker, MainThreadOnly};
    use objc2_foundation::{
        NSObject, NSObjectProtocol, NSString, NSUserNotification, NSUserNotificationCenter,
        NSUserNotificationCenterDelegate,
    };
    use std::cell::OnceCell;
    use std::sync::atomic::{AtomicBool, Ordering};
    use tauri::AppHandle;

    static NATIVE_CLICK_READY: AtomicBool = AtomicBool::new(false);

    thread_local! {
        static DELEGATE: OnceCell<Retained<Delegate>> = const { OnceCell::new() };
    }

    struct DelegateIvars {
        app: AppHandle,
    }

    define_class!(
        // SAFETY:
        // - NSObject has no subclassing requirements.
        // - Delegate does not implement Drop.
        #[unsafe(super(NSObject))]
        #[thread_kind = MainThreadOnly]
        #[name = "PakeUserNotificationDelegate"]
        #[ivars = DelegateIvars]
        struct Delegate;

        unsafe impl NSObjectProtocol for Delegate {}

        unsafe impl NSUserNotificationCenterDelegate for Delegate {
            #[unsafe(method(userNotificationCenter:didActivateNotification:))]
            fn did_activate(
                &self,
                _center: &NSUserNotificationCenter,
                notification: &NSUserNotification,
            ) {
                let Some(identifier) = notification.identifier() else {
                    return;
                };
                // `rsplit_once` because a popup window label comes from the
                // page's `window.open` name and may itself contain '|', while
                // the id never can.
                let identifier = identifier.to_string();
                let Some((label, id)) = identifier.rsplit_once('|') else {
                    return;
                };
                dispatch_click(&self.ivars().app, label, id);
            }

            // Show the banner even when Pake is frontmost: the window that owns
            // the conversation may still be hidden or in the background, and the
            // click is what routes the page there.
            #[unsafe(method(userNotificationCenter:shouldPresentNotification:))]
            fn should_present(
                &self,
                _center: &NSUserNotificationCenter,
                _notification: &NSUserNotification,
            ) -> bool {
                true
            }
        }
    );

    impl Delegate {
        fn new(mtm: MainThreadMarker, app: AppHandle) -> Retained<Self> {
            let this = Self::alloc(mtm).set_ivars(DelegateIvars { app });
            unsafe { msg_send![super(this), init] }
        }
    }

    /// `defaultUserNotificationCenter` is nil for a process without a bundle
    /// identifier (`pnpm run dev` runs the bare binary), and the class itself
    /// disappears if a future macOS finally drops the deprecated API. Probe once
    /// here rather than risking a nil dereference on every notification.
    fn default_center(mtm: MainThreadMarker) -> Option<Retained<NSUserNotificationCenter>> {
        let _ = mtm;
        let class = AnyClass::get(c"NSUserNotificationCenter")?;
        unsafe { msg_send![class, defaultUserNotificationCenter] }
    }

    pub fn init(app: &AppHandle) {
        let Some(mtm) = MainThreadMarker::new() else {
            return;
        };
        let Some(center) = default_center(mtm) else {
            return;
        };

        DELEGATE.with(|cell| {
            let delegate = cell.get_or_init(|| Delegate::new(mtm, app.clone()));
            unsafe { center.setDelegate(Some(ProtocolObject::from_ref(&**delegate))) };
        });
        NATIVE_CLICK_READY.store(true, Ordering::SeqCst);
    }

    /// Returns whether the notification was handed to the native center. `false`
    /// means the caller should fall back to the plugin path.
    pub fn deliver(
        app: &AppHandle,
        window_label: &str,
        params: &NotificationParams,
    ) -> Result<bool, String> {
        if !NATIVE_CLICK_READY.load(Ordering::SeqCst) {
            return Ok(false);
        }

        let identifier = format!("{window_label}|{}", params.id);
        let title = params.title.clone();
        let body = params.body.clone();

        app.run_on_main_thread(move || {
            let Some(mtm) = MainThreadMarker::new() else {
                return;
            };
            let Some(center) = default_center(mtm) else {
                return;
            };

            let notification = NSUserNotification::new();
            notification.setTitle(Some(&NSString::from_str(&title)));
            notification.setInformativeText(Some(&NSString::from_str(&body)));
            notification.setIdentifier(Some(&NSString::from_str(&identifier)));
            center.deliverNotification(&notification);
        })
        .map_err(|e| format!("Failed to dispatch notification: {e}"))?;

        Ok(true)
    }
}

#[cfg(test)]
mod tests {
    use super::validate_id;

    #[test]
    fn accepts_generated_ids() {
        assert!(validate_id("pake-12-a1b2c3d4").is_ok());
        assert!(validate_id("A_b-9").is_ok());
    }

    #[test]
    fn rejects_ids_that_could_escape_an_eval_literal() {
        for id in ["", "a'b", "a\\b", "a|b", "a b", "a\nb", "a;b"] {
            assert!(validate_id(id).is_err(), "expected {id:?} to be rejected");
        }
        assert!(validate_id(&"a".repeat(65)).is_err());
    }
}
