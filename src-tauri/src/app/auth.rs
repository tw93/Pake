// macOS HTTP Basic authentication response for `--basic-auth`.
//
// Why this exists
//   macOS WKWebView does not display the system authentication dialog when a
//   server returns HTTP 401. Instead, the webview renders its own
//   "Authentication required" error page and the user is stuck. WebView2 on
//   Windows and the Chromium-based engine on Linux both pop their own
//   dialogs, so this is a macOS-only problem.
//
// How this fixes it
//   wry's `WryNavigationDelegate` does not implement
//   `webView:didReceiveAuthenticationChallenge:completionHandler:`, so
//   WKWebView falls back to default handling and shows the error page. This
//   file installs a thin navigation-delegate proxy that responds to HTTP
//   Basic challenges with an `NSURLCredential` built from the credentials
//   the user passed on the CLI, and forwards every other selector to wry's
//   original delegate.
//
// Cold-start race (why the first request carries the header)
//   The very first load of the target URL must not depend on the
//   challenge path: the 401 response can land before our proxy is the
//   active navigation delegate (wry sets its own delegate during
//   `WKWebView` creation in `new_ns_view`, and the window event loop
//   races our `with_webview` callback), and wry's delegate does not
//   implement `webView:didReceiveAuthenticationChallenge:...`, so
//   WebKit falls back to default handling and shows the 401 body — the
//   "Authentication required" page. Refreshing works only because the
//   session credential gets persisted by then.
//
//   Fix: `install_basic_auth_and_navigate` sends the initial navigation
//   as an `NSMutableURLRequest` with `Authorization: Basic ...` already
//   in the headers, so the server answers 200 and never issues the
//   challenge. The delegate below is the fallback for everything after
//   that (Cmd+R reloads, subresource/API requests), plus a KVO guard
//   that re-asserts the proxy if any later code replaces the delegate.
//
// KVO rationale
//   wry installs its navigation delegate once at webview creation; it
//   does not normally replace it afterwards. The KVO observer on the
//   `navigationDelegate` property is a defensive guard: if anything
//   (a future wry/tauri change, or another Pake delegate like
//   `cert.rs`) overwrites the proxy, we re-assert ourselves so the
//   next challenge still lands on us.
//
// Challenge types we *do not* handle (NTLM, Digest, server-trust) fall
// through to default handling. Forwarding to inner would require owning
// a `'static` block2 closure (E0521) and is unsafe against wry's
// delegate that does not implement the selector. The primary use case
// is `--basic-auth` alone, where there is no `cert.rs` delegate to
// compete with; combining `--basic-auth` with
// `--ignore-certificate-errors` does not chain perfectly.
//
// CLI plumbing
//   `--basic-auth user:pass` -> `tauriConf.pake.basic_auth = "user:pass"`
//   -> `PakeConfig::basic_auth` (read in `window.rs`) -> this file.
use objc2::rc::{Retained, Weak};
use objc2::runtime::{AnyObject, Bool, NSObject, NSObjectProtocol, Sel};
use objc2::{class, define_class, msg_send, DefinedClass, MainThreadMarker, MainThreadOnly};
use objc2_foundation::NSString;
use std::ffi::c_void;

// NSURLSessionAuthChallengeDisposition values.
const USE_CREDENTIAL: isize = 0;
const PERFORM_DEFAULT_HANDLING: isize = 1;

// NSURLCredentialPersistence values.
const NSURLCREDENTIAL_PERSISTENCE_FOR_SESSION: usize = 1;

// NSKeyValueObservingOptions bitmask. We only need the new value.
const NS_KEY_VALUE_OBSERVING_OPTION_NEW: usize = 1;

// NSString encoding for `dataUsingEncoding:` (NSUTF8StringEncoding).
const NS_UTF8_STRING_ENCODING: usize = 4;

pub struct PakeBasicAuthDelegateIvars {
    // Whatever navigation delegate was installed before us (wry's own
    // delegate at webview creation; see the cold-start-race comment above).
    inner: Weak<AnyObject>,
    // Weak reference to the WKWebView we are observing. Needed so
    // `dealloc` can unregister the KVO observer and prevent a use-after-
    // free when the webview is torn down.
    webview: Weak<AnyObject>,
    user: String,
    pass: String,
}

static BASIC_AUTH_ASSOCIATION_KEY: u8 = 0;

define_class!(
    #[unsafe(super(NSObject))]
    #[name = "PakeBasicAuthDelegate"]
    #[thread_kind = MainThreadOnly]
    #[ivars = PakeBasicAuthDelegateIvars]
    struct PakeBasicAuthDelegate;

    unsafe impl NSObjectProtocol for PakeBasicAuthDelegate {}

    impl PakeBasicAuthDelegate {
        #[unsafe(method(webView:didReceiveAuthenticationChallenge:completionHandler:))]
        fn did_receive_challenge(
            &self,
            _webview: &AnyObject,
            challenge: &AnyObject,
            handler: &block2::Block<dyn Fn(isize, *mut AnyObject)>,
        ) {
            unsafe {
                // Ask the protection space whether this is an HTTP Basic
                // challenge. `NSURLAuthenticationMethodHTTPBasic` is the
                // string sentinel; NTLM and Digest have their own sentinels
                // and require multi-round-trip handling we do not implement
                // here, so those (and the malformed-challenge fallthroughs
                // below) get default handling.
                let space: *mut AnyObject = msg_send![challenge, protectionSpace];
                if space.is_null() {
                    handler.call((PERFORM_DEFAULT_HANDLING, core::ptr::null_mut()));
                    return;
                }
                let method: *mut NSString = msg_send![space, authenticationMethod];
                if method.is_null() {
                    handler.call((PERFORM_DEFAULT_HANDLING, core::ptr::null_mut()));
                    return;
                }
                let is_basic = {
                    let m: &NSString = &*method;
                    m.to_string() == "NSURLAuthenticationMethodHTTPBasic"
                };
                if !is_basic {
                    eprintln!("[Pake] Ignoring non-Basic auth challenge (default handling).");
                    handler.call((PERFORM_DEFAULT_HANDLING, core::ptr::null_mut()));
                    return;
                }

                eprintln!("[Pake] Responding to HTTP Basic auth challenge with stored credentials.");

                let user_ns = NSString::from_str(&self.ivars().user);
                let pass_ns = NSString::from_str(&self.ivars().pass);
                let credential: *mut AnyObject = msg_send![
                    class!(NSURLCredential),
                    credentialWithUser: &*user_ns,
                    password: &*pass_ns,
                    persistence: NSURLCREDENTIAL_PERSISTENCE_FOR_SESSION
                ];
                if credential.is_null() {
                    handler.call((PERFORM_DEFAULT_HANDLING, core::ptr::null_mut()));
                    return;
                }
                handler.call((USE_CREDENTIAL, credential));
            }
        }

        // WKWebView probes respondsToSelector: before calling optional
        // delegate methods, so report our own methods plus everything
        // the inner delegate implements. Without this, WKWebView would
        // skip calling methods that the inner delegate relies on.
        #[unsafe(method(respondsToSelector:))]
        fn responds_to_selector(&self, selector: Sel) -> Bool {
            let responds: Bool = unsafe { msg_send![super(self), respondsToSelector: selector] };
            if responds.as_bool() {
                return Bool::YES;
            }
            self.ivars()
                .inner
                .load()
                .map(|inner| unsafe { msg_send![&*inner, respondsToSelector: selector] })
                .unwrap_or(Bool::NO)
        }

        // Fast-forward any selector we do not implement to the inner
        // delegate. Combined with respondsToSelector: above, this lets
        // navigation policy, downloads, and page-load callbacks reach
        // the real delegate untouched.
        #[unsafe(method(forwardingTargetForSelector:))]
        fn forwarding_target(&self, _selector: Sel) -> *mut AnyObject {
            self.ivars()
                .inner
                .load()
                .map(|inner| Retained::as_ptr(&inner) as *mut AnyObject)
                .unwrap_or(core::ptr::null_mut())
        }

        // KVO callback. The only key path we observe is "navigationDelegate";
        // everything else falls through to the superclass default, which
        // raises an NSInternalInconsistencyException (the standard KVO
        // contract). If anything replaces our proxy on the webview, this
        // callback fires; we re-assert ourselves so the next challenge
        // lands on us (see the cold-start-race comment at the top of this
        // file for why this is a defensive guard).
        #[unsafe(method(observeValueForKeyPath:ofObject:change:context:))]
        fn observe_value(
            &self,
            key_path: &NSString,
            object: &AnyObject,
            change: *mut AnyObject,
            context: *mut std::ffi::c_void,
        ) {
            unsafe {
                if key_path.to_string() != "navigationDelegate" {
                    let _: () = msg_send![
                        super(self),
                        observeValueForKeyPath: key_path,
                        ofObject: object,
                        change: change,
                        context: context
                    ];
                    return;
                }
                let current: *mut AnyObject = msg_send![object, navigationDelegate];
                let self_ptr = self as *const Self as *mut AnyObject;
                if current == self_ptr {
                    return;
                }
                // Someone (wry) overwrote us. Re-assert; the call goes
                // through KVO again, but the next callback sees us
                // already in place and returns immediately.
                eprintln!("[Pake] navigationDelegate replaced; re-asserting Basic auth proxy.");
                let _: () = msg_send![object, setNavigationDelegate: self];
            }
        }
    }
);

// Cleanup runs when the last `Retained<PakeBasicAuthDelegate>` is dropped,
// which is the right moment to unregister the KVO observer. objc2 does
// not allow overriding Objective-C's `-dealloc` via `define_class!`; the
// idiomatic equivalent is a Rust `Drop` impl, which objc2 invokes from
// its own dealloc chain (the actual `-dealloc` call to `super` happens
// after this returns, so we must not call it ourselves).
impl Drop for PakeBasicAuthDelegate {
    fn drop(&mut self) {
        // Pull the weak webview ref out first so the &self borrow ends
        // before we need to cast `self` to a raw pointer for msg_send.
        let webview_opt = self.ivars().webview.load();
        if let Some(webview) = webview_opt {
            unsafe {
                let key_path = NSString::from_str("navigationDelegate");
                // `self` is `&mut Self`; msg_send wants an Objective-C
                // object pointer. Cast through `*const Self` (an
                // objc2-supported re-interpretation that requires
                // `Self: Thin`, which `define_class!` auto-implements for
                // every class type) and then to `*mut AnyObject` (lossy
                // cast on raw pointers, no-op for class types).
                let self_ptr: *mut AnyObject = self as *const Self as *mut AnyObject;
                let _: () = msg_send![
                    &*webview,
                    removeObserver: self_ptr,
                    forKeyPath: &*key_path
                ];
            }
        }
    }
}

impl PakeBasicAuthDelegate {
    fn new(
        webview: &Retained<AnyObject>,
        inner: Weak<AnyObject>,
        user: String,
        pass: String,
        mtm: MainThreadMarker,
    ) -> Retained<Self> {
        let this = mtm
            .alloc::<PakeBasicAuthDelegate>()
            .set_ivars(PakeBasicAuthDelegateIvars {
                inner,
                webview: Weak::from_retained(webview),
                user,
                pass,
            });
        unsafe { msg_send![super(this), init] }
    }
}

/// Split `"user:pass"` into the credential pair. Returns `None` when the
/// string is empty, missing the separator, or has an empty user portion.
/// Password may be empty (some Basic setups allow that) and UTF-8 chars
/// in either field are fine — the runtime `NSURLCredential` API handles
/// them transparently.
pub fn parse_basic_auth(raw: &str) -> Option<(String, String)> {
    if raw.is_empty() {
        return None;
    }
    let colon = raw.find(':')?;
    let user = raw[..colon].to_string();
    if user.is_empty() {
        return None;
    }
    let pass = raw[colon + 1..].to_string();
    Some((user, pass))
}

/// Install the HTTP Basic auth navigation-delegate proxy on the given
/// `WKWebView`, then navigate to `target_url`. `webview_ptr` is the raw
/// pointer returned by `PlatformWebview::inner()`. Returns false only
/// when setup cannot start at all (e.g. nil webview, empty inputs, or
/// no main thread). A nil pre-existing navigation delegate is **not** a
/// failure: wry sets its delegate at webview creation, and the KVO
/// observer registered here re-asserts the proxy if anything later
/// overwrites it.
pub fn install_basic_auth_and_navigate(
    webview_ptr: *mut c_void,
    user: String,
    pass: String,
    target_url: String,
) -> bool {
    if webview_ptr.is_null() || user.is_empty() || target_url.is_empty() {
        return false;
    }
    let Some(mtm) = MainThreadMarker::new() else {
        return false;
    };
    unsafe {
        // Retain the webview so the Weak reference held by the proxy's
        // ivars stays valid for the proxy's lifetime.
        let Some(webview) = Retained::retain(webview_ptr as *mut AnyObject) else {
            return false;
        };

        // Capture the current navigation delegate, if any. wry sets its
        // own delegate during WKWebView creation, so this is normally
        // non-nil; a nil value (unusual) is handled gracefully.
        let existing: *mut AnyObject = msg_send![&*webview, navigationDelegate];
        let inner_weak: Weak<AnyObject> = if existing.is_null() {
            Weak::default()
        } else {
            match Retained::retain(existing) {
                Some(r) => Weak::from_retained(&r),
                None => Weak::default(),
            }
        };

        // Build the `Authorization: Basic <base64(user:pass)>` header up
        // front (borrows user/pass) so the first navigation can carry it.
        // Base64 goes through NSData so UTF-8 credentials survive; avoids
        // adding a Rust base64 dependency. user/pass are moved into the
        // delegate below, so this must run first. Header failure is not
        // fatal: we fall back to a bare navigation and let the delegate
        // answer the 401 challenge instead.
        let credentials = NSString::from_str(&format!("{user}:{pass}"));
        let cred_data: *mut AnyObject =
            msg_send![&*credentials, dataUsingEncoding: NS_UTF8_STRING_ENCODING];
        let auth_header = if cred_data.is_null() {
            None
        } else {
            let encoded: *mut NSString =
                msg_send![cred_data, base64EncodedStringWithOptions: 0];
            if encoded.is_null() {
                None
            } else {
                Some(NSString::from_str(&format!("Basic {}", &*encoded)))
            }
        };

        let proxy = PakeBasicAuthDelegate::new(&webview, inner_weak, user, pass, mtm);

        // Set our proxy as the webview's navigation delegate. The
        // assignment triggers KVO, which calls our observe_value; the
        // callback sees the new value is already us and returns.
        let _: () = msg_send![&*webview, setNavigationDelegate: &*proxy];

        // Register KVO on the navigationDelegate property so the
        // observe_value callback fires if anything later overwrites us.
        // Defensive guard: the initial navigation already carries the
        // Authorization header (see the cold-start-race comment), so the
        // delegate is only the fallback for subsequent challenges; KVO
        // keeps that fallback in place.
        //
        // Pre-cast the observer to `*mut AnyObject` so the generic
        // parameter of `addObserver:forKeyPath:options:context:` is
        // inferred as the concrete `AnyObject` (which is known to
        // implement `Thin` internally) instead of our class type. The
        // raw-pointer-to-raw-pointer cast is unconditional in Rust and
        // does not require the source type to implement `Thin`.
        let key_path = NSString::from_str("navigationDelegate");
        let observer_ptr: *mut AnyObject =
            (&*proxy) as *const PakeBasicAuthDelegate as *mut AnyObject;
        let _: () = msg_send![
            &*webview,
            addObserver: observer_ptr,
            forKeyPath: &*key_path,
            options: NS_KEY_VALUE_OBSERVING_OPTION_NEW,
            // Rust 1.97 added `T: PointeeSized + Thin` to `null_mut`,
            // so the pointee must be spelled out here: the `context:`
            // parameter of `addObserver:...:context:` is `*mut c_void`
            // and `c_void` is known to implement `Thin`.
            context: core::ptr::null_mut::<c_void>()
        ];

        // Keep the proxy alive for as long as the webview does. The
        // associated object holds a strong reference; the KVO observer
        // registration holds a separate strong reference too, so we are
        // safe even if the webview's own delegate slot is later reset.
        objc2::ffi::objc_setAssociatedObject(
            &*webview as *const AnyObject as *mut AnyObject,
            std::ptr::addr_of!(BASIC_AUTH_ASSOCIATION_KEY).cast(),
            Retained::as_ptr(&proxy) as *mut AnyObject,
            objc2::ffi::OBJC_ASSOCIATION_RETAIN_NONATOMIC,
        );

        // Navigate to the real URL with the credentials embedded in the
        // very first request. The challenge path can race the delegate
        // install on cold start, so send `Authorization: Basic ...` up
        // front: the server answers 200 and never issues the challenge.
        // Later requests (Cmd+R reloads, subresource/API calls) fall back
        // to the delegate above plus session credential persistence.
        let target_ns = NSString::from_str(&target_url);
        let ns_url: *mut AnyObject = msg_send![class!(NSURL), URLWithString: &*target_ns];
        if ns_url.is_null() {
            return false;
        }
        let request: *mut AnyObject =
            msg_send![class!(NSMutableURLRequest), requestWithURL: ns_url];
        if request.is_null() {
            return false;
        }
        let header_field = NSString::from_str("Authorization");
        if let Some(auth_header) = &auth_header {
            let _: () = msg_send![
                request,
                setValue: &**auth_header,
                forHTTPHeaderField: &*header_field
            ];
            eprintln!(
                "[Pake] Sending initial navigation with Authorization header to {target_url}"
            );
        } else {
            eprintln!("[Pake] Authorization header build failed; relying on challenge delegate for {target_url}");
        }
        let _: () = msg_send![&*webview, loadRequest: request];
    }
    true
}

#[cfg(test)]
mod tests {
    use super::parse_basic_auth;

    #[test]
    fn parses_simple_user_pass() {
        assert_eq!(
            parse_basic_auth("alice:secret"),
            Some(("alice".to_string(), "secret".to_string()))
        );
    }

    #[test]
    fn allows_empty_password() {
        assert_eq!(
            parse_basic_auth("alice:"),
            Some(("alice".to_string(), "".to_string()))
        );
    }

    #[test]
    fn allows_colons_in_password() {
        assert_eq!(
            parse_basic_auth("alice:se:cret:with:colons"),
            Some(("alice".to_string(), "se:cret:with:colons".to_string()))
        );
    }

    #[test]
    fn rejects_empty_input() {
        assert_eq!(parse_basic_auth(""), None);
    }

    #[test]
    fn rejects_missing_separator() {
        assert_eq!(parse_basic_auth("alice"), None);
    }

    #[test]
    fn rejects_empty_user() {
        assert_eq!(parse_basic_auth(":secret"), None);
    }
}
