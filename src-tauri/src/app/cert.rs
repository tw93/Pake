// macOS TLS certificate bypass for `--ignore-certificate-errors`.
//
// On macOS the webview is a WKWebView, which ignores the Chromium
// `--ignore-certificate-errors` flag entirely, so Pake's flag was a no-op here
// (see the Windows/Linux vs macOS split in window.rs). wry's own
// `WryNavigationDelegate` does not implement
// `webView:didReceiveAuthenticationChallenge:completionHandler:`, so WKWebView
// falls back to default validation and rejects self-signed certs.
//
// This installs a thin navigation-delegate proxy that implements ONLY the
// authentication-challenge method (accepting the server trust) and forwards
// every other selector to wry's original delegate, so navigation policy,
// downloads, and page-load callbacks keep working untouched. It is installed
// only when the user opts in via `--ignore-certificate-errors`.

use objc2::rc::Retained;
use objc2::runtime::{AnyObject, Bool, NSObject, NSObjectProtocol, Sel};
use objc2::{class, define_class, msg_send, DefinedClass, MainThreadMarker, MainThreadOnly};
use std::ffi::c_void;

// NSURLSessionAuthChallengeDisposition values.
const USE_CREDENTIAL: isize = 0;
const PERFORM_DEFAULT_HANDLING: isize = 1;

pub struct PakeCertDelegateIvars {
    // wry's real navigation delegate; every non-challenge selector forwards here.
    inner: Retained<AnyObject>,
}

define_class!(
    #[unsafe(super(NSObject))]
    #[name = "PakeCertBypassDelegate"]
    #[thread_kind = MainThreadOnly]
    #[ivars = PakeCertDelegateIvars]
    struct PakeCertBypassDelegate;

    unsafe impl NSObjectProtocol for PakeCertBypassDelegate {}

    impl PakeCertBypassDelegate {
        #[unsafe(method(webView:didReceiveAuthenticationChallenge:completionHandler:))]
        fn did_receive_challenge(
            &self,
            _webview: &AnyObject,
            challenge: &AnyObject,
            handler: &block2::Block<dyn Fn(isize, *mut AnyObject)>,
        ) {
            unsafe {
                let space: *mut AnyObject = msg_send![challenge, protectionSpace];
                if space.is_null() {
                    handler.call((PERFORM_DEFAULT_HANDLING, core::ptr::null_mut()));
                    return;
                }
                // Only server-trust challenges carry a non-null serverTrust; for
                // anything else (e.g. HTTP basic auth) defer to default handling.
                let server_trust: *mut AnyObject = msg_send![space, serverTrust];
                if server_trust.is_null() {
                    handler.call((PERFORM_DEFAULT_HANDLING, core::ptr::null_mut()));
                    return;
                }
                let credential: *mut AnyObject =
                    msg_send![class!(NSURLCredential), credentialForTrust: server_trust];
                handler.call((USE_CREDENTIAL, credential));
            }
        }

        // WKWebView probes respondsToSelector: before calling optional delegate
        // methods, so report our own methods plus everything wry implements.
        #[unsafe(method(respondsToSelector:))]
        fn responds_to_selector(&self, selector: Sel) -> Bool {
            let responds: Bool = unsafe { msg_send![super(self), respondsToSelector: selector] };
            if responds.as_bool() {
                return Bool::YES;
            }
            let inner: &AnyObject = &self.ivars().inner;
            unsafe { msg_send![inner, respondsToSelector: selector] }
        }

        // Fast-forward any selector we do not implement to wry's delegate.
        #[unsafe(method(forwardingTargetForSelector:))]
        fn forwarding_target(&self, _selector: Sel) -> *mut AnyObject {
            Retained::as_ptr(&self.ivars().inner) as *mut AnyObject
        }
    }
);

impl PakeCertBypassDelegate {
    fn new(inner: Retained<AnyObject>, mtm: MainThreadMarker) -> Retained<Self> {
        let this = mtm
            .alloc::<PakeCertBypassDelegate>()
            .set_ivars(PakeCertDelegateIvars { inner });
        unsafe { msg_send![super(this), init] }
    }
}

/// Replace the WKWebView's navigation delegate with a proxy that accepts
/// invalid TLS certificates. `webview_ptr` is the raw `WKWebView` from
/// `PlatformWebview::inner()`. No-op off the main thread or on a null pointer.
pub fn install_cert_bypass(webview_ptr: *mut c_void) {
    if webview_ptr.is_null() {
        return;
    }
    let Some(mtm) = MainThreadMarker::new() else {
        return;
    };
    unsafe {
        let webview: &AnyObject = &*(webview_ptr as *const AnyObject);
        let existing: *mut AnyObject = msg_send![webview, navigationDelegate];
        if existing.is_null() {
            return;
        }
        let Some(inner) = Retained::retain(existing) else {
            return;
        };
        let proxy = PakeCertBypassDelegate::new(inner, mtm);
        let _: () = msg_send![webview, setNavigationDelegate: &*proxy];
        // navigationDelegate is a weak property; leak the proxy so it outlives
        // this call and stays installed for the window's lifetime.
        std::mem::forget(proxy);
    }
}
