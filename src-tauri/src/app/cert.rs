// macOS TLS certificate handling for `--ignore-certificate-errors` and
// `--client-cert`.
//
// On macOS the webview is a WKWebView, which ignores the Chromium
// `--ignore-certificate-errors` flag entirely, so Pake's flag was a no-op here
// (see the Windows/Linux vs macOS split in window.rs). wry's own
// `WryNavigationDelegate` does not implement
// `webView:didReceiveAuthenticationChallenge:completionHandler:`, so WKWebView
// falls back to default validation: it rejects self-signed certs, and it never
// offers a client certificate.
//
// This installs a thin navigation-delegate proxy handling two independent,
// separately opt-in concerns, and forwards every other selector to wry's
// original delegate so navigation policy, downloads, and page-load callbacks
// keep working untouched:
//
//   --ignore-certificate-errors  accept server trust for the target host only
//                                (relaxes *our* validation of the server)
//   --client-cert                answer client-certificate challenges with a
//                                keychain identity (proves *our* identity to
//                                the server, i.e. mTLS)
//
// The two are deliberately separate flags: mTLS logins are a normal
// authentication mechanism and must not require disabling server validation.
// Chromium-based runtimes (Chrome, Electron) auto-select a client certificate
// by default, which is why mTLS portals "just work" there but not in a
// WKWebView, where the app must opt in explicitly.

use objc2::rc::{Retained, Weak};
use objc2::runtime::{AnyObject, Bool, NSObject, NSObjectProtocol, Sel};
use objc2::{class, define_class, msg_send, DefinedClass, MainThreadMarker, MainThreadOnly};
use objc2_foundation::NSString;
use std::ffi::c_void;

// NSURLSessionAuthChallengeDisposition values.
const USE_CREDENTIAL: isize = 0;
const PERFORM_DEFAULT_HANDLING: isize = 1;
// NSURLCredentialPersistenceForSession
const NS_URL_CREDENTIAL_PERSISTENCE_FOR_SESSION: usize = 1;

pub struct PakeCertDelegateIvars {
    // wry's real navigation delegate; every non-challenge selector forwards here.
    inner: Weak<AnyObject>,
    allowed_host: String,
    // Opt-in via `--client-cert`: answer client-certificate challenges with an
    // identity from the keychain. Independent from `--ignore-certificate-errors`,
    // which only relaxes *server* trust validation.
    client_cert: bool,
}

static CERT_BYPASS_ASSOCIATION_KEY: u8 = 0;

fn hosts_match(allowed_host: &str, challenge_host: &str) -> bool {
    allowed_host
        .trim_end_matches('.')
        .eq_ignore_ascii_case(challenge_host.trim_end_matches('.'))
}

// Pick a keychain identity whose issuer matches one of the CA distinguished
// names the server advertised in the TLS CertificateRequest. Relying on the
// server's own `distinguishedNames` keeps this generic: no hardcoded issuer,
// no hardcoded host list. Returns a retained SecIdentityRef as AnyObject.
//
// Only identities issued by a CA the server explicitly asked for are eligible,
// so an unrelated identity (e.g. an Apple Developer ID) is never offered.
unsafe fn find_matching_identity(space: *mut AnyObject) -> *mut AnyObject {
    // NSArray<NSData *> * — DER-encoded issuer DNs accepted by the server.
    let dns: *mut AnyObject = msg_send![space, distinguishedNames];
    if dns.is_null() {
        return core::ptr::null_mut();
    }
    let dn_count: usize = msg_send![dns, count];
    if dn_count == 0 {
        return core::ptr::null_mut();
    }

    // Query every signing identity in the keychain (includes CryptoTokenKit
    // virtual smart cards, which is how corporate tools provision certs).
    // Keys come from Security.framework's exported constants rather than raw
    // string literals, so a typo fails at link time instead of silently
    // producing an empty match set at runtime.
    let query: *mut AnyObject = msg_send![class!(NSMutableDictionary), dictionary];
    let set_key = |key: *const AnyObject, value: *const AnyObject| {
        let _: () = msg_send![query, setObject: value, forKey: key];
    };
    let yes: *mut AnyObject = msg_send![class!(NSNumber), numberWithBool: true];
    set_key(kSecClass, kSecClassIdentity);
    set_key(kSecReturnRef, yes);
    set_key(kSecMatchLimit, kSecMatchLimitAll);
    set_key(kSecAttrCanSign, yes);

    let mut result: *mut AnyObject = core::ptr::null_mut();
    let status: i32 = SecItemCopyMatching(query, &mut result);
    if status != 0 || result.is_null() {
        return core::ptr::null_mut();
    }

    let id_count: usize = msg_send![result, count];
    for i in 0..id_count {
        let identity: *mut AnyObject = msg_send![result, objectAtIndex: i];
        if identity.is_null() {
            continue;
        }
        let mut cert: *mut AnyObject = core::ptr::null_mut();
        if SecIdentityCopyCertificate(identity, &mut cert) != 0 || cert.is_null() {
            continue;
        }
        // Normalized issuer sequence is the DER DN, directly comparable to the
        // entries the server sent.
        let issuer: *mut AnyObject = SecCertificateCopyNormalizedIssuerSequence(cert);
        if issuer.is_null() {
            continue;
        }
        for j in 0..dn_count {
            let wanted: *mut AnyObject = msg_send![dns, objectAtIndex: j];
            if wanted.is_null() {
                continue;
            }
            let equal: Bool = msg_send![issuer, isEqualToData: wanted];
            if equal.as_bool() {
                return identity;
            }
        }
    }
    core::ptr::null_mut()
}

// Security.framework entry points used by `find_matching_identity`.
#[link(name = "Security", kind = "framework")]
extern "C" {
    fn SecItemCopyMatching(query: *mut AnyObject, result: *mut *mut AnyObject) -> i32;
    fn SecIdentityCopyCertificate(identity: *mut AnyObject, cert: *mut *mut AnyObject) -> i32;
    fn SecCertificateCopyNormalizedIssuerSequence(cert: *mut AnyObject) -> *mut AnyObject;

    // CFStringRef query keys. Declared as opaque objects so they can be passed
    // straight into an NSMutableDictionary (CFString and NSString are toll-free
    // bridged).
    static kSecClass: *const AnyObject;
    static kSecClassIdentity: *const AnyObject;
    static kSecReturnRef: *const AnyObject;
    static kSecMatchLimit: *const AnyObject;
    static kSecMatchLimitAll: *const AnyObject;
    static kSecAttrCanSign: *const AnyObject;
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

                // Client-certificate challenges carry a null serverTrust and are
                // scoped by the CA list the server advertised, not by host, so
                // they are handled before the host filter. mTLS logins (e.g. an
                // SSO portal) redirect across several hosts that all request a
                // cert, and the configured target host is usually not one of them.
                let auth_method: *mut NSString = msg_send![space, authenticationMethod];
                if self.ivars().client_cert
                    && !auth_method.is_null()
                    && (&*auth_method).to_string() == "NSURLAuthenticationMethodClientCertificate"
                {
                    let identity = find_matching_identity(space);
                    if !identity.is_null() {
                        let credential: *mut AnyObject = msg_send![
                            class!(NSURLCredential),
                            credentialWithIdentity: identity,
                            certificates: core::ptr::null::<AnyObject>(),
                            persistence: NS_URL_CREDENTIAL_PERSISTENCE_FOR_SESSION
                        ];
                        handler.call((USE_CREDENTIAL, credential));
                        return;
                    }
                    // No identity issued by an advertised CA: fall through to
                    // default handling so the server can reject us normally.
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
        client_cert: bool,
        mtm: MainThreadMarker,
    ) -> Retained<Self> {
        let this = mtm
            .alloc::<PakeCertBypassDelegate>()
            .set_ivars(PakeCertDelegateIvars {
                inner: Weak::from_retained(inner),
                allowed_host,
                client_cert,
            });
        unsafe { msg_send![super(this), init] }
    }
}

/// Replace the WKWebView's navigation delegate with a proxy that (a) accepts
/// invalid TLS certificates for the configured target host when
/// `--ignore-certificate-errors` is set, and/or (b) answers client-certificate
/// challenges from the keychain when `--client-cert` is set, then navigate to
/// that target. `webview_ptr` is the raw `WKWebView` from
/// `PlatformWebview::inner()`. Returns false if setup cannot be completed.
///
/// `allowed_host` scopes the server-trust bypass only. Client-certificate
/// handling is scoped by the CA list the server advertises, so it stays active
/// across login redirects even when `allowed_host` is empty.
pub fn install_cert_bypass_and_navigate(
    webview_ptr: *mut c_void,
    allowed_host: String,
    client_cert: bool,
    target_url: String,
) -> bool {
    if webview_ptr.is_null() || target_url.is_empty() {
        return false;
    }
    // Nothing to do unless at least one of the two features is requested.
    if allowed_host.is_empty() && !client_cert {
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
        let proxy = PakeCertBypassDelegate::new(&inner, allowed_host, client_cert, mtm);
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
