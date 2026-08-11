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
    // Hosts explicitly allowed to receive a client certificate. The
    // window builder supplies the packaged target URL host when the user does
    // not configure an explicit allowlist.
    client_cert_hosts: Vec<String>,
}

static CERT_BYPASS_ASSOCIATION_KEY: u8 = 0;

fn hosts_match(allowed_host: &str, challenge_host: &str) -> bool {
    allowed_host
        .trim_end_matches('.')
        .eq_ignore_ascii_case(challenge_host.trim_end_matches('.'))
}

fn host_in_allowlist(allowed_hosts: &[String], challenge_host: &str) -> bool {
    allowed_hosts
        .iter()
        .any(|allowed_host| hosts_match(allowed_host, challenge_host))
}

fn dn_list_contains(dns: *mut AnyObject, dn_count: usize, normalized_dn: *mut AnyObject) -> bool {
    if normalized_dn.is_null() {
        return false;
    }

    for j in 0..dn_count {
        let wanted: *mut AnyObject = unsafe { msg_send![dns, objectAtIndex: j] };
        if wanted.is_null() {
            continue;
        }
        let equal: Bool = unsafe { msg_send![normalized_dn, isEqualToData: wanted] };
        if equal.as_bool() {
            return true;
        }
    }
    false
}

unsafe fn identity_matches_authorities(
    identity: *mut AnyObject,
    dns: *mut AnyObject,
    dn_count: usize,
) -> bool {
    let mut cert: *mut AnyObject = core::ptr::null_mut();
    if SecIdentityCopyCertificate(identity, &mut cert) != 0 || cert.is_null() {
        return false;
    }

    // Match the leaf certificate's direct issuer against the CA DN list the
    // server advertised. This also covers identities whose intermediate is not
    // available in the keychain. The rest of the chain is deliberately not
    // walked: a server that advertises a root CA while the client leaf is
    // issued by an intermediate CA will not match here, and no identity is
    // selected for the challenge.
    let issuer: *mut AnyObject = SecCertificateCopyNormalizedIssuerSequence(cert);
    let matches = dn_list_contains(dns, dn_count, issuer);
    if !issuer.is_null() {
        CFRelease(issuer.cast());
    }
    CFRelease(cert.cast());
    matches
}

// Pick a keychain identity for a client-certificate challenge. When the server
// advertises CA distinguished names, require the leaf certificate's issuer to
// match one of them. When the list is empty, follow Chromium's behavior and do
// not apply issuer filtering: the host allowlist remains the authorization
// boundary, and the first signing identity from Keychain Services is used.
// Returns a retained SecIdentityRef as AnyObject.
unsafe fn find_matching_identity(space: *mut AnyObject) -> *mut AnyObject {
    // NSArray<NSData *> * — DER-encoded issuer DNs accepted by the server.
    let dns: *mut AnyObject = msg_send![space, distinguishedNames];
    let dn_count: usize = if dns.is_null() {
        0
    } else {
        msg_send![dns, count]
    };

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
    let mut selected_identity = core::ptr::null_mut();
    for i in 0..id_count {
        let identity: *mut AnyObject = msg_send![result, objectAtIndex: i];
        if identity.is_null() {
            continue;
        }
        if dn_count == 0 || identity_matches_authorities(identity, dns, dn_count) {
            selected_identity = CFRetain(identity.cast()).cast();
            break;
        }
    }

    CFRelease(result.cast());
    selected_identity
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

#[link(name = "CoreFoundation", kind = "framework")]
extern "C" {
    fn CFRetain(cf: *const c_void) -> *mut c_void;
    fn CFRelease(cf: *const c_void);
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

                // Client-certificate challenges must be authorized by host before
                // matching any identity. The server controls the advertised CA DN
                // list, so CA matching alone is not a user-consent boundary.
                let auth_method: *mut NSString = msg_send![space, authenticationMethod];
                if self.ivars().client_cert
                    && !auth_method.is_null()
                    && (&*auth_method).to_string() == "NSURLAuthenticationMethodClientCertificate"
                {
                    let host: *mut NSString = msg_send![space, host];
                    if host.is_null()
                        || !host_in_allowlist(
                            &self.ivars().client_cert_hosts,
                            &(&*host).to_string(),
                        )
                    {
                        handler.call((PERFORM_DEFAULT_HANDLING, core::ptr::null_mut()));
                        return;
                    }

                    let identity = find_matching_identity(space);
                    if !identity.is_null() {
                        let credential: *mut AnyObject = msg_send![
                            class!(NSURLCredential),
                            credentialWithIdentity: identity,
                            certificates: core::ptr::null::<AnyObject>(),
                            persistence: NS_URL_CREDENTIAL_PERSISTENCE_FOR_SESSION
                        ];
                        CFRelease(identity.cast());
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
        client_cert_hosts: Vec<String>,
        mtm: MainThreadMarker,
    ) -> Retained<Self> {
        let this = mtm
            .alloc::<PakeCertBypassDelegate>()
            .set_ivars(PakeCertDelegateIvars {
                inner: Weak::from_retained(inner),
                allowed_host,
                client_cert,
                client_cert_hosts,
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
/// `allowed_host` scopes the server-trust bypass only. `client_cert_hosts`
/// scopes the client-certificate response; the window builder supplies the
/// packaged target URL host when the user does not configure an explicit
/// allowlist.
pub fn install_cert_bypass_and_navigate(
    webview_ptr: *mut c_void,
    allowed_host: String,
    client_cert: bool,
    client_cert_hosts: Vec<String>,
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
        let proxy =
            PakeCertBypassDelegate::new(&inner, allowed_host, client_cert, client_cert_hosts, mtm);
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
    use super::{host_in_allowlist, hosts_match};

    #[test]
    fn accepts_the_configured_host_case_insensitively() {
        assert!(hosts_match("INTERNAL.EXAMPLE.COM", "internal.example.com"));
        assert!(hosts_match("internal.example.com.", "internal.example.com"));
    }

    #[test]
    fn rejects_other_hosts() {
        assert!(!hosts_match("internal.example.com", "login.example.com"));
    }

    #[test]
    fn client_cert_allowlist_accepts_only_configured_hosts() {
        let allowed_hosts = vec![
            "sso.example.com".to_string(),
            "auth.example.com.".to_string(),
        ];

        assert!(host_in_allowlist(&allowed_hosts, "SSO.example.com."));
        assert!(host_in_allowlist(&allowed_hosts, "auth.example.com"));
        assert!(!host_in_allowlist(&allowed_hosts, "evil.example.com"));
    }
}
