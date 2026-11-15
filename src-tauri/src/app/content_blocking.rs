//! Blocks ads, trackers and cookie notices with filter lists built into the
//! runtime (the `content-blocking` feature, which `runtime-template` turns on).
//!
//! `content_blocking` in pake.json names the groups; none means off. macOS and
//! Linux hand WebKit content rule lists converted from the filters, Windows
//! matches each WebView2 request in process. Blocking fails open: an app whose
//! lists cannot load runs unblocked and logs one line.

use adblock::lists::{FilterSet, ParseOptions, RuleTypes};
use std::io::Read;

macro_rules! filter_list {
    ($name:literal) => {
        include_bytes!(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../filters/",
            $name,
            ".txt.gz"
        ))
    };
}

/// The groups pake.json may name, in the order they are applied. The sources
/// and licences of each list are in `filters/sources.json`.
const GROUPS: [(&str, &[u8]); 4] = [
    ("ads", filter_list!("ads")),
    ("trackers", filter_list!("trackers")),
    ("cookies", filter_list!("cookies")),
    ("china", filter_list!("china")),
];

/// Fixes for sites the other lists break, added to every selection.
const UNBREAK: &[u8] = filter_list!("unbreak");

/// The known groups among `names`, in `GROUPS` order and without duplicates.
pub fn selected_groups(names: &[String]) -> Vec<&'static str> {
    GROUPS
        .iter()
        .map(|(group, _)| *group)
        .filter(|group| names.iter().any(|name| name.trim() == *group))
        .collect()
}

fn list_bytes(groups: &[&str]) -> Vec<&'static [u8]> {
    GROUPS
        .iter()
        .filter(|(group, _)| groups.contains(group))
        .map(|(_, bytes)| *bytes)
        .chain(std::iter::once(UNBREAK))
        .collect()
}

fn gunzip(bytes: &[u8]) -> Option<String> {
    let mut text = String::new();
    flate2::read::GzDecoder::new(bytes)
        .read_to_string(&mut text)
        .ok()?;
    Some(text)
}

fn filter_set(groups: &[&str], rule_types: RuleTypes, debug: bool) -> FilterSet {
    let mut set = FilterSet::new(debug);
    for bytes in list_bytes(groups) {
        match gunzip(bytes) {
            Some(text) => {
                set.add_filter_list(
                    text,
                    ParseOptions {
                        rule_types,
                        ..ParseOptions::default()
                    },
                );
            }
            None => eprintln!("[Pake] A built-in filter list could not be read"),
        }
    }
    set
}

/// FNV-1a, enough to tell one selection of embedded lists from another.
#[cfg(any(target_os = "macos", target_os = "linux", test))]
fn fingerprint(groups: &[&str]) -> u64 {
    let mut hash: u64 = 0xcbf2_9ce4_8422_2325;
    let mut feed = |bytes: &[u8]| {
        for byte in bytes {
            hash ^= u64::from(*byte);
            hash = hash.wrapping_mul(0x0000_0100_0000_01b3);
        }
    };
    feed(env!("CARGO_PKG_VERSION").as_bytes());
    for group in groups {
        feed(group.as_bytes());
    }
    for bytes in list_bytes(groups) {
        feed(bytes);
    }
    hash
}

/// WebKit compiles at most this many rules into one content rule list.
#[cfg(any(target_os = "macos", target_os = "linux", test))]
pub const WEBKIT_MAX_RULES: usize = 150_000;

/// Each selection becomes two WebKit lists: requests to block with their
/// exceptions, and elements to hide. `ignore-previous-rules` only reaches rules
/// of its own list, so every list carries its own exceptions.
#[cfg(any(target_os = "macos", target_os = "linux", test))]
const WEBKIT_UNITS: [(&str, RuleTypes); 2] = [
    ("network", RuleTypes::NetworkOnly),
    ("cosmetic", RuleTypes::CosmeticOnly),
];

/// Identifiers start with this, so lists from older selections can be removed.
#[cfg(any(target_os = "macos", target_os = "linux", test))]
const IDENTIFIER_PREFIX: &str = "pake-blocking-";

#[cfg(any(target_os = "macos", target_os = "linux", test))]
fn webkit_identifier(groups: &[&str], unit: &str) -> String {
    format!("{IDENTIFIER_PREFIX}{unit}-{:016x}", fingerprint(groups))
}

/// The rules of one WebKit unit, ready to serialize.
#[cfg(any(target_os = "macos", target_os = "linux", test))]
fn webkit_rules(groups: &[&str], rule_types: RuleTypes) -> Vec<adblock::content_blocking::CbRule> {
    filter_set(groups, rule_types, true)
        .into_content_blocking()
        .map(|(rules, _)| rules)
        .unwrap_or_default()
}

/// The JSON of one WebKit unit, or `None` when it has no rules or is too large.
#[cfg(any(target_os = "macos", target_os = "linux"))]
fn webkit_json(groups: &[&str], unit: &str) -> Option<String> {
    let rule_types = WEBKIT_UNITS
        .iter()
        .find(|(name, _)| *name == unit)
        .map(|(_, types)| *types)?;
    let rules = webkit_rules(groups, rule_types);
    if rules.is_empty() || rules.len() > WEBKIT_MAX_RULES {
        eprintln!(
            "[Pake] Content blocking skipped the {unit} list: {} rules",
            rules.len()
        );
        return None;
    }
    serde_json::to_string(&rules).ok()
}

/// Shared by macOS and Linux: look up compiled lists by identifier, convert and
/// compile the ones missing, then add them to every webview's content manager.
/// Everything here runs on the main thread except the conversion.
#[cfg(any(target_os = "macos", target_os = "linux"))]
mod loader {
    use super::platform::{add, compile, lookup, remove_stale, to_main, List, Target};
    use super::{webkit_identifier, webkit_json, WEBKIT_UNITS};
    use std::cell::RefCell;
    use std::time::Duration;

    /// How long the first page waits for the lists before it loads unblocked.
    const READY_TIMEOUT: Duration = Duration::from_secs(10);

    type Callback = Box<dyn FnOnce()>;

    #[derive(Default)]
    struct State {
        started: bool,
        ready: Option<Vec<List>>,
        found: Vec<Option<List>>,
        pending: usize,
        waiting: Vec<Target>,
        callbacks: Vec<Callback>,
    }

    thread_local! {
        static STATE: RefCell<State> = RefCell::new(State::default());
    }

    /// Adds the lists to `target` now, or once they load.
    pub fn attach(target: Target, groups: Vec<&'static str>) {
        let first = STATE.with_borrow_mut(|state| {
            if let Some(lists) = &state.ready {
                for list in lists {
                    add(&target, list);
                }
                return false;
            }
            state.waiting.push(target);
            !std::mem::replace(&mut state.started, true)
        });
        if first {
            load(groups);
        }
    }

    /// Runs `callback` once the lists are in place, or after `READY_TIMEOUT`
    /// when loading takes longer, so a first page never waits for good.
    pub fn when_ready(callback: Callback) {
        let ready = STATE.with_borrow_mut(|state| {
            if state.ready.is_some() {
                return Some(callback);
            }
            state.callbacks.push(callback);
            None
        });
        if let Some(callback) = ready {
            callback();
            return;
        }
        std::thread::spawn(|| {
            std::thread::sleep(READY_TIMEOUT);
            to_main(Box::new(|| {
                let late = STATE.with_borrow_mut(|state| std::mem::take(&mut state.callbacks));
                if !late.is_empty() {
                    eprintln!(
                        "[Pake] Content blocking is still loading; opening the page without it"
                    );
                }
                late.into_iter().for_each(|callback| callback());
            }));
        });
    }

    fn load(groups: Vec<&'static str>) {
        let ids: Vec<String> = WEBKIT_UNITS
            .iter()
            .map(|(unit, _)| webkit_identifier(&groups, unit))
            .collect();
        STATE.with_borrow_mut(|state| {
            state.found = ids.iter().map(|_| None).collect();
            state.pending = ids.len();
        });
        for (index, id) in ids.iter().enumerate() {
            let groups = groups.clone();
            let ids = ids.clone();
            lookup(
                id,
                Box::new(move |list| {
                    let done = STATE.with_borrow_mut(|state| {
                        state.found[index] = list;
                        state.pending -= 1;
                        state.pending == 0
                    });
                    if done {
                        compile_missing(groups, ids);
                    }
                }),
            );
        }
    }

    fn compile_missing(groups: Vec<&'static str>, ids: Vec<String>) {
        let missing: Vec<usize> = STATE.with_borrow(|state| {
            (0..state.found.len())
                .filter(|index| state.found[*index].is_none())
                .collect()
        });
        if missing.is_empty() {
            finish(ids);
            return;
        }
        // Converting the lists takes a few hundred milliseconds; keep it off the main thread.
        std::thread::spawn(move || {
            let jsons: Vec<(usize, Option<String>)> = missing
                .into_iter()
                .map(|index| (index, webkit_json(&groups, WEBKIT_UNITS[index].0)))
                .collect();
            to_main(Box::new(move || {
                let compiling: Vec<(usize, String)> = jsons
                    .into_iter()
                    .filter_map(|(index, json)| json.map(|json| (index, json)))
                    .collect();
                if compiling.is_empty() {
                    finish(ids);
                    return;
                }
                STATE.with_borrow_mut(|state| state.pending = compiling.len());
                for (index, json) in compiling {
                    let ids_after = ids.clone();
                    compile(
                        &ids[index],
                        json,
                        Box::new(move |list| {
                            let done = STATE.with_borrow_mut(|state| {
                                state.found[index] = list;
                                state.pending -= 1;
                                state.pending == 0
                            });
                            if done {
                                finish(ids_after);
                            }
                        }),
                    );
                }
            }));
        });
    }

    fn finish(ids: Vec<String>) {
        let callbacks = STATE.with_borrow_mut(|state| {
            let lists: Vec<List> = state.found.drain(..).flatten().collect();
            for target in state.waiting.drain(..) {
                for list in &lists {
                    add(&target, list);
                }
            }
            state.ready = Some(lists);
            std::mem::take(&mut state.callbacks)
        });
        callbacks.into_iter().for_each(|callback| callback());
        remove_stale(ids);
    }
}

#[cfg(target_os = "macos")]
mod platform {
    use super::IDENTIFIER_PREFIX;
    use block2::RcBlock;
    use objc2::rc::Retained;
    use objc2::MainThreadMarker;
    use objc2_foundation::{NSArray, NSError, NSString};
    use objc2_web_kit::{WKContentRuleList, WKContentRuleListStore, WKUserContentController};
    use std::cell::Cell;

    pub type Target = Retained<WKUserContentController>;
    pub type List = Retained<WKContentRuleList>;
    type Done = Box<dyn FnOnce(Option<List>)>;

    fn store() -> Option<Retained<WKContentRuleListStore>> {
        let mtm = MainThreadMarker::new()?;
        unsafe { WKContentRuleListStore::defaultStore(mtm) }
    }

    fn completion(
        id: String,
        report: bool,
        done: Done,
    ) -> RcBlock<dyn Fn(*mut WKContentRuleList, *mut NSError)> {
        let done = Cell::new(Some(done));
        RcBlock::new(move |list: *mut WKContentRuleList, error: *mut NSError| {
            let list = unsafe { Retained::retain(list) };
            if report && list.is_none() {
                let reason = unsafe { error.as_ref() }
                    .map(|error| error.localizedDescription().to_string())
                    .unwrap_or_default();
                eprintln!("[Pake] Content blocking could not compile {id}: {reason}");
            }
            if let Some(done) = done.take() {
                done(list);
            }
        })
    }

    pub fn lookup(id: &str, done: Done) {
        let Some(store) = store() else {
            return done(None);
        };
        let block = completion(id.to_owned(), false, done);
        unsafe {
            store.lookUpContentRuleListForIdentifier_completionHandler(
                Some(&NSString::from_str(id)),
                Some(&block),
            );
        }
    }

    pub fn compile(id: &str, json: String, done: Done) {
        let Some(store) = store() else {
            return done(None);
        };
        let block = completion(id.to_owned(), true, done);
        unsafe {
            store.compileContentRuleListForIdentifier_encodedContentRuleList_completionHandler(
                Some(&NSString::from_str(id)),
                Some(&NSString::from_str(&json)),
                Some(&block),
            );
        }
    }

    pub fn add(target: &Target, list: &List) {
        unsafe { target.addContentRuleList(list) };
    }

    pub fn to_main(task: Box<dyn FnOnce() + Send>) {
        dispatch::Queue::main().exec_async(task);
    }

    /// Compiled lists from an earlier selection or Pake version take tens of MB.
    pub fn remove_stale(keep: Vec<String>) {
        let Some(store) = store() else { return };
        let remover = store.clone();
        let block = RcBlock::new(move |ids: *mut NSArray<NSString>| {
            let Some(ids) = (unsafe { ids.as_ref() }) else {
                return;
            };
            for id in ids.iter() {
                let name = id.to_string();
                if name.starts_with(IDENTIFIER_PREFIX) && !keep.contains(&name) {
                    let ignore = RcBlock::new(|_: *mut NSError| {});
                    unsafe {
                        remover.removeContentRuleListForIdentifier_completionHandler(
                            Some(&id),
                            Some(&ignore),
                        );
                    }
                }
            }
        });
        unsafe { store.getAvailableContentRuleListIdentifiers(Some(&block)) };
    }

    /// The content controller of a webview, which every list is added to.
    pub fn target(webview: &tauri::webview::PlatformWebview) -> Option<Target> {
        use objc2::msg_send;
        use objc2::runtime::AnyObject;
        use objc2_web_kit::WKWebViewConfiguration;

        let view = webview.inner() as *mut AnyObject;
        if view.is_null() {
            return None;
        }
        let configuration: Option<Retained<WKWebViewConfiguration>> =
            unsafe { msg_send![view, configuration] };
        configuration.map(|configuration| unsafe { configuration.userContentController() })
    }
}

#[cfg(target_os = "linux")]
mod platform {
    use super::IDENTIFIER_PREFIX;
    use std::cell::{Cell, OnceCell};
    use std::ffi::{c_char, CStr, CString};
    use std::path::PathBuf;
    use webkit2gtk::ffi;
    use webkit2gtk::gio::ffi as gio;
    use webkit2gtk::glib::ffi as glib;
    use webkit2gtk::glib::gobject_ffi as gobject;
    use webkit2gtk::glib::translate::ToGlibPtr;

    pub type Target = webkit2gtk::UserContentManager;
    pub struct List(*mut ffi::WebKitUserContentFilter);
    type Done = Box<dyn FnOnce(Option<List>)>;

    impl Drop for List {
        fn drop(&mut self) {
            unsafe { ffi::webkit_user_content_filter_unref(self.0) };
        }
    }

    thread_local! {
        static STORE: OnceCell<usize> = const { OnceCell::new() };
        static STORE_DIR: Cell<Option<PathBuf>> = const { Cell::new(None) };
    }

    /// Where compiled lists are kept: the app's own data folder.
    pub fn set_store_dir(dir: PathBuf) {
        STORE_DIR.set(Some(dir));
    }

    fn store() -> *mut ffi::WebKitUserContentFilterStore {
        STORE.with(|store| {
            *store.get_or_init(|| {
                let dir = STORE_DIR
                    .take()
                    .unwrap_or_else(std::env::temp_dir)
                    .join("ContentFilters");
                let path = CString::new(dir.to_string_lossy().as_bytes()).unwrap_or_default();
                unsafe { ffi::webkit_user_content_filter_store_new(path.as_ptr()) as usize }
            })
        }) as *mut ffi::WebKitUserContentFilterStore
    }

    type Finish = unsafe extern "C" fn(
        *mut ffi::WebKitUserContentFilterStore,
        *mut gio::GAsyncResult,
        *mut *mut glib::GError,
    ) -> *mut ffi::WebKitUserContentFilter;

    struct Pending {
        id: String,
        report: bool,
        finish: Finish,
        done: Done,
    }

    unsafe extern "C" fn ready(
        source: *mut gobject::GObject,
        result: *mut gio::GAsyncResult,
        data: glib::gpointer,
    ) {
        let pending = Box::from_raw(data as *mut Pending);
        let mut error: *mut glib::GError = std::ptr::null_mut();
        let filter = (pending.finish)(
            source as *mut ffi::WebKitUserContentFilterStore,
            result,
            &mut error,
        );
        if !error.is_null() {
            if pending.report {
                let message = CStr::from_ptr((*error).message).to_string_lossy();
                eprintln!(
                    "[Pake] Content blocking could not compile {}: {message}",
                    pending.id
                );
            }
            glib::g_error_free(error);
        }
        (pending.done)((!filter.is_null()).then_some(List(filter)));
    }

    fn pending(id: &str, report: bool, finish: Finish, done: Done) -> glib::gpointer {
        Box::into_raw(Box::new(Pending {
            id: id.to_owned(),
            report,
            finish,
            done,
        })) as glib::gpointer
    }

    pub fn lookup(id: &str, done: Done) {
        let Ok(name) = CString::new(id) else {
            return done(None);
        };
        unsafe {
            ffi::webkit_user_content_filter_store_load(
                store(),
                name.as_ptr(),
                std::ptr::null_mut(),
                Some(ready),
                pending(
                    id,
                    false,
                    ffi::webkit_user_content_filter_store_load_finish,
                    done,
                ),
            );
        }
    }

    pub fn compile(id: &str, json: String, done: Done) {
        let Ok(name) = CString::new(id) else {
            return done(None);
        };
        unsafe {
            let bytes = glib::g_bytes_new(json.as_ptr() as glib::gconstpointer, json.len());
            ffi::webkit_user_content_filter_store_save(
                store(),
                name.as_ptr(),
                bytes,
                std::ptr::null_mut(),
                Some(ready),
                pending(
                    id,
                    true,
                    ffi::webkit_user_content_filter_store_save_finish,
                    done,
                ),
            );
            glib::g_bytes_unref(bytes);
        }
    }

    pub fn add(target: &Target, list: &List) {
        let manager: *mut ffi::WebKitUserContentManager = target.to_glib_none().0;
        unsafe { ffi::webkit_user_content_manager_add_filter(manager, list.0) };
    }

    pub fn to_main(task: Box<dyn FnOnce() + Send>) {
        webkit2gtk::glib::MainContext::default().invoke(task);
    }

    unsafe extern "C" fn identifiers_ready(
        source: *mut gobject::GObject,
        result: *mut gio::GAsyncResult,
        data: glib::gpointer,
    ) {
        let keep = Box::from_raw(data as *mut Vec<String>);
        let store = source as *mut ffi::WebKitUserContentFilterStore;
        let ids = ffi::webkit_user_content_filter_store_fetch_identifiers_finish(store, result);
        if ids.is_null() {
            return;
        }
        let mut cursor = ids;
        while !(*cursor).is_null() {
            let name = CStr::from_ptr(*cursor).to_string_lossy().into_owned();
            if name.starts_with(IDENTIFIER_PREFIX) && !keep.contains(&name) {
                ffi::webkit_user_content_filter_store_remove(
                    store,
                    *cursor as *const c_char,
                    std::ptr::null_mut(),
                    None,
                    std::ptr::null_mut(),
                );
            }
            cursor = cursor.add(1);
        }
        glib::g_strfreev(ids);
    }

    pub fn remove_stale(keep: Vec<String>) {
        unsafe {
            ffi::webkit_user_content_filter_store_fetch_identifiers(
                store(),
                std::ptr::null_mut(),
                Some(identifiers_ready),
                Box::into_raw(Box::new(keep)) as glib::gpointer,
            );
        }
    }

    pub fn target(webview: &tauri::webview::PlatformWebview) -> Option<Target> {
        use webkit2gtk::WebViewExt;
        webview.inner().user_content_manager()
    }
}

/// Adds the selected lists to a WebKit webview, now or once they load.
#[cfg(any(target_os = "macos", target_os = "linux"))]
pub fn install(webview: &tauri::webview::PlatformWebview, groups: Vec<&'static str>) {
    match platform::target(webview) {
        Some(target) => loader::attach(target, groups),
        None => eprintln!("[Pake] Content blocking could not reach the webview"),
    }
}

#[cfg(any(target_os = "macos", target_os = "linux"))]
pub use loader::when_ready;

#[cfg(target_os = "linux")]
pub use platform::set_store_dir;

#[cfg(target_os = "windows")]
mod windows {
    use super::{filter_set, selected_groups};
    use adblock::lists::RuleTypes;
    use adblock::request::Request;
    use adblock::Engine;
    use std::collections::HashMap;
    use std::sync::{Mutex, OnceLock};
    use webview2_com::Microsoft::Web::WebView2::Win32::*;
    use webview2_com::{
        take_pwstr, AddScriptToExecuteOnDocumentCreatedCompletedHandler,
        ContentLoadingEventHandler, ExecuteScriptCompletedHandler,
        WebResourceRequestedEventHandler,
    };
    use windows_core::{Interface, HSTRING, PWSTR};

    struct Blocker {
        engine: Engine,
        /// Element hiding that applies on every site.
        generic_css: String,
    }

    // The engine is built once per selection; a process has one selection.
    static BLOCKERS: OnceLock<Mutex<HashMap<Vec<&'static str>, &'static Blocker>>> =
        OnceLock::new();

    fn blocker(groups: Vec<&'static str>) -> &'static Blocker {
        let map = BLOCKERS.get_or_init(|| Mutex::new(HashMap::new()));
        let mut map = map.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
        map.entry(groups.clone()).or_insert_with(|| {
            let engine = Engine::new_with_filter_set(filter_set(&groups, RuleTypes::All, false));
            let generic = generic_selectors(&groups);
            Box::leak(Box::new(Blocker {
                engine,
                generic_css: css(generic.iter().map(String::as_str)),
            }))
        })
    }

    /// Selectors of the hiding rules with no site condition, taken from the
    /// WebKit conversion so both platforms hide the same generic elements.
    fn generic_selectors(groups: &[&str]) -> Vec<String> {
        let Ok((rules, _)) =
            filter_set(groups, RuleTypes::CosmeticOnly, true).into_content_blocking()
        else {
            return Vec::new();
        };
        rules
            .into_iter()
            .filter(|rule| {
                rule.trigger.if_domain.is_none()
                    && rule.trigger.unless_domain.is_none()
                    && rule.trigger.url_filter == ".*"
            })
            .filter_map(|rule| rule.action.selector)
            .collect()
    }

    /// One rule per selector: a selector the browser rejects only drops its own rule.
    fn css<'a>(selectors: impl Iterator<Item = &'a str>) -> String {
        selectors
            .filter(|selector| !selector.contains(['{', '}', '<']))
            .map(|selector| format!("{selector}{{display:none!important}}"))
            .collect::<Vec<_>>()
            .join("\n")
    }

    fn style_script(css: &str) -> String {
        let css = serde_json::to_string(css).unwrap_or_else(|_| "\"\"".into());
        format!(
            "(()=>{{const s=document.createElement('style');s.setAttribute('data-pake-blocking','');s.textContent={css};(document.head||document.documentElement).appendChild(s);}})();"
        )
    }

    fn request_type(context: COREWEBVIEW2_WEB_RESOURCE_CONTEXT) -> Option<&'static str> {
        Some(match context {
            // Never block the page itself; a blocked page is a blank window.
            COREWEBVIEW2_WEB_RESOURCE_CONTEXT_DOCUMENT => return None,
            COREWEBVIEW2_WEB_RESOURCE_CONTEXT_STYLESHEET => "stylesheet",
            COREWEBVIEW2_WEB_RESOURCE_CONTEXT_IMAGE => "image",
            COREWEBVIEW2_WEB_RESOURCE_CONTEXT_MEDIA => "media",
            COREWEBVIEW2_WEB_RESOURCE_CONTEXT_FONT => "font",
            COREWEBVIEW2_WEB_RESOURCE_CONTEXT_SCRIPT => "script",
            COREWEBVIEW2_WEB_RESOURCE_CONTEXT_XML_HTTP_REQUEST
            | COREWEBVIEW2_WEB_RESOURCE_CONTEXT_FETCH
            | COREWEBVIEW2_WEB_RESOURCE_CONTEXT_EVENT_SOURCE => "xmlhttprequest",
            COREWEBVIEW2_WEB_RESOURCE_CONTEXT_WEBSOCKET => "websocket",
            COREWEBVIEW2_WEB_RESOURCE_CONTEXT_PING => "ping",
            _ => "other",
        })
    }

    /// Hosts Tauri and Wry answer themselves.
    fn is_local(url: &str) -> bool {
        url.split_once("://")
            .map(|(_, rest)| rest.split(['/', ':', '?', '#']).next().unwrap_or(""))
            .is_some_and(|host| host == "localhost" || host.ends_with(".localhost"))
    }

    /// Installs request blocking and element hiding on a WebView2. Call it
    /// before the first navigation: WebView2 only raises the event for
    /// filters added before then.
    pub fn install(webview: &tauri::webview::PlatformWebview, names: &[String]) {
        let groups = selected_groups(names);
        if groups.is_empty() {
            return;
        }
        let blocker = blocker(groups);
        let environment = webview.environment();
        let result = unsafe {
            (|| -> windows_core::Result<()> {
                let core = webview.controller().CoreWebView2()?;
                let filtered = core.cast::<ICoreWebView2_22>()?;
                for pattern in ["http://*", "https://*"] {
                    filtered.AddWebResourceRequestedFilterWithRequestSourceKinds(
                        &HSTRING::from(pattern),
                        COREWEBVIEW2_WEB_RESOURCE_CONTEXT_ALL,
                        COREWEBVIEW2_WEB_RESOURCE_REQUEST_SOURCE_KINDS_ALL,
                    )?;
                }
                let mut token = 0;
                core.add_WebResourceRequested(
                    &WebResourceRequestedEventHandler::create(Box::new(move |sender, args| {
                        let (Some(sender), Some(args)) = (sender, args) else {
                            return Ok(());
                        };
                        let mut context = COREWEBVIEW2_WEB_RESOURCE_CONTEXT_OTHER;
                        args.ResourceContext(&mut context)?;
                        let Some(kind) = request_type(context) else {
                            return Ok(());
                        };
                        let mut uri = PWSTR::null();
                        args.Request()?.Uri(&mut uri)?;
                        let url = take_pwstr(uri);
                        if is_local(&url) {
                            return Ok(());
                        }
                        let mut source = PWSTR::null();
                        sender.Source(&mut source)?;
                        let source = take_pwstr(source);
                        let Ok(request) = Request::new(&url, &source, kind, "GET") else {
                            return Ok(());
                        };
                        if blocker
                            .engine
                            .check_network_request(&request)
                            .should_block()
                        {
                            let response = environment.CreateWebResourceResponse(
                                None,
                                403,
                                &HSTRING::from("Blocked"),
                                &HSTRING::new(),
                            )?;
                            args.SetResponse(&response)?;
                        }
                        Ok(())
                    })),
                    &mut token,
                )?;

                if !blocker.generic_css.is_empty() {
                    core.AddScriptToExecuteOnDocumentCreated(
                        &HSTRING::from(style_script(&blocker.generic_css)),
                        &AddScriptToExecuteOnDocumentCreatedCompletedHandler::create(Box::new(
                            |_, _| Ok(()),
                        )),
                    )?;
                }

                let mut loading = 0;
                core.add_ContentLoading(
                    &ContentLoadingEventHandler::create(Box::new(move |sender, _| {
                        let Some(sender) = sender else { return Ok(()) };
                        let mut source = PWSTR::null();
                        sender.Source(&mut source)?;
                        let resources = blocker.engine.url_cosmetic_resources(&take_pwstr(source));
                        let site = css(resources.hide_selectors.iter().map(String::as_str));
                        if !site.is_empty() {
                            sender.ExecuteScript(
                                &HSTRING::from(style_script(&site)),
                                &ExecuteScriptCompletedHandler::create(Box::new(|_, _| Ok(()))),
                            )?;
                        }
                        Ok(())
                    })),
                    &mut loading,
                )?;
                Ok(())
            })()
        };
        if let Err(error) = result {
            eprintln!("[Pake] Content blocking could not be installed: {error}");
        }
    }
}

#[cfg(target_os = "windows")]
pub use windows::install;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn selection_keeps_known_groups_in_order() {
        let names = ["china", "ads", "nope", "ads", " trackers "].map(String::from);
        assert_eq!(selected_groups(&names), vec!["ads", "trackers", "china"]);
        assert!(selected_groups(&[]).is_empty());
    }

    #[test]
    fn every_embedded_list_unpacks() {
        for (group, bytes) in GROUPS.iter().chain([("unbreak", UNBREAK)].iter()) {
            let text = gunzip(bytes).unwrap_or_else(|| panic!("{group} is not gzip text"));
            assert!(text.lines().count() > 1000, "{group} looks truncated");
        }
    }

    #[test]
    fn identifiers_change_with_the_selection() {
        let ads = webkit_identifier(&["ads"], "network");
        assert!(ads.starts_with(IDENTIFIER_PREFIX));
        assert_ne!(ads, webkit_identifier(&["ads", "trackers"], "network"));
        assert_ne!(ads, webkit_identifier(&["ads"], "cosmetic"));
        assert_eq!(ads, webkit_identifier(&["ads"], "network"));
    }

    /// WebKit refuses a whole list over its rule limit, so the largest
    /// selection has to fit in each unit with room for list growth.
    #[test]
    fn every_group_together_fits_webkit() {
        let all: Vec<&str> = GROUPS.iter().map(|(group, _)| *group).collect();
        for (unit, rule_types) in WEBKIT_UNITS {
            let count = webkit_rules(&all, rule_types).len();
            assert!(count > 1000, "{unit} has only {count} rules");
            assert!(
                count < WEBKIT_MAX_RULES * 9 / 10,
                "{unit} has {count} rules, too close to WebKit's {WEBKIT_MAX_RULES}"
            );
        }
    }

    #[test]
    fn rules_serialize_to_webkit_json() {
        let rules = webkit_rules(&["ads"], RuleTypes::NetworkOnly);
        let json = serde_json::to_string(&rules).expect("rules serialize");
        assert!(json.starts_with('[') && json.contains("\"url-filter\""));
    }
}
