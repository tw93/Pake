// macOS authentication handling for HTTP Basic auth and invalid certificates.
//
// WKWebView does not show its own HTTP Basic login dialog, and it ignores the
// Chromium certificate-error flag. Wry's navigation delegate also does not
// implement the authentication-challenge callback. This host-scoped proxy
// handles the two opt-in cases and forwards every other selector to wry.

use objc2::rc::{Retained, Weak};
use objc2::runtime::{AnyObject, Bool, NSObject, NSObjectProtocol, Sel};
use objc2::{class, define_class, msg_send, DefinedClass, MainThreadMarker, MainThreadOnly};
use objc2_app_kit::{
    NSAlert, NSAlertFirstButtonReturn, NSControlSize, NSSecureTextField, NSTextField, NSView,
};
use objc2_foundation::{NSPoint, NSRect, NSSize, NSString};
use std::ffi::c_void;

// NSURLSessionAuthChallengeDisposition values.
const USE_CREDENTIAL: isize = 0;
const PERFORM_DEFAULT_HANDLING: isize = 1;
const CANCEL_AUTHENTICATION_CHALLENGE: isize = 2;

// NSURLCredentialPersistenceForSession.
const CREDENTIAL_PERSISTENCE_FOR_SESSION: usize = 1;

// NSKeyValueObservingOptionNew.
const KVO_OPTION_NEW: usize = 1;
const FORM_LABEL_LEFT_INSET: f64 = 4.0;
const FORM_FIELD_WIDTH: f64 = 216.0;

const HTTP_BASIC_METHOD: &str = "NSURLAuthenticationMethodHTTPBasic";
const SERVER_TRUST_METHOD: &str = "NSURLAuthenticationMethodServerTrust";

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum ChallengeAction {
    Default,
    PromptForBasicCredentials,
    TrustServerCertificate,
}

pub struct PakeAuthDelegateIvars {
    // Wry's real navigation delegate; all non-challenge selectors forward here.
    inner: Weak<AnyObject>,
    // The proxy observes this webview so it can recover if WebKit replaces the
    // navigation delegate after construction but before the first challenge.
    webview: Weak<AnyObject>,
    allowed_host: String,
    prompt_for_basic_auth: bool,
    allow_invalid_certificates: bool,
}

static AUTH_DELEGATE_ASSOCIATION_KEY: u8 = 0;

fn hosts_match(allowed_host: &str, challenge_host: &str) -> bool {
    allowed_host
        .trim_end_matches('.')
        .eq_ignore_ascii_case(challenge_host.trim_end_matches('.'))
}

fn challenge_action(
    allowed_host: &str,
    challenge_host: &str,
    authentication_method: &str,
    has_server_trust: bool,
    prompt_for_basic_auth: bool,
    allow_invalid_certificates: bool,
) -> ChallengeAction {
    if !hosts_match(allowed_host, challenge_host) {
        return ChallengeAction::Default;
    }
    if allow_invalid_certificates
        && has_server_trust
        && authentication_method == SERVER_TRUST_METHOD
    {
        return ChallengeAction::TrustServerCertificate;
    }
    if prompt_for_basic_auth && authentication_method == HTTP_BASIC_METHOD {
        return ChallengeAction::PromptForBasicCredentials;
    }
    ChallengeAction::Default
}

fn prompt_for_credentials(
    mtm: MainThreadMarker,
    host: &str,
    realm: Option<&str>,
    previous_failures: usize,
) -> Option<(String, String)> {
    let alert = NSAlert::new(mtm);
    let title = if previous_failures == 0 {
        format!("Sign In to {host}")
    } else {
        format!("Couldn't Sign In to {host}")
    };
    alert.setMessageText(&NSString::from_str(&title));

    let detail = match (previous_failures, realm.filter(|value| !value.is_empty())) {
        (0, Some(realm)) => format!("Enter the username and password for {realm}."),
        (0, None) => "Enter the username and password for this server.".to_string(),
        _ => "The username or password was incorrect. Try again.".to_string(),
    };
    alert.setInformativeText(&NSString::from_str(&detail));

    let accessory = NSView::initWithFrame(
        mtm.alloc(),
        NSRect::new(NSPoint::new(0.0, 0.0), NSSize::new(320.0, 70.0)),
    );
    let username_label = NSTextField::labelWithString(&NSString::from_str("Username:"), mtm);
    username_label.setFrame(NSRect::new(
        NSPoint::new(FORM_LABEL_LEFT_INSET, 45.0),
        NSSize::new(72.0, 18.0),
    ));
    let username = NSTextField::initWithFrame(
        mtm.alloc(),
        NSRect::new(
            NSPoint::new(84.0, 38.0),
            NSSize::new(FORM_FIELD_WIDTH, 28.0),
        ),
    );
    username.setControlSize(NSControlSize::Large);
    let password_label = NSTextField::labelWithString(&NSString::from_str("Password:"), mtm);
    password_label.setFrame(NSRect::new(
        NSPoint::new(FORM_LABEL_LEFT_INSET, 11.0),
        NSSize::new(72.0, 18.0),
    ));
    let password = NSSecureTextField::initWithFrame(
        mtm.alloc(),
        NSRect::new(NSPoint::new(84.0, 4.0), NSSize::new(FORM_FIELD_WIDTH, 28.0)),
    );
    password.setControlSize(NSControlSize::Large);
    accessory.addSubview(&username_label);
    accessory.addSubview(&username);
    accessory.addSubview(&password_label);
    accessory.addSubview(&password);
    alert.setAccessoryView(Some(&accessory));
    let sign_in_button = alert.addButtonWithTitle(&NSString::from_str("Sign In"));
    sign_in_button.setControlSize(NSControlSize::Large);
    let cancel_button = alert.addButtonWithTitle(&NSString::from_str("Cancel"));
    cancel_button.setControlSize(NSControlSize::Large);
    alert.layout();
    for button in [&sign_in_button, &cancel_button] {
        let size = button.frame().size;
        button.setFrameSize(NSSize::new(size.width, 34.0));
    }
    alert.window().makeFirstResponder(Some(&username));

    if alert.runModal() != NSAlertFirstButtonReturn {
        return None;
    }
    Some((
        username.stringValue().to_string(),
        password.stringValue().to_string(),
    ))
}

define_class!(
    #[unsafe(super(NSObject))]
    #[name = "PakeAuthenticationDelegate"]
    #[thread_kind = MainThreadOnly]
    #[ivars = PakeAuthDelegateIvars]
    struct PakeAuthDelegate;

    unsafe impl NSObjectProtocol for PakeAuthDelegate {}

    impl PakeAuthDelegate {
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
                let method: *mut NSString = msg_send![space, authenticationMethod];
                if host.is_null() || method.is_null() {
                    handler.call((PERFORM_DEFAULT_HANDLING, core::ptr::null_mut()));
                    return;
                }
                let challenge_host = (&*host).to_string();
                let authentication_method = (&*method).to_string();
                let server_trust: *mut AnyObject = msg_send![space, serverTrust];

                match challenge_action(
                    &self.ivars().allowed_host,
                    &challenge_host,
                    &authentication_method,
                    !server_trust.is_null(),
                    self.ivars().prompt_for_basic_auth,
                    self.ivars().allow_invalid_certificates,
                ) {
                    ChallengeAction::Default => {
                        handler.call((PERFORM_DEFAULT_HANDLING, core::ptr::null_mut()));
                    }
                    ChallengeAction::TrustServerCertificate => {
                        let credential: *mut AnyObject = msg_send![
                            class!(NSURLCredential),
                            credentialForTrust: server_trust
                        ];
                        if credential.is_null() {
                            handler.call((PERFORM_DEFAULT_HANDLING, core::ptr::null_mut()));
                        } else {
                            handler.call((USE_CREDENTIAL, credential));
                        }
                    }
                    ChallengeAction::PromptForBasicCredentials => {
                        let realm: *mut NSString = msg_send![space, realm];
                        let realm = (!realm.is_null()).then(|| (&*realm).to_string());
                        let previous_failures: usize =
                            msg_send![challenge, previousFailureCount];
                        let Some((user, password)) = prompt_for_credentials(
                            self.mtm(),
                            &challenge_host,
                            realm.as_deref(),
                            previous_failures,
                        ) else {
                            handler.call((
                                CANCEL_AUTHENTICATION_CHALLENGE,
                                core::ptr::null_mut(),
                            ));
                            return;
                        };
                        let credential: *mut AnyObject = msg_send![
                            class!(NSURLCredential),
                            credentialWithUser: &*NSString::from_str(&user),
                            password: &*NSString::from_str(&password),
                            persistence: CREDENTIAL_PERSISTENCE_FOR_SESSION
                        ];
                        if credential.is_null() {
                            handler.call((PERFORM_DEFAULT_HANDLING, core::ptr::null_mut()));
                        } else {
                            handler.call((USE_CREDENTIAL, credential));
                        }
                    }
                }
            }
        }

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

        #[unsafe(method(forwardingTargetForSelector:))]
        fn forwarding_target(&self, _selector: Sel) -> *mut AnyObject {
            self.ivars()
                .inner
                .load()
                .map(|inner| Retained::as_ptr(&inner) as *mut AnyObject)
                .unwrap_or(core::ptr::null_mut())
        }

        #[unsafe(method(observeValueForKeyPath:ofObject:change:context:))]
        fn observe_value(
            &self,
            key_path: &NSString,
            object: &AnyObject,
            change: *mut AnyObject,
            context: *mut c_void,
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
                if current != self_ptr {
                    let _: () = msg_send![object, setNavigationDelegate: self];
                }
            }
        }
    }
);

impl Drop for PakeAuthDelegate {
    fn drop(&mut self) {
        if let Some(webview) = self.ivars().webview.load() {
            unsafe {
                let key_path = NSString::from_str("navigationDelegate");
                let self_ptr = self as *const Self as *mut AnyObject;
                let _: () = msg_send![
                    &*webview,
                    removeObserver: self_ptr,
                    forKeyPath: &*key_path
                ];
            }
        }
    }
}

impl PakeAuthDelegate {
    fn new(
        webview: &Retained<AnyObject>,
        inner: &Retained<AnyObject>,
        allowed_host: String,
        prompt_for_basic_auth: bool,
        allow_invalid_certificates: bool,
        mtm: MainThreadMarker,
    ) -> Retained<Self> {
        let this = mtm
            .alloc::<PakeAuthDelegate>()
            .set_ivars(PakeAuthDelegateIvars {
                inner: Weak::from_retained(inner),
                webview: Weak::from_retained(webview),
                allowed_host,
                prompt_for_basic_auth,
                allow_invalid_certificates,
            });
        unsafe { msg_send![super(this), init] }
    }
}

/// Install the authentication proxy before navigating to the target URL.
/// Credentials are requested inside the packaged app and retained only by the
/// current URL session. Returns false when setup cannot be completed.
pub fn install_auth_delegate_and_navigate(
    webview_ptr: *mut c_void,
    allowed_host: String,
    target_url: String,
    prompt_for_basic_auth: bool,
    allow_invalid_certificates: bool,
) -> bool {
    if webview_ptr.is_null()
        || allowed_host.is_empty()
        || target_url.is_empty()
        || (!prompt_for_basic_auth && !allow_invalid_certificates)
    {
        return false;
    }
    let Some(mtm) = MainThreadMarker::new() else {
        return false;
    };
    unsafe {
        let Some(webview) = Retained::retain(webview_ptr as *mut AnyObject) else {
            return false;
        };
        let existing: *mut AnyObject = msg_send![&*webview, navigationDelegate];
        if existing.is_null() {
            return false;
        }
        let Some(inner) = Retained::retain(existing) else {
            return false;
        };
        let proxy = PakeAuthDelegate::new(
            &webview,
            &inner,
            allowed_host,
            prompt_for_basic_auth,
            allow_invalid_certificates,
            mtm,
        );
        objc2::ffi::objc_setAssociatedObject(
            &*webview as *const AnyObject as *mut AnyObject,
            std::ptr::addr_of!(AUTH_DELEGATE_ASSOCIATION_KEY).cast(),
            Retained::as_ptr(&proxy) as *mut AnyObject,
            objc2::ffi::OBJC_ASSOCIATION_RETAIN_NONATOMIC,
        );
        let key_path = NSString::from_str("navigationDelegate");
        let observer_ptr = &*proxy as *const PakeAuthDelegate as *mut AnyObject;
        let _: () = msg_send![
            &*webview,
            addObserver: observer_ptr,
            forKeyPath: &*key_path,
            options: KVO_OPTION_NEW,
            context: core::ptr::null_mut::<c_void>()
        ];
        let _: () = msg_send![&*webview, setNavigationDelegate: &*proxy];

        let target_url = NSString::from_str(&target_url);
        let ns_url: *mut AnyObject = msg_send![class!(NSURL), URLWithString: &*target_url];
        if ns_url.is_null() {
            return false;
        }
        let request: *mut AnyObject = msg_send![class!(NSURLRequest), requestWithURL: ns_url];
        if request.is_null() {
            return false;
        }
        let _: () = msg_send![&*webview, loadRequest: request];
        true
    }
}

#[cfg(test)]
mod tests {
    use super::{
        challenge_action, hosts_match, ChallengeAction, HTTP_BASIC_METHOD, SERVER_TRUST_METHOD,
    };

    #[test]
    fn matches_only_the_configured_host() {
        assert!(hosts_match("INTERNAL.EXAMPLE.COM", "internal.example.com"));
        assert!(hosts_match("internal.example.com.", "internal.example.com"));
        assert!(!hosts_match("internal.example.com", "login.example.com"));
    }

    #[test]
    fn prompts_for_basic_auth_only_when_enabled_on_the_target_host() {
        assert_eq!(
            challenge_action(
                "internal.example.com",
                "internal.example.com",
                HTTP_BASIC_METHOD,
                true,
                true,
                true,
            ),
            ChallengeAction::PromptForBasicCredentials
        );
        assert_eq!(
            challenge_action(
                "internal.example.com",
                "login.example.com",
                HTTP_BASIC_METHOD,
                false,
                true,
                false,
            ),
            ChallengeAction::Default
        );
        assert_eq!(
            challenge_action(
                "internal.example.com",
                "internal.example.com",
                HTTP_BASIC_METHOD,
                false,
                false,
                false,
            ),
            ChallengeAction::Default
        );
    }

    #[test]
    fn accepts_server_trust_only_when_enabled_on_the_target_host() {
        assert_eq!(
            challenge_action(
                "internal.example.com",
                "internal.example.com",
                SERVER_TRUST_METHOD,
                true,
                false,
                true,
            ),
            ChallengeAction::TrustServerCertificate
        );
        assert_eq!(
            challenge_action(
                "internal.example.com",
                "login.example.com",
                SERVER_TRUST_METHOD,
                true,
                true,
                true,
            ),
            ChallengeAction::Default
        );
    }
}
