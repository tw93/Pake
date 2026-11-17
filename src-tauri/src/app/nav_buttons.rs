//! Back and Forward buttons in the macOS title bar, beside the traffic lights.
//!
//! A page reached by a click has no way back with a plain mouse: the swipe needs
//! a trackpad and Cmd-[ needs the keyboard. With `navigation_buttons` on, each
//! window gets two chevrons in a leading title bar accessory, greyed when the
//! webview has nowhere to go in that direction.
//!
//! The buttons call the same native history step as the Navigation menu, so they
//! work on a blank error page too. Their action is installed on the window's own
//! class, as `tab_bar.rs` does for the + button, and finds the Tauri window from
//! the NSWindow that received it. An observer on the webview's `canGoBack` and
//! `canGoForward`, which WebKit documents as key-value observable, enables and
//! greys them. The webview owns it through an associated object, as `auth.rs`
//! does for its navigation delegate, and it stops observing when the window
//! closes, while the webview is still alive to be asked.

use block2::RcBlock;
use dispatch::Queue;
use objc2::ffi::class_addMethod;
use objc2::rc::{Retained, Weak};
use objc2::runtime::{AnyClass, AnyObject, Bool, Imp, NSObject, NSObjectProtocol, Sel};
use objc2::{class, define_class, msg_send, sel, DefinedClass, MainThreadMarker, MainThreadOnly};
use objc2_foundation::{NSPoint, NSRect, NSSize, NSString};
use std::cell::Cell;
use std::ffi::{c_char, c_void};
use std::sync::OnceLock;
use tauri::{AppHandle, Manager, WebviewWindow};

use crate::app::navigation::history_step;
use crate::util::UiLanguage;

static APP_HANDLE: OnceLock<AppHandle> = OnceLock::new();

/// `void action:(id)sender`: return, self, `_cmd`, sender.
const ACTION_TYPES: &[u8] = b"v@:@\0";

/// The accessory spans the title bar's height; these place two 26 by 22 point
/// buttons 8 points after the traffic lights and 2 points apart.
const BUTTON_WIDTH: f64 = 26.0;
const BUTTON_HEIGHT: f64 = 22.0;
const LEADING: f64 = 8.0;
const GAP: f64 = 2.0;
const BAR_HEIGHT: f64 = 28.0;

/// NSKeyValueObservingOptionNew | NSKeyValueObservingOptionInitial: report the
/// state once on registration, then on every change.
const KVO_OPTIONS: usize = 1 | 4;
const HISTORY_KEYS: [&str; 2] = ["canGoBack", "canGoForward"];
static OBSERVER_ASSOCIATION_KEY: u8 = 0;

/// A pointer only ever touched on the main thread, carried through closures
/// that Tauri and Dispatch require to be `Send`.
#[derive(Clone, Copy)]
struct MainThreadPtr(*mut AnyObject);
unsafe impl Send for MainThreadPtr {}

fn step_from_window(this: &AnyObject, back: bool) {
    let Some(app) = APP_HANDLE.get() else {
        return;
    };
    let target = this as *const AnyObject as *mut c_void;
    for window in app.webview_windows().values() {
        if window.ns_window().ok() == Some(target) {
            history_step(window, back);
            return;
        }
    }
}

extern "C" fn go_back(this: &AnyObject, _cmd: Sel, _sender: *mut AnyObject) {
    step_from_window(this, true);
}

extern "C" fn go_forward(this: &AnyObject, _cmd: Sel, _sender: *mut AnyObject) {
    step_from_window(this, false);
}

/// Back and Forward as the system's own web views name them: 返回 and 前进
/// in Simplified Chinese, 上一頁 and 下一頁 in Traditional (WebCore's strings).
fn labels() -> (&'static str, &'static str) {
    match UiLanguage::system() {
        UiLanguage::English => ("Back", "Forward"),
        UiLanguage::SimplifiedChinese => ("返回", "前进"),
        UiLanguage::TraditionalChinese => ("上一頁", "下一頁"),
    }
}

/// Side of the square the chevron is drawn in, and the stroke that draws it.
const GLYPH_SIZE: f64 = 16.0;
const GLYPH_STROKE: f64 = 1.6;

/// A chevron drawn in the exact middle of its square, so the image's middle is
/// the ink's middle. The system's `chevron.left` symbol is set on a text
/// baseline, and its ink sat 1.5 points above the image's middle.
unsafe fn chevron_image(back: bool) -> *mut AnyObject {
    let draw = RcBlock::new(move |_rect: NSRect| -> Bool {
        let (near, far) = if back { (10.5, 5.0) } else { (5.5, 11.0) };
        let path: *mut AnyObject = msg_send![class!(NSBezierPath), bezierPath];
        let middle = GLYPH_SIZE / 2.0;
        let _: () = msg_send![path, moveToPoint: NSPoint::new(near, middle - 5.5)];
        let _: () = msg_send![path, lineToPoint: NSPoint::new(far, middle)];
        let _: () = msg_send![path, lineToPoint: NSPoint::new(near, middle + 5.5)];
        let _: () = msg_send![path, setLineWidth: GLYPH_STROKE];
        // NSLineCapStyleRound and NSLineJoinStyleRound.
        let _: () = msg_send![path, setLineCapStyle: 1usize];
        let _: () = msg_send![path, setLineJoinStyle: 1usize];
        let color: *mut AnyObject = msg_send![class!(NSColor), blackColor];
        let _: () = msg_send![color, setStroke];
        let _: () = msg_send![path, stroke];
        Bool::YES
    });
    let image: *mut AnyObject = msg_send![
        class!(NSImage),
        imageWithSize: NSSize::new(GLYPH_SIZE, GLYPH_SIZE),
        flipped: Bool::NO,
        drawingHandler: &*draw
    ];
    // A template takes the button's own tint, and its dimmed tint when disabled.
    let _: () = msg_send![image, setTemplate: Bool::YES];
    image
}

/// One borderless chevron that shows the toolbar's rounded highlight on hover.
unsafe fn make_button(
    window: &AnyObject,
    back: bool,
    tip: &str,
    action: Sel,
    x: f64,
) -> *mut AnyObject {
    let label = NSString::from_str(tip);
    let image = chevron_image(back);
    let _: () = msg_send![image, setAccessibilityDescription: &*label];
    let button: *mut AnyObject = msg_send![
        class!(NSButton),
        buttonWithImage: image,
        target: window,
        action: action
    ];
    // NSBezelStyleToolbar, drawn only under the pointer.
    let _: () = msg_send![button, setBezelStyle: 11usize];
    let _: () = msg_send![button, setShowsBorderOnlyWhileMouseInside: Bool::YES];
    let _: () = msg_send![button, setToolTip: &*label];
    let _: () = msg_send![button, setEnabled: Bool::NO];
    let frame = NSRect::new(
        NSPoint::new(x, (BAR_HEIGHT - BUTTON_HEIGHT) / 2.0),
        NSSize::new(BUTTON_WIDTH, BUTTON_HEIGHT),
    );
    let _: () = msg_send![button, setFrame: frame];
    // NSViewMinYMargin | NSViewMaxYMargin: keep the place if the bar's height changes.
    let _: () = msg_send![button, setAutoresizingMask: 8usize | 32usize];
    button
}

/// Put each chevron's middle on the close button's centre line. The traffic
/// lights do not sit on the title bar's own middle, and NSButton does not set
/// its image on the button's: on macOS 26 a 16 point image sits half a point
/// above the middle of a 22 point toolbar-style button. Both are read from
/// AppKit here, not assumed.
unsafe fn align_with_traffic_lights(window: *mut AnyObject, buttons: [*mut AnyObject; 2]) {
    // NSWindowCloseButton.
    let close: *mut AnyObject = msg_send![window, standardWindowButton: 0usize];
    if close.is_null() {
        return;
    }
    let no_view: *mut AnyObject = std::ptr::null_mut();
    let bounds: NSRect = msg_send![close, bounds];
    let in_window: NSRect = msg_send![close, convertRect: bounds, toView: no_view];
    let middle = in_window.origin.y + in_window.size.height / 2.0;
    for button in buttons {
        let parent: *mut AnyObject = msg_send![button, superview];
        if parent.is_null() {
            continue;
        }
        let parent_bounds: NSRect = msg_send![parent, bounds];
        let parent_in_window: NSRect =
            msg_send![parent, convertRect: parent_bounds, toView: no_view];
        let mut frame: NSRect = msg_send![button, frame];
        let cell: *mut AnyObject = msg_send![button, cell];
        let bounds: NSRect = msg_send![button, bounds];
        let image: NSRect = msg_send![cell, imageRectForBounds: bounds];
        let flipped: Bool = msg_send![button, isFlipped];
        let image_above_middle =
            bounds.size.height / 2.0 - (image.origin.y + image.size.height / 2.0);
        let lift = if flipped.as_bool() {
            image_above_middle
        } else {
            -image_above_middle
        };
        let y = middle - parent_in_window.origin.y - frame.size.height / 2.0 - lift;
        if (frame.origin.y - y).abs() > 0.01 {
            frame.origin.y = y;
            let _: () = msg_send![button, setFrame: frame];
        }
    }
}

struct HistoryObserverIvars {
    webview: Weak<AnyObject>,
    window: Weak<AnyObject>,
    back: Retained<AnyObject>,
    forward: Retained<AnyObject>,
    /// Whether the two key paths are still registered on the webview.
    observing: Cell<bool>,
}

/// The title bar is laid out again on each of these, so the buttons are put
/// back on the traffic lights' centre line.
const RELAYOUT_NOTIFICATIONS: [&str; 3] = [
    "NSWindowDidResizeNotification",
    "NSWindowDidEnterFullScreenNotification",
    "NSWindowDidExitFullScreenNotification",
];

define_class!(
    #[unsafe(super(NSObject))]
    #[name = "PakeHistoryObserver"]
    #[thread_kind = MainThreadOnly]
    #[ivars = HistoryObserverIvars]
    struct HistoryObserver;

    unsafe impl NSObjectProtocol for HistoryObserver {}

    impl HistoryObserver {
        #[unsafe(method(observeValueForKeyPath:ofObject:change:context:))]
        fn observe_value(
            &self,
            key_path: &NSString,
            object: &AnyObject,
            change: *mut AnyObject,
            context: *mut c_void,
        ) {
            unsafe {
                if !HISTORY_KEYS.contains(&key_path.to_string().as_str()) {
                    let _: () = msg_send![
                        super(self),
                        observeValueForKeyPath: key_path,
                        ofObject: object,
                        change: change,
                        context: context
                    ];
                    return;
                }
                let ivars = self.ivars();
                let can_back: Bool = msg_send![object, canGoBack];
                let can_forward: Bool = msg_send![object, canGoForward];
                let _: () = msg_send![&*ivars.back, setEnabled: can_back];
                let _: () = msg_send![&*ivars.forward, setEnabled: can_forward];
            }
            self.realign();
        }

        #[unsafe(method(pakeWindowDidRelayout:))]
        fn window_did_relayout(&self, _notification: *mut AnyObject) {
            self.realign();
        }

        /// The last moment the webview is sure to be alive: once the window is
        /// gone the webview is torn down, and a weak reference to an object
        /// that is deallocating already reads as nil.
        #[unsafe(method(pakeWindowWillClose:))]
        fn window_will_close(&self, _notification: *mut AnyObject) {
            self.stop_observing();
        }
    }
);

impl HistoryObserver {
    fn realign(&self) {
        let ivars = self.ivars();
        if let Some(window) = ivars.window.load() {
            unsafe {
                align_with_traffic_lights(
                    Retained::as_ptr(&window) as *mut AnyObject,
                    [
                        Retained::as_ptr(&ivars.back) as *mut AnyObject,
                        Retained::as_ptr(&ivars.forward) as *mut AnyObject,
                    ],
                );
            }
        }
    }

    /// Take both key paths off the webview, once. Removing an observer that is
    /// not registered raises, so the flag decides, not the caller.
    fn stop_observing(&self) {
        let ivars = self.ivars();
        if !ivars.observing.replace(false) {
            return;
        }
        if let Some(webview) = ivars.webview.load() {
            let self_ptr = self as *const Self as *mut AnyObject;
            for key in HISTORY_KEYS {
                let key_path = NSString::from_str(key);
                unsafe {
                    let _: () =
                        msg_send![&*webview, removeObserver: self_ptr, forKeyPath: &*key_path];
                }
            }
        }
    }
}

impl Drop for HistoryObserver {
    fn drop(&mut self) {
        // Normally a no-op: the window's close already stopped it. The
        // notification centre drops a deallocated observer by itself.
        self.stop_observing();
    }
}

/// Watch this webview's history for the two buttons. The webview owns the
/// observer through an associated object, and the observer stops when the
/// window closes.
unsafe fn observe_history(
    webview_ptr: *mut AnyObject,
    window_ptr: *mut AnyObject,
    back: *mut AnyObject,
    forward: *mut AnyObject,
) {
    let Some(mtm) = MainThreadMarker::new() else {
        return;
    };
    let (Some(webview), Some(window), Some(back), Some(forward)) = (
        Retained::retain(webview_ptr),
        Retained::retain(window_ptr),
        Retained::retain(back),
        Retained::retain(forward),
    ) else {
        return;
    };
    let this = mtm
        .alloc::<HistoryObserver>()
        .set_ivars(HistoryObserverIvars {
            webview: Weak::from_retained(&webview),
            window: Weak::from_retained(&window),
            back,
            forward,
            observing: Cell::new(true),
        });
    let observer: Retained<HistoryObserver> = msg_send![super(this), init];
    objc2::ffi::objc_setAssociatedObject(
        Retained::as_ptr(&webview) as *mut AnyObject,
        std::ptr::addr_of!(OBSERVER_ASSOCIATION_KEY).cast(),
        Retained::as_ptr(&observer) as *mut AnyObject,
        objc2::ffi::OBJC_ASSOCIATION_RETAIN_NONATOMIC,
    );
    let observer_ptr = Retained::as_ptr(&observer) as *mut AnyObject;
    for key in HISTORY_KEYS {
        let key_path = NSString::from_str(key);
        let _: () = msg_send![
            &*webview,
            addObserver: observer_ptr,
            forKeyPath: &*key_path,
            options: KVO_OPTIONS,
            context: core::ptr::null_mut::<c_void>()
        ];
    }
    let center: *mut AnyObject = msg_send![class!(NSNotificationCenter), defaultCenter];
    let window_ptr = Retained::as_ptr(&window) as *mut AnyObject;
    for (name, selector) in RELAYOUT_NOTIFICATIONS
        .iter()
        .map(|name| (*name, sel!(pakeWindowDidRelayout:)))
        .chain([("NSWindowWillCloseNotification", sel!(pakeWindowWillClose:))])
    {
        let name = NSString::from_str(name);
        let _: () = msg_send![
            center,
            addObserver: observer_ptr,
            selector: selector,
            name: &*name,
            object: window_ptr
        ];
    }
}

/// Add the two buttons to this window's title bar and keep them in step with
/// the webview's history.
pub fn install(app: &AppHandle, window: &WebviewWindow) {
    let _ = APP_HANDLE.set(app.clone());
    let window = window.clone();
    Queue::main().exec_async(move || {
        let ns_window = match window.ns_window() {
            Ok(ns_window) => ns_window,
            Err(error) => {
                eprintln!(
                    "[Pake] Failed to access the macOS window for its navigation buttons: {error}"
                );
                return;
            }
        };
        // SAFETY: Tauri hands back the window's live NSWindow, and this runs on
        // the main thread where AppKit owns it.
        let object = unsafe { &*(ns_window as *const AnyObject) };
        let class: &AnyClass = unsafe {
            let reported: *const AnyClass = msg_send![object, class];
            &*reported
        };
        for (selector, handler) in [
            (
                sel!(pakeGoBack:),
                go_back as extern "C" fn(&AnyObject, Sel, *mut AnyObject),
            ),
            (
                sel!(pakeGoForward:),
                go_forward as extern "C" fn(&AnyObject, Sel, *mut AnyObject),
            ),
        ] {
            if class.instance_method(selector).is_some() {
                continue;
            }
            // SAFETY: the implementation matches the declared encoding and the
            // selector is absent from the class, so nothing is overridden.
            unsafe {
                let imp: Imp = std::mem::transmute::<
                    extern "C" fn(&AnyObject, Sel, *mut AnyObject),
                    Imp,
                >(handler);
                class_addMethod(
                    class as *const AnyClass as *mut AnyClass,
                    selector,
                    imp,
                    ACTION_TYPES.as_ptr() as *const c_char,
                );
            }
        }

        let (back_label, forward_label) = labels();
        let (back, forward) = unsafe {
            let back = make_button(object, true, back_label, sel!(pakeGoBack:), LEADING);
            let forward = make_button(
                object,
                false,
                forward_label,
                sel!(pakeGoForward:),
                LEADING + BUTTON_WIDTH + GAP,
            );
            let width = LEADING + BUTTON_WIDTH * 2.0 + GAP;
            let container: *mut AnyObject = msg_send![class!(NSView), alloc];
            let container: *mut AnyObject = msg_send![
                container,
                initWithFrame: NSRect::new(NSPoint::new(0.0, 0.0), NSSize::new(width, BAR_HEIGHT))
            ];
            let _: () = msg_send![container, addSubview: back];
            let _: () = msg_send![container, addSubview: forward];
            let accessory: *mut AnyObject =
                msg_send![class!(NSTitlebarAccessoryViewController), alloc];
            let accessory: *mut AnyObject = msg_send![accessory, init];
            let _: () = msg_send![accessory, setView: container];
            // NSLayoutAttributeLeading: right after the traffic lights.
            let _: () = msg_send![accessory, setLayoutAttribute: 5isize];
            let _: () = msg_send![object, addTitlebarAccessoryViewController: accessory];
            // The window now owns the accessory and its views.
            let _: () = msg_send![container, release];
            let _: () = msg_send![accessory, release];
            // Lay the bar out now, so the first alignment reads real frames.
            let _: () = msg_send![object, layoutIfNeeded];
            align_with_traffic_lights(ns_window as *mut AnyObject, [back, forward]);
            (MainThreadPtr(back), MainThreadPtr(forward))
        };

        let ns_window = MainThreadPtr(ns_window as *mut AnyObject);
        let observed = window.with_webview(move |webview| {
            let (back, forward, ns_window) = (back, forward, ns_window);
            let view = webview.inner() as *mut AnyObject;
            if view.is_null() {
                return;
            }
            // SAFETY: Tauri runs this on the main thread with the live WKWebView.
            unsafe { observe_history(view, ns_window.0, back.0, forward.0) };
        });
        if let Err(error) = observed {
            eprintln!("[Pake] Failed to access WKWebView for its navigation buttons: {error}");
        }
    });
}
