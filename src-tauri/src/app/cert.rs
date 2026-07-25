// macOS TLS certificate bypass for `--ignore-certificate-errors`.
//
// On macOS the webview is a WKWebView, which ignores the Chromium
// `--ignore-certificate-errors` flag entirely, so Pake's flag was a no-op here
// (see the Windows/Linux vs macOS split in window.rs). wry's own
// `WryNavigationDelegate` does not implement
// `webView:didReceiveAuthenticationChallenge:completionHandler:`, so WKWebView
// falls back to default validation and rejects self-signed certs.
//
// This installs a thin navigation-delegate proxy that accepts server trust only
// for the configured target host and forwards every other selector to wry's
// original delegate, so navigation policy, downloads, and page-load callbacks
// keep working untouched. It is installed only when the user opts in via
// `--ignore-certificate-errors`.

use objc2::rc::{Retained, Weak};
use objc2::runtime::{AnyObject, Bool, NSObject, NSObjectProtocol, Sel};
use objc2::{class, define_class, msg_send, DefinedClass, MainThreadMarker, MainThreadOnly};
use objc2_foundation::NSString;
use std::ffi::c_void;

// NSURLSessionAuthChallengeDisposition values.
const USE_CREDENTIAL: isize = 0;
const PERFORM_DEFAULT_HANDLING: isize = 1;

pub struct PakeCertDelegateIvars {
    // wry's real navigation delegate; every non-challenge selector forwards here.
    inner: Weak<AnyObject>,
    allowed_host: String,
}

static CERT_BYPASS_ASSOCIATION_KEY: u8 = 0;

fn hosts_match(allowed_host: &str, challenge_host: &str) -> bool {
    allowed_host
        .trim_end_matches('.')
        .eq_ignore_ascii_case(challenge_host.trim_end_matches('.'))
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
                let host: *mut NSString = msg_send![space, host];
                if host.is_null()
                    || !hosts_match(&self.ivars().allowed_host, &(&*host).to_string())
                {
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
            self.ivars()
                .inner
                .load()
                .map(|inner| unsafe { msg_send![&*inner, respondsToSelector: selector] })
                .unwrap_or(Bool::NO)
        }

        // Fast-forward any selector we do not implement to wry's delegate.
        #[unsafe(method(forwardingTargetForSelector:))]
        fn forwarding_target(&self, _selector: Sel) -> *mut AnyObject {
            self.ivars()
                .inner
                .load()
                .map(|inner| Retained::as_ptr(&inner) as *mut AnyObject)
                .unwrap_or(core::ptr::null_mut())
        }
    }
);

impl PakeCertBypassDelegate {
    fn new(
        inner: &Retained<AnyObject>,
        allowed_host: String,
        mtm: MainThreadMarker,
    ) -> Retained<Self> {
        let this = mtm
            .alloc::<PakeCertBypassDelegate>()
            .set_ivars(PakeCertDelegateIvars {
                inner: Weak::from_retained(inner),
                allowed_host,
            });
        unsafe { msg_send![super(this), init] }
    }
}

/// Replace the WKWebView's navigation delegate with a proxy that accepts
/// invalid TLS certificates for the configured target host, then navigate to
/// that target. `webview_ptr` is the raw `WKWebView` from
/// `PlatformWebview::inner()`. Returns false if setup cannot be completed.
pub fn install_cert_bypass_and_navigate(
    webview_ptr: *mut c_void,
    allowed_host: String,
    target_url: String,
) -> bool {
    if webview_ptr.is_null() || allowed_host.is_empty() || target_url.is_empty() {
        return false;
    }
    let Some(mtm) = MainThreadMarker::new() else {
        return false;
    };
    unsafe {
        let webview: &AnyObject = &*(webview_ptr as *const AnyObject);
        let existing: *mut AnyObject = msg_send![webview, navigationDelegate];
        if existing.is_null() {
            return false;
        }
        let Some(inner) = Retained::retain(existing) else {
            return false;
        };
        let proxy = PakeCertBypassDelegate::new(&inner, allowed_host, mtm);
        objc2::ffi::objc_setAssociatedObject(
            webview as *const AnyObject as *mut AnyObject,
            std::ptr::addr_of!(CERT_BYPASS_ASSOCIATION_KEY).cast(),
            Retained::as_ptr(&proxy) as *mut AnyObject,
            objc2::ffi::OBJC_ASSOCIATION_RETAIN_NONATOMIC,
        );
        let _: () = msg_send![webview, setNavigationDelegate: &*proxy];

        let target_url = NSString::from_str(&target_url);
        let ns_url: *mut AnyObject = msg_send![class!(NSURL), URLWithString: &*target_url];
        if ns_url.is_null() {
            return false;
        }
        let request: *mut AnyObject = msg_send![class!(NSURLRequest), requestWithURL: ns_url];
        if request.is_null() {
            return false;
        }
        let _: () = msg_send![webview, loadRequest: request];
        true
    }
}

#[cfg(test)]
mod tests {
    use super::hosts_match;

    #[test]
    fn accepts_the_configured_host_case_insensitively() {
        assert!(hosts_match("INTERNAL.EXAMPLE.COM", "internal.example.com"));
        assert!(hosts_match("internal.example.com.", "internal.example.com"));
    }

    #[test]
    fn rejects_other_hosts() {
        assert!(!hosts_match("internal.example.com", "login.example.com"));
    }
}
