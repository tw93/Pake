//! The enclave, the prompts and the script message handler for passkeys on macOS.
//!
//! The handler is a `WKScriptMessageHandlerWithReply` in the page's world, so
//! the page's request arrives with WebKit's own record of the calling frame:
//! only a main frame may ask, and its security origin, not anything the page
//! says, goes into the client data the site verifies.
//!
//! The key is made with the plain Security API (`SecKeyCreateRandomKey` with
//! `kSecAttrTokenIDSecureEnclave`), which an ad hoc signed app may call
//! without any keychain entitlement as long as the key is not permanent; its
//! token (`toid`, the same blob CryptoKit's `dataRepresentation` holds) is
//! what the store keeps, and `SecKeyCreateWithData` rebuilds the key from it.
//! The key's access control asks for user presence, which is Touch ID, or the
//! login password on a Mac without it, every time it signs. Signing waits for
//! the user, so it runs off the main thread, and the page's answer goes back
//! on the main thread.

use super::{
    assertion_message, existing_text, failure_reply, finish_create, finish_get, missing_text,
    picker_labels, picker_text, plan_create, plan_get, prompt_reason, resolve_rp_id, Envelope,
    Failure, Origin, Request, Store, HANDLER_NAME,
};
use crate::util::UiLanguage;
use block2::{DynBlock, RcBlock};
use objc2::rc::{autoreleasepool, Allocated, Retained};
use objc2::runtime::{AnyClass, AnyObject, Bool, NSObject, NSObjectProtocol, Sel};
use objc2::{class, define_class, msg_send, sel, DefinedClass, MainThreadMarker, MainThreadOnly};
use objc2_app_kit::{NSAlert, NSAlertFirstButtonReturn, NSAlertSecondButtonReturn, NSApplication};
use objc2_foundation::{NSData, NSPoint, NSRect, NSSize, NSString};
use objc2_web_kit::{WKScriptMessage, WKScriptMessageHandlerWithReply, WKUserContentController};
use std::cell::{Cell, RefCell};
use std::ffi::c_void;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::OnceLock;

const ACCESS_PRIVATE_KEY_USAGE: usize = 1 << 30;
const ACCESS_USER_PRESENCE: usize = 1 << 0;
const PICKER_WIDTH: f64 = 260.0;
const PICKER_HEIGHT: f64 = 26.0;

#[link(name = "Security", kind = "framework")]
extern "C" {
    static kSecAttrKeyType: *const AnyObject;
    static kSecAttrKeyTypeECSECPrimeRandom: *const AnyObject;
    static kSecAttrKeySizeInBits: *const AnyObject;
    static kSecAttrKeyClass: *const AnyObject;
    static kSecAttrKeyClassPrivate: *const AnyObject;
    static kSecAttrTokenID: *const AnyObject;
    static kSecAttrTokenIDSecureEnclave: *const AnyObject;
    static kSecAttrIsPermanent: *const AnyObject;
    static kSecAttrAccessControl: *const AnyObject;
    static kSecAttrAccessibleWhenUnlockedThisDeviceOnly: *const AnyObject;
    static kSecPrivateKeyAttrs: *const AnyObject;
    static kSecUseAuthenticationContext: *const AnyObject;
    static kSecKeyAlgorithmECDSASignatureMessageX962SHA256: *const AnyObject;
    static kSecRandomDefault: *const c_void;

    fn SecAccessControlCreateWithFlags(
        allocator: *const c_void,
        protection: *const AnyObject,
        flags: usize,
        error: *mut *mut AnyObject,
    ) -> *mut AnyObject;
    fn SecKeyCreateRandomKey(
        parameters: *const AnyObject,
        error: *mut *mut AnyObject,
    ) -> *mut AnyObject;
    fn SecKeyCopyAttributes(key: *const AnyObject) -> *mut AnyObject;
    fn SecKeyCreateWithData(
        data: *const AnyObject,
        attributes: *const AnyObject,
        error: *mut *mut AnyObject,
    ) -> *mut AnyObject;
    fn SecKeyCopyPublicKey(key: *const AnyObject) -> *mut AnyObject;
    fn SecKeyCopyExternalRepresentation(
        key: *const AnyObject,
        error: *mut *mut AnyObject,
    ) -> *mut AnyObject;
    fn SecKeyCreateSignature(
        key: *const AnyObject,
        algorithm: *const AnyObject,
        data: *const AnyObject,
        error: *mut *mut AnyObject,
    ) -> *mut AnyObject;
    fn SecRandomCopyBytes(rnd: *const c_void, count: usize, bytes: *mut u8) -> i32;
}

#[link(name = "LocalAuthentication", kind = "framework")]
extern "C" {}

/// One ceremony at a time: the token of the one running, or 0. A second
/// request while it runs is refused; a cancel frees it at once, so the page's
/// next request is not refused while the old prompt is still closing.
static OWNER: AtomicU64 = AtomicU64::new(0);
static NEXT_TOKEN: AtomicU64 = AtomicU64::new(1);

/// A Security call's result, owned under the Create rule, or its error logged.
unsafe fn created(
    object: *mut AnyObject,
    error: *mut AnyObject,
    what: &str,
) -> Option<Retained<AnyObject>> {
    if let Some(error) = Retained::from_raw(error) {
        let code: isize = msg_send![&*error, code];
        eprintln!("[Pake] Passkey {what} failed: {code}");
    }
    Retained::from_raw(object)
}

fn dictionary(entries: &[(*const AnyObject, &AnyObject)]) -> Retained<AnyObject> {
    unsafe {
        let dictionary: Retained<AnyObject> = msg_send![class!(NSMutableDictionary), new];
        for (key, value) in entries {
            let _: () = msg_send![&*dictionary, setObject: *value, forKey: *key];
        }
        dictionary
    }
}

fn data_bytes(data: &AnyObject) -> Vec<u8> {
    unsafe {
        let length: usize = msg_send![data, length];
        let bytes: *const u8 = msg_send![data, bytes];
        if bytes.is_null() || length == 0 {
            return Vec::new();
        }
        std::slice::from_raw_parts(bytes, length).to_vec()
    }
}

fn number(value: i32) -> Retained<AnyObject> {
    unsafe { msg_send![class!(NSNumber), numberWithInt: value] }
}

fn boolean(value: bool) -> Retained<AnyObject> {
    unsafe { msg_send![class!(NSNumber), numberWithBool: Bool::new(value)] }
}

/// A new enclave key that signs only after user presence, when `present` holds.
fn new_key(present: bool) -> Option<Retained<AnyObject>> {
    unsafe {
        let flags = ACCESS_PRIVATE_KEY_USAGE | if present { ACCESS_USER_PRESENCE } else { 0 };
        let mut error: *mut AnyObject = std::ptr::null_mut();
        let access = SecAccessControlCreateWithFlags(
            std::ptr::null(),
            kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
            flags,
            &mut error,
        );
        let access = created(access, error, "access control")?;
        let private = dictionary(&[
            (kSecAttrIsPermanent, &boolean(false)),
            (kSecAttrAccessControl, &access),
        ]);
        let parameters = dictionary(&[
            (kSecAttrKeyType, &*kSecAttrKeyTypeECSECPrimeRandom),
            (kSecAttrKeySizeInBits, &number(256)),
            (kSecAttrTokenID, &*kSecAttrTokenIDSecureEnclave),
            (kSecPrivateKeyAttrs, &private),
        ]);
        let mut error: *mut AnyObject = std::ptr::null_mut();
        let key = SecKeyCreateRandomKey(Retained::as_ptr(&parameters), &mut error);
        created(key, error, "key creation")
    }
}

/// Whether this Mac has an enclave that will make a key, asked once.
fn available() -> bool {
    static AVAILABLE: OnceLock<bool> = OnceLock::new();
    *AVAILABLE.get_or_init(|| autoreleasepool(|_| new_key(false).is_some()))
}

/// The enclave's token for `key`, which is what the store keeps.
fn key_token(key: &AnyObject) -> Option<Vec<u8>> {
    unsafe {
        let attributes = Retained::from_raw(SecKeyCopyAttributes(key))?;
        let name = NSString::from_str("toid");
        let token: *mut AnyObject = msg_send![&*attributes, objectForKey: &*name];
        token
            .as_ref()
            .map(data_bytes)
            .filter(|token| !token.is_empty())
    }
}

/// `04 || x || y` for the public half of `key`.
fn public_point(key: &AnyObject) -> Option<Vec<u8>> {
    unsafe {
        let public = Retained::from_raw(SecKeyCopyPublicKey(key))?;
        let mut error: *mut AnyObject = std::ptr::null_mut();
        let data = SecKeyCopyExternalRepresentation(Retained::as_ptr(&public), &mut error);
        let data = created(data, error, "public key export")?;
        Some(data_bytes(&data))
    }
}

/// A Touch ID context whose prompt reads "<App> is trying to <reason>.". Made
/// on the main thread so a cancel there can `invalidate` it, which ends the
/// prompt and fails the signature waiting on it.
fn new_context(reason: &str) -> Option<Retained<AnyObject>> {
    let class = AnyClass::get(c"LAContext")?;
    unsafe {
        let context: Option<Retained<AnyObject>> = msg_send![class, new];
        let context = context?;
        let reason = NSString::from_str(reason);
        let _: () = msg_send![&*context, setLocalizedReason: &*reason];
        Some(context)
    }
}

/// An Objective-C object handed to the signing thread.
struct Shared(Retained<AnyObject>);

// SAFETY: LAContext may be evaluated and invalidated from any thread.
unsafe impl Send for Shared {}

/// Sign `message` with the key behind `token`, after Touch ID or the login
/// password through `context`.
fn sign(token: &[u8], context: &AnyObject, message: &[u8]) -> Result<Vec<u8>, Failure> {
    autoreleasepool(|_| unsafe {
        let token = NSData::with_bytes(token);
        let toid = NSString::from_str("toid");
        let attributes = dictionary(&[
            (kSecAttrKeyType, &*kSecAttrKeyTypeECSECPrimeRandom),
            (kSecAttrKeyClass, &*kSecAttrKeyClassPrivate),
            (kSecAttrTokenID, &*kSecAttrTokenIDSecureEnclave),
            (Retained::as_ptr(&toid) as *const AnyObject, &token),
            (kSecUseAuthenticationContext, context),
        ]);
        let empty = NSData::new();
        let mut error: *mut AnyObject = std::ptr::null_mut();
        let key = SecKeyCreateWithData(
            Retained::as_ptr(&empty) as *const AnyObject,
            Retained::as_ptr(&attributes),
            &mut error,
        );
        let key = created(key, error, "key rebuild").ok_or(Failure::NotAllowed)?;
        let message = NSData::with_bytes(message);
        let mut error: *mut AnyObject = std::ptr::null_mut();
        let signature = SecKeyCreateSignature(
            Retained::as_ptr(&key),
            kSecKeyAlgorithmECDSASignatureMessageX962SHA256,
            Retained::as_ptr(&message) as *const AnyObject,
            &mut error,
        );
        // A cancelled prompt lands here too: the page gets NotAllowedError, as in a browser.
        let signature = created(signature, error, "signature").ok_or(Failure::NotAllowed)?;
        Ok(data_bytes(&signature))
    })
}

fn random_id() -> Option<Vec<u8>> {
    let mut id = vec![0u8; 16];
    let status = unsafe { SecRandomCopyBytes(kSecRandomDefault, id.len(), id.as_mut_ptr()) };
    (status == 0).then_some(id)
}

/// A new passkey: its credential id, its public key as `04 || x || y` and its enclave token.
struct Made {
    id: Vec<u8>,
    point: Vec<u8>,
    token: Vec<u8>,
}

/// A new passkey, once the user approved it through `context`.
fn make_passkey(context: &AnyObject, client_data: &[u8]) -> Result<Made, Failure> {
    let (point, token) = autoreleasepool(|_| {
        let key = new_key(true)?;
        Some((public_point(&key)?, key_token(&key)?))
    })
    .ok_or(Failure::NotAllowed)?;
    // Making the key asks nothing; signing once with it asks for Touch ID, so
    // the passkey exists only if the user agreed, and the site's UV flag is true.
    sign(&token, context, client_data)?;
    let id = random_id().ok_or(Failure::NotAllowed)?;
    Ok(Made { id, point, token })
}

/// The store, or `Err` when a file is there but cannot be read: the file is
/// the only copy of every passkey's token, so nothing may be saved over it then.
fn load(path: &Path) -> Result<Store, ()> {
    match std::fs::read_to_string(path) {
        Ok(text) => Store::parse(&text).ok_or_else(|| {
            eprintln!("[Pake] The passkey store could not be parsed");
        }),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(Store::default()),
        Err(error) => {
            eprintln!("[Pake] The passkey store could not be read: {error}");
            Err(())
        }
    }
}

fn save(path: &Path, store: &Store) -> std::io::Result<()> {
    use std::io::Write;
    use std::os::unix::fs::OpenOptionsExt;
    if let Some(directory) = path.parent() {
        std::fs::create_dir_all(directory)?;
    }
    let temporary = path.with_extension("json.tmp");
    let mut file = std::fs::OpenOptions::new()
        .write(true)
        .create(true)
        .truncate(true)
        .mode(0o600)
        .open(&temporary)?;
    file.write_all(store.to_json().as_bytes())?;
    file.sync_all()?;
    std::fs::rename(&temporary, path)?;
    // The rename itself is in the folder, so a power loss right after a site
    // learned the key does not bring the old file back. Best effort: not every
    // volume flushes a folder.
    if let Some(directory) = path.parent() {
        let _ = std::fs::File::open(directory).and_then(|folder| folder.sync_all());
    }
    Ok(())
}

fn now() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|elapsed| elapsed.as_secs())
        .unwrap_or_default()
}

/// The ceremony in progress, so a cancel from the page can end it: the id the
/// page sent it under and its webview (ids restart in every page, so a cancel
/// counts only from the same webview), the Touch ID context while one is up,
/// and the sheet while one is shown.
struct Ceremony {
    id: u64,
    webview: usize,
    token: u64,
    context: Option<Retained<AnyObject>>,
    sheet: Option<(Retained<NSAlert>, Retained<AnyObject>)>,
}

thread_local! {
    static CURRENT: RefCell<Option<Ceremony>> = const { RefCell::new(None) };
}

/// Update the running ceremony, only if it is still the one holding `token`.
fn with_current(token: u64, update: impl FnOnce(&mut Ceremony)) {
    CURRENT.with(|current| {
        if let Some(ceremony) = current.borrow_mut().as_mut().filter(|c| c.token == token) {
            update(ceremony);
        }
    });
}

/// Whether `token` still names the running ceremony, which a cancel ends.
fn is_current(token: u64) -> bool {
    CURRENT.with(|current| {
        current
            .borrow()
            .as_ref()
            .is_some_and(|ceremony| ceremony.token == token)
    })
}

/// End the running ceremony if `matches` says so, and free it at once. The
/// handles are taken out first: ending a sheet runs its completion, which
/// replies and clears `CURRENT`.
fn cancel(matches: impl FnOnce(&Ceremony) -> bool) {
    let Some(ceremony) = CURRENT.with(|current| {
        let mut current = current.borrow_mut();
        if current.as_ref().is_some_and(matches) {
            current.take()
        } else {
            None
        }
    }) else {
        return;
    };
    let _ = OWNER.compare_exchange(ceremony.token, 0, Ordering::SeqCst, Ordering::SeqCst);
    let (context, sheet) = (ceremony.context, ceremony.sheet);
    if let Some(context) = context {
        let _: () = unsafe { msg_send![&*context, invalidate] };
    }
    if let Some((alert, window)) = sheet {
        let sheet_window = alert.window();
        let _: () = unsafe {
            msg_send![&*window, endSheet: &*sheet_window, returnCode: NSAlertSecondButtonReturn]
        };
    }
}

/// WebKit's reply handler, answered at most once on the main thread. `token`
/// is the ceremony this request runs, 0 for one that runs none, and only that
/// ceremony is freed when it answers. A reply dropped unanswered (a panic in
/// the worker) still frees it; WebKit then rejects the page's promise itself.
/// A sheet keeps its reply alive, so one left on a window that is gone is
/// reclaimed by the next request instead (`receive`).
struct Reply {
    block: Option<RcBlock<dyn Fn(*mut AnyObject, *mut NSString)>>,
    token: u64,
}

// SAFETY: the block is only called on the main thread: `off_main` hands it back there.
unsafe impl Send for Reply {}

impl Reply {
    fn release(&mut self) {
        let token = std::mem::take(&mut self.token);
        if token == 0 {
            return;
        }
        let _ = OWNER.compare_exchange(token, 0, Ordering::SeqCst, Ordering::SeqCst);
        if MainThreadMarker::new().is_some() {
            CURRENT.with(|current| {
                let mut current = current.borrow_mut();
                if current
                    .as_ref()
                    .is_some_and(|ceremony| ceremony.token == token)
                {
                    *current = None;
                }
            });
        }
    }

    fn send(mut self, text: String) {
        self.release();
        if let Some(block) = self.block.take() {
            let text = NSString::from_str(&text);
            block.call((
                Retained::as_ptr(&text) as *mut AnyObject,
                std::ptr::null_mut(),
            ));
        }
    }

    fn fail(self, failure: Failure) {
        self.send(failure_reply(failure, ""));
    }
}

impl Drop for Reply {
    fn drop(&mut self) {
        self.release();
    }
}

/// Run `work` off the main thread and give its result to `then` back on it; a
/// panic in `work` arrives as a refusal, so the page is still answered.
fn off_main<T: Send + 'static>(
    work: impl FnOnce() -> Result<T, Failure> + Send + 'static,
    then: impl FnOnce(Result<T, Failure>) + Send + 'static,
) {
    std::thread::spawn(move || {
        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(work))
            .unwrap_or(Err(Failure::NotAllowed));
        dispatch::Queue::main().exec_async(move || then(result));
    });
}

/// A sheet on `window`, or an app-modal panel when there is none; `done` gets
/// whether the first button was pressed. A sheet is recorded so a cancel can end it.
fn present(
    token: u64,
    alert: Retained<NSAlert>,
    window: Option<Retained<AnyObject>>,
    done: Box<dyn FnOnce(bool)>,
) {
    let done = Cell::new(Some(done));
    let shown = alert.clone();
    let answer = RcBlock::new(move |response: isize| {
        let _ = &shown;
        with_current(token, |ceremony| ceremony.sheet = None);
        if let Some(done) = done.take() {
            done(response == NSAlertFirstButtonReturn);
        }
    });
    match window {
        Some(window) => unsafe {
            with_current(token, |ceremony| {
                ceremony.sheet = Some((alert.clone(), window.clone()))
            });
            let _: () =
                msg_send![&*alert, beginSheetModalForWindow: &*window, completionHandler: &*answer];
        },
        None => {
            let response = alert.runModal();
            answer.call((response,));
        }
    }
}

/// A notice with one button; the page gets `failure` once it is dismissed.
fn notice(
    mtm: MainThreadMarker,
    window: Option<Retained<AnyObject>>,
    title: &str,
    line: Option<&str>,
    button: &str,
    reply: Reply,
    failure: Failure,
) {
    let alert = NSAlert::new(mtm);
    alert.setMessageText(&NSString::from_str(title));
    if let Some(line) = line {
        alert.setInformativeText(&NSString::from_str(line));
    }
    alert.addButtonWithTitle(&NSString::from_str(button));
    present(
        reply.token,
        alert,
        window,
        Box::new(move |_| reply.fail(failure)),
    );
}

/// A saved day and time in the user's own format, for telling two accounts apart.
fn saved_at(created: u64) -> String {
    unsafe {
        let formatter: Retained<AnyObject> = msg_send![class!(NSDateFormatter), new];
        let _: () = msg_send![&*formatter, setDateStyle: 2usize];
        let _: () = msg_send![&*formatter, setTimeStyle: 1usize];
        let date: Retained<AnyObject> =
            msg_send![class!(NSDate), dateWithTimeIntervalSince1970: created as f64];
        let text: Retained<NSString> = msg_send![&*formatter, stringFromDate: &*date];
        text.to_string()
    }
}

fn pick(
    token: u64,
    mtm: MainThreadMarker,
    window: Option<Retained<AnyObject>>,
    rp_id: &str,
    candidates: &[super::Passkey],
    done: Box<dyn FnOnce(Option<usize>)>,
) {
    let (title, accept, cancel) = picker_text(rp_id, UiLanguage::system());
    let alert = NSAlert::new(mtm);
    alert.setMessageText(&NSString::from_str(&title));
    let popup: Retained<AnyObject> = unsafe {
        let allocated: Allocated<AnyObject> = msg_send![class!(NSPopUpButton), alloc];
        let frame = NSRect::new(
            NSPoint::new(0.0, 0.0),
            NSSize::new(PICKER_WIDTH, PICKER_HEIGHT),
        );
        msg_send![allocated, initWithFrame: frame, pullsDown: Bool::NO]
    };
    // Through the menu, which keeps items that read the same (the button's own
    // `addItemWithTitle:` drops them), each tagged with its candidate's index.
    let menu: Retained<AnyObject> = unsafe { msg_send![&*popup, menu] };
    let empty = NSString::new();
    for (index, label) in picker_labels(candidates, saved_at).iter().enumerate() {
        let label = NSString::from_str(label);
        unsafe {
            let item: Retained<AnyObject> = msg_send![
                &*menu,
                addItemWithTitle: &*label,
                action: None::<Sel>,
                keyEquivalent: &*empty
            ];
            let _: () = msg_send![&*item, setTag: index as isize];
        }
    }
    let _: () = unsafe { msg_send![&*popup, selectItemAtIndex: 0isize] };
    let _: () = unsafe { msg_send![&*alert, setAccessoryView: &*popup] };
    alert.addButtonWithTitle(&NSString::from_str(accept));
    let cancel = alert.addButtonWithTitle(&NSString::from_str(cancel));
    // AppKit gives Escape only to a button titled Cancel, which a translated title is not.
    cancel.setKeyEquivalent(&NSString::from_str("\u{1b}"));
    let chosen = popup.clone();
    let count = candidates.len();
    present(
        token,
        alert,
        window,
        Box::new(move |accepted| {
            let item: Option<Retained<AnyObject>> = unsafe { msg_send![&*chosen, selectedItem] };
            let index = item.map(|item| {
                let tag: isize = unsafe { msg_send![&*item, tag] };
                tag
            });
            let index = index
                .filter(|_| accepted)
                .and_then(|tag| usize::try_from(tag).ok())
                .filter(|&index| index < count);
            done(index);
        }),
    );
}

fn create(
    mtm: MainThreadMarker,
    window: Option<Retained<AnyObject>>,
    store_path: PathBuf,
    origin: Origin,
    options: super::CreateOptions,
    reply: Reply,
) {
    let Ok(store) = load(&store_path) else {
        return reply.fail(Failure::NotAllowed);
    };
    let asked = options.rp_id().map(str::to_owned);
    let plan = match plan_create(&origin, options, &store) {
        Ok(plan) => plan,
        Err(Failure::InvalidState) => {
            // The spec has the user agree before the site learns this, so a
            // page cannot probe which passkeys the app holds without a click.
            let rp_id = resolve_rp_id(&origin, asked.as_deref()).unwrap_or_default();
            let (title, button) = existing_text(&rp_id, UiLanguage::system());
            return notice(
                mtm,
                window,
                &title,
                None,
                button,
                reply,
                Failure::InvalidState,
            );
        }
        Err(failure) => return reply.fail(failure),
    };
    let reason = prompt_reason(true, &plan.rp_id, UiLanguage::system());
    let Some(context) = new_context(&reason) else {
        return reply.fail(Failure::NotAllowed);
    };
    with_current(reply.token, |ceremony| {
        ceremony.context = Some(context.clone())
    });
    let context = Shared(context);
    let client_data = plan.client_data.clone();
    off_main(
        move || {
            let context = context;
            make_passkey(&context.0, &client_data)
        },
        move |made| {
            let made = match made {
                Ok(made) => made,
                Err(failure) => return reply.fail(failure),
            };
            // Touch ID can pass just as the page gives up; the site then never
            // learns this key, so it is not kept to be offered later.
            if !is_current(reply.token) {
                return reply.fail(Failure::NotAllowed);
            }
            let Some((passkey, answer)) =
                finish_create(&plan, &made.id, &made.point, &made.token, now())
            else {
                return reply.fail(Failure::NotAllowed);
            };
            let Ok(mut store) = load(&store_path) else {
                return reply.fail(Failure::NotAllowed);
            };
            store.upsert(passkey);
            match save(&store_path, &store) {
                Ok(()) => reply.send(answer),
                Err(error) => {
                    eprintln!("[Pake] Failed to save a passkey: {error}");
                    reply.fail(Failure::NotAllowed);
                }
            }
        },
    );
}

fn sign_in(plan: super::GetPlan, index: usize, reply: Reply) {
    let passkey = plan.candidates[index].clone();
    let Some(token) = passkey.key_token() else {
        return reply.fail(Failure::NotAllowed);
    };
    let reason = prompt_reason(false, &plan.rp_id, UiLanguage::system());
    let Some(context) = new_context(&reason) else {
        return reply.fail(Failure::NotAllowed);
    };
    with_current(reply.token, |ceremony| {
        ceremony.context = Some(context.clone())
    });
    let context = Shared(context);
    let message = assertion_message(&plan);
    off_main(
        move || {
            let context = context;
            sign(&token, &context.0, &message)
        },
        move |signed| match signed {
            Ok(signature) => reply.send(finish_get(&plan, &passkey, &signature)),
            Err(failure) => reply.fail(failure),
        },
    );
}

fn get(
    mtm: MainThreadMarker,
    window: Option<Retained<AnyObject>>,
    store_path: PathBuf,
    origin: Origin,
    options: super::GetOptions,
    reply: Reply,
) {
    // An unreadable store is left as it is (load logged it): saying there is
    // no passkey would send the user to add one, which create then refuses.
    let Ok(store) = load(&store_path) else {
        return reply.fail(Failure::NotAllowed);
    };
    let plan = match plan_get(&origin, options, &store) {
        Ok(plan) => plan,
        Err(failure) => return reply.fail(failure),
    };
    match plan.candidates.len() {
        0 => {
            let (title, line, button) = missing_text(&plan.rp_id, UiLanguage::system());
            notice(
                mtm,
                window,
                &title,
                Some(line),
                button,
                reply,
                Failure::NotAllowed,
            );
        }
        1 => sign_in(plan, 0, reply),
        _ => {
            let rp_id = plan.rp_id.clone();
            let candidates = plan.candidates.clone();
            pick(
                reply.token,
                mtm,
                window,
                &rp_id,
                &candidates,
                Box::new(move |choice| match choice {
                    Some(index) => sign_in(plan, index, reply),
                    None => reply.fail(Failure::NotAllowed),
                }),
            );
        }
    }
}

/// The calling frame's origin, only for a main frame.
fn main_frame_origin(message: &WKScriptMessage) -> Option<Origin> {
    unsafe {
        let frame = message.frameInfo();
        if !frame.isMainFrame() {
            return None;
        }
        let origin = frame.securityOrigin();
        let port = origin.port();
        Some(Origin {
            scheme: origin.protocol().to_string().to_ascii_lowercase(),
            host: origin.host().to_string(),
            port: u16::try_from(port).unwrap_or(0),
        })
    }
}

fn receive(
    mtm: MainThreadMarker,
    store_path: PathBuf,
    message: &WKScriptMessage,
    mut reply: Reply,
) {
    let body = unsafe { message.body() };
    let Some(Envelope { id, request }) = body
        .downcast_ref::<NSString>()
        .and_then(|text| serde_json::from_str::<Envelope>(&text.to_string()).ok())
    else {
        return reply.fail(Failure::Type);
    };
    let Some(origin) = main_frame_origin(message) else {
        return reply.fail(Failure::NotAllowed);
    };
    let webview: *mut AnyObject = unsafe { msg_send![message, webView] };
    let webview = webview as usize;
    match request {
        Request::Available => {
            let available = available();
            return reply.send(serde_json::json!({ "available": available }).to_string());
        }
        Request::Cancel => {
            cancel(|ceremony| ceremony.id == id && ceremony.webview == webview);
            return reply.send("{}".to_owned());
        }
        Request::Create { .. } | Request::Get { .. } => {}
    }
    // A Mac without an enclave makes no passkeys, so it offers none and
    // tells nobody to add one: the page goes on to its other sign-in.
    if !available() {
        return reply.fail(Failure::NotAllowed);
    }
    let window: Option<Retained<AnyObject>> = unsafe {
        let webview = webview as *mut AnyObject;
        if webview.is_null() {
            None
        } else {
            let window: *mut AnyObject = msg_send![webview, window];
            Retained::retain(window)
        }
    };
    // Only the page in front may ask, as in a browser: a hidden window or one
    // behind another app would raise Touch ID, or pull itself on screen with a
    // sheet, for a sign-in the user never started.
    let app = NSApplication::sharedApplication(mtm);
    let active: Bool = unsafe { msg_send![&*app, isActive] };
    let in_front = window.as_ref().is_some_and(|window| {
        let key: Bool = unsafe { msg_send![&**window, isKeyWindow] };
        key.as_bool()
    });
    if !active.as_bool() || !in_front {
        return reply.fail(Failure::NotAllowed);
    }
    // A sheet on a window that was closed (with its popup, or hidden by the
    // close button) would hold every later request as busy, so it gives way.
    // A minimized window, or any while the app is hidden, still has its sheet.
    let app_hidden: Bool = unsafe { msg_send![&*app, isHidden] };
    if !app_hidden.as_bool() {
        cancel(|ceremony| {
            ceremony.sheet.as_ref().is_some_and(|(_, window)| {
                let visible: Bool = unsafe { msg_send![&**window, isVisible] };
                let minimized: Bool = unsafe { msg_send![&**window, isMiniaturized] };
                !visible.as_bool() && !minimized.as_bool()
            })
        });
    }
    let token = NEXT_TOKEN.fetch_add(1, Ordering::SeqCst);
    if OWNER
        .compare_exchange(0, token, Ordering::SeqCst, Ordering::SeqCst)
        .is_err()
    {
        return reply.fail(Failure::NotAllowed);
    }
    reply.token = token;
    CURRENT.with(|current| {
        *current.borrow_mut() = Some(Ceremony {
            id,
            webview,
            token,
            context: None,
            sheet: None,
        })
    });
    match request {
        Request::Create { options } => create(mtm, window, store_path, origin, options, reply),
        Request::Get { options } => get(mtm, window, store_path, origin, options, reply),
        Request::Available | Request::Cancel => {}
    }
}

struct HandlerIvars {
    store: PathBuf,
}

define_class!(
    // SAFETY: NSObject has no subclassing requirements and the handler has no Drop.
    #[unsafe(super(NSObject))]
    #[thread_kind = MainThreadOnly]
    #[name = "PakePasskeyHandler"]
    #[ivars = HandlerIvars]
    struct PasskeyHandler;

    unsafe impl NSObjectProtocol for PasskeyHandler {}

    unsafe impl WKScriptMessageHandlerWithReply for PasskeyHandler {
        #[unsafe(method(userContentController:didReceiveScriptMessage:replyHandler:))]
        fn did_receive(
            &self,
            _controller: &WKUserContentController,
            message: &WKScriptMessage,
            reply: &DynBlock<dyn Fn(*mut AnyObject, *mut NSString)>,
        ) {
            let Some(reply) =
                (unsafe { RcBlock::copy(reply as *const DynBlock<_> as *mut DynBlock<_>) })
            else {
                return;
            };
            let reply = Reply {
                block: Some(reply),
                token: 0,
            };
            receive(self.mtm(), self.ivars().store.clone(), message, reply);
        }
    }
);

impl PasskeyHandler {
    fn new(mtm: MainThreadMarker, store: PathBuf) -> Retained<Self> {
        let this = mtm
            .alloc::<PasskeyHandler>()
            .set_ivars(HandlerIvars { store });
        unsafe { msg_send![super(this), init] }
    }
}

/// Answer `passkey.js` in this webview, keeping the passkeys at `store`.
/// A popup may share its opener's content controller, so a handler already
/// there is replaced rather than added twice, which WebKit refuses with an exception.
pub fn install(webview: &tauri::webview::PlatformWebview, store: PathBuf) {
    let Some(mtm) = MainThreadMarker::new() else {
        return;
    };
    let view = webview.inner() as *mut AnyObject;
    if view.is_null() {
        return;
    }
    // SAFETY: Tauri runs this on the main thread with the live WKWebView.
    unsafe {
        let configuration: *mut AnyObject = msg_send![view, configuration];
        let controller: *mut AnyObject = msg_send![configuration, userContentController];
        if controller.is_null() {
            return;
        }
        let add: Sel = sel!(addScriptMessageHandlerWithReply:contentWorld:name:);
        let responds: bool = msg_send![controller, respondsToSelector: add];
        let Some(world_class) = AnyClass::get(c"WKContentWorld") else {
            return;
        };
        if !responds {
            return;
        }
        let world: *mut AnyObject = msg_send![world_class, pageWorld];
        let name = NSString::from_str(HANDLER_NAME);
        let _: () =
            msg_send![controller, removeScriptMessageHandlerForName: &*name, contentWorld: world];
        let handler = PasskeyHandler::new(mtm, store);
        let _: () = msg_send![
            controller,
            addScriptMessageHandlerWithReply: &*handler,
            contentWorld: world,
            name: &*name
        ];
    }
}
