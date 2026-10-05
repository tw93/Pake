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

use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::{AppHandle, WebviewWindow};

/// Ids are minted by the packaged (untrusted) page and echoed into a native
/// notification identifier and a webview `eval`, so keep them short and opaque.
const MAX_NOTIFICATION_ID_LEN: usize = 64;

/// How long the same message coming from a different window counts as a repeat.
/// Windows are driven by the same server event, so they fire near-simultaneously;
/// this only needs to absorb ordinary scheduling jitter, and staying tight keeps
/// a genuinely repeated message from being swallowed.
const DEDUPE_WINDOW: Duration = Duration::from_secs(1);
const MAX_DEDUPE_ENTRIES: usize = 64;

struct DedupeEntry {
    key: String,
    window_label: String,
    at: Instant,
}

/// Collapses the copies of one message that `--multi-window` produces.
///
/// Every Pake window runs its own instance of the site, so a single incoming
/// message raises one notification per window, all identical and all competing
/// for the same click. Only a *different* window repeating the same title+body
/// counts as a duplicate, so a site legitimately repeating a message within one
/// window still gets every notification.
#[derive(Default)]
struct Dedupe {
    entries: Vec<DedupeEntry>,
}

impl Dedupe {
    fn is_repeat(&mut self, window_label: &str, key: String, now: Instant) -> bool {
        self.entries
            .retain(|entry| now.duration_since(entry.at) < DEDUPE_WINDOW);

        if self
            .entries
            .iter()
            .any(|entry| entry.key == key && entry.window_label != window_label)
        {
            return true;
        }

        if self.entries.len() >= MAX_DEDUPE_ENTRIES {
            self.entries.remove(0);
        }
        self.entries.push(DedupeEntry {
            key,
            window_label: window_label.to_string(),
            at: now,
        });
        false
    }
}

static DEDUPE: Mutex<Dedupe> = Mutex::new(Dedupe {
    entries: Vec::new(),
});

/// Unit separator keeps a title ending in the body's prefix from colliding.
fn dedupe_key(title: &str, body: &str) -> String {
    format!("{title}\u{1f}{body}")
}

fn is_cross_window_repeat(window_label: &str, title: &str, body: &str) -> bool {
    let key = dedupe_key(title, body);
    // A poisoned lock only means some earlier caller panicked mid-update; the
    // worst case here is a stale entry, never a reason to drop a notification.
    let mut dedupe = DEDUPE.lock().unwrap_or_else(|e| e.into_inner());
    dedupe.is_repeat(window_label, key, Instant::now())
}

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
    /// True when another window already raised this exact message, so nothing
    /// was shown. The page must stop tracking the notification: no click can
    /// ever arrive for it, and it must not inflate the badge count either.
    suppressed: bool,
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

fn native_click_ready() -> bool {
    #[cfg(target_os = "macos")]
    return macos::native_click_ready();
    #[cfg(not(target_os = "macos"))]
    {
        false
    }
}

pub fn send(
    app: &AppHandle,
    window: &WebviewWindow,
    params: &NotificationParams,
) -> Result<NotificationOutcome, String> {
    validate_id(&params.id)?;

    // Only a native click reaches the exact window that raised the copy. The
    // focus fallback arms each window separately, so a copy suppressed there
    // would drop the click when the OS activates that window instead.
    if native_click_ready() && is_cross_window_repeat(window.label(), &params.title, &params.body) {
        return Ok(NotificationOutcome {
            native_click: false,
            suppressed: true,
        });
    }

    #[cfg(target_os = "macos")]
    if macos::deliver(app, window.label(), params)? {
        return Ok(NotificationOutcome {
            native_click: true,
            suppressed: false,
        });
    }

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
        suppressed: false,
    })
}

/// Withdraw only the calling webview's notification. Other platforms retain
/// their existing delivery path, which does not expose a withdrawal handle.
pub fn close(app: &AppHandle, window: &WebviewWindow, id: &str) -> Result<(), String> {
    validate_id(id)?;
    #[cfg(target_os = "macos")]
    return macos::withdraw(app, window.label(), id);
    #[cfg(not(target_os = "macos"))]
    {
        let _ = (app, window);
        Ok(())
    }
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

    use super::{dispatch_click, validate_id, NotificationParams};
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
                center: &NSUserNotificationCenter,
                notification: &NSUserNotification,
            ) {
                // Read the identifier before removing: keep the two steps
                // independent of any ordering assumption about the removal.
                let raw = notification.identifier().map(|s| s.to_string());

                // NSUserNotificationCenter keeps an activated notification in
                // Notification Center; without this it piles up after every click.
                center.removeDeliveredNotification(notification);

                let Some(identifier) = raw else {
                    return;
                };
                // `rsplit_once` because a popup window label comes from the
                // page's `window.open` name and may itself contain '|', while
                // the id never can.
                let Some((label, id)) = identifier.rsplit_once('|') else {
                    return;
                };
                if validate_id(id).is_err() {
                    return;
                }
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

    pub fn native_click_ready() -> bool {
        NATIVE_CLICK_READY.load(Ordering::SeqCst)
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

    pub fn withdraw(app: &AppHandle, window_label: &str, id: &str) -> Result<(), String> {
        let identifier = format!("{window_label}|{id}");
        app.run_on_main_thread(move || {
            let Some(mtm) = MainThreadMarker::new() else {
                return;
            };
            let Some(center) = default_center(mtm) else {
                return;
            };
            for notification in center.deliveredNotifications() {
                if notification
                    .identifier()
                    .is_some_and(|value| value.to_string() == identifier)
                {
                    center.removeDeliveredNotification(&notification);
                }
            }
        })
        .map_err(|e| format!("Failed to withdraw notification: {e}"))
    }
}

#[cfg(test)]
mod tests {
    use super::{dedupe_key, validate_id, Dedupe, DEDUPE_WINDOW};
    use std::time::{Duration, Instant};

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

    #[test]
    fn collapses_the_same_message_from_another_window() {
        let mut dedupe = Dedupe::default();
        let now = Instant::now();
        let key = || dedupe_key("Ann", "hi");

        assert!(!dedupe.is_repeat("pake", key(), now));
        assert!(dedupe.is_repeat("pake-1", key(), now));
        assert!(dedupe.is_repeat("pake-2", key(), now));
    }

    #[test]
    fn keeps_a_message_the_same_window_repeats() {
        let mut dedupe = Dedupe::default();
        let now = Instant::now();
        let key = || dedupe_key("Ann", "hi");

        assert!(!dedupe.is_repeat("pake", key(), now));
        assert!(!dedupe.is_repeat("pake", key(), now));
    }

    #[test]
    fn keeps_a_different_message_from_another_window() {
        let mut dedupe = Dedupe::default();
        let now = Instant::now();

        assert!(!dedupe.is_repeat("pake", dedupe_key("Ann", "hi"), now));
        assert!(!dedupe.is_repeat("pake-1", dedupe_key("Bo", "hi"), now));
        assert!(!dedupe.is_repeat("pake-1", dedupe_key("Ann", "bye"), now));
    }

    #[test]
    fn stops_collapsing_once_the_window_has_passed() {
        let mut dedupe = Dedupe::default();
        let now = Instant::now();
        let later = now + DEDUPE_WINDOW + Duration::from_millis(1);
        let key = || dedupe_key("Ann", "hi");

        assert!(!dedupe.is_repeat("pake", key(), now));
        assert!(!dedupe.is_repeat("pake-1", key(), later));
    }

    #[test]
    fn separates_title_and_body_so_they_cannot_run_together() {
        assert_ne!(dedupe_key("ab", "c"), dedupe_key("a", "bc"));
    }
}
