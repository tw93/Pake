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

#[cfg(target_os = "windows")]
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

/// Names how the lists become WebKit rules. WebKit keeps a compiled list by
/// its identifier, so a change to the conversion has to change this, or apps
/// go on using the list the old conversion made.
#[cfg(any(target_os = "macos", target_os = "linux", test))]
const CONVERSION: &str = "exceptions-3";

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
    feed(CONVERSION.as_bytes());
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

/// The rules of one WebKit unit, ready to serialize. Windows builds its
/// generic hiding from the same rules, so the three platforms agree.
fn webkit_rules(groups: &[&str], rule_types: RuleTypes) -> Vec<adblock::content_blocking::CbRule> {
    let mut set = FilterSet::new(true);
    let mut unhide = Unhide::default();
    let mut allowed = Allowed::default();
    for bytes in list_bytes(groups) {
        let Some(text) = gunzip(bytes) else {
            eprintln!("[Pake] A built-in filter list could not be read");
            continue;
        };
        allowed.take_from(&text);
        set.add_filter_list(
            unhide.take_from(&text),
            ParseOptions {
                rule_types,
                ..ParseOptions::default()
            },
        );
    }
    let rules = set
        .into_content_blocking()
        .map(|(rules, _)| rules)
        .unwrap_or_default();
    if matches!(rule_types, RuleTypes::CosmeticOnly) {
        allowed.order(unhide.apply(rules))
    } else {
        allowed.after_requests(rules)
    }
}

/// The lists' page exceptions: `@@||site^$generichide` keeps the rules for
/// every site off a site, `$elemhide` every hiding rule, `$document` blocking
/// too. adblock's conversion drops the first two and reads the third as an
/// exception for requests to the site, so none of them held; EasyList keeps
/// generic hiding off about 350 sites this way. WebKit can only be told a
/// site, not a page: an exception for a path (`||bing.com/search?`) covers
/// its whole site, and one with no plain host is left out.
#[derive(Default)]
struct Allowed {
    generic_hiding: Vec<String>,
    hiding: Vec<String>,
    requests: Vec<String>,
}

impl Allowed {
    fn take_from(&mut self, text: &str) {
        for line in text.lines() {
            let Some(rest) = line.trim().strip_prefix("@@||") else {
                continue;
            };
            let Some((pattern, options)) = rest.rsplit_once('$') else {
                continue;
            };
            let host = pattern
                .split(['/', '^', '|', ':', '?'])
                .next()
                .unwrap_or_default()
                .to_ascii_lowercase();
            let plain = host.contains('.')
                && host
                    .bytes()
                    .all(|b| b.is_ascii_alphanumeric() || b == b'.' || b == b'-');
            if !plain {
                continue;
            }
            let entry = format!("*{host}");
            for option in options.split(',') {
                let lists: &mut [&mut Vec<String>] = match option.trim() {
                    "generichide" | "ghide" => &mut [&mut self.generic_hiding],
                    "elemhide" | "ehide" => &mut [&mut self.hiding],
                    "document" | "doc" => &mut [&mut self.hiding, &mut self.requests],
                    _ => continue,
                };
                for list in lists.iter_mut() {
                    if !list.contains(&entry) {
                        list.push(entry.clone());
                    }
                }
            }
        }
    }

    fn ignore(sites: &[String]) -> Option<adblock::content_blocking::CbRule> {
        use adblock::content_blocking::{CbAction, CbRule, CbTrigger, CbType};
        (!sites.is_empty()).then(|| CbRule {
            action: CbAction {
                typ: CbType::IgnorePreviousRules,
                selector: None,
            },
            trigger: CbTrigger {
                url_filter: ".*".to_owned(),
                if_domain: Some(sites.to_vec()),
                ..CbTrigger::default()
            },
        })
    }

    /// Hiding rules for every site, the sites that take none of those, the
    /// rules for named sites, then the sites that take no hiding at all.
    fn order(
        &self,
        rules: Vec<adblock::content_blocking::CbRule>,
    ) -> Vec<adblock::content_blocking::CbRule> {
        let (specific, generic): (Vec<_>, Vec<_>) = rules
            .into_iter()
            .partition(|rule| rule.trigger.if_domain.is_some());
        generic
            .into_iter()
            .chain(Self::ignore(&self.generic_hiding))
            .chain(specific)
            .chain(Self::ignore(&self.hiding))
            .collect()
    }

    fn after_requests(
        &self,
        mut rules: Vec<adblock::content_blocking::CbRule>,
    ) -> Vec<adblock::content_blocking::CbRule> {
        rules.extend(Self::ignore(&self.requests));
        rules
    }
}

/// The lists' hiding exceptions (`example.com#@#.ad`: do not hide `.ad` on
/// example.com), kept away from adblock's conversion and applied here. The
/// conversion writes each one as "hide the selector on every site but that
/// one", which hid every `svg`, Google's logo and icons among them, on all
/// sites for the sake of one site's exception.
#[derive(Default)]
struct Unhide {
    /// Selector to the sites that keep it; an empty list is every site.
    sites: std::collections::HashMap<String, Vec<String>>,
}

/// Where a hiding exception holds.
enum Sites {
    Every,
    Named(Vec<String>),
}

impl Unhide {
    /// `text` without its hiding exceptions, which are remembered.
    fn take_from(&mut self, text: &str) -> String {
        let mut kept = String::with_capacity(text.len());
        for line in text.lines() {
            match Self::exception(line) {
                Some((Sites::Every, selector)) => {
                    self.sites.insert(selector.to_owned(), vec![String::new()]);
                }
                Some((Sites::Named(sites), selector)) => {
                    if sites.is_empty() {
                        continue;
                    }
                    let entry = self.sites.entry(selector.to_owned()).or_default();
                    if entry.first().is_none_or(|site| !site.is_empty()) {
                        entry.extend(sites);
                    }
                }
                None => {
                    kept.push_str(line);
                    kept.push('\n');
                }
            }
        }
        kept
    }

    /// The sites and selector of a hiding exception, or `None` for any other
    /// line. An exception whose sites cannot be told to WebKit (`~site`,
    /// `site.*`, a non-ASCII name) is still taken, with those sites left out.
    fn exception(line: &str) -> Option<(Sites, &str)> {
        let line = line.trim();
        if line.starts_with('!') {
            return None;
        }
        let (at, mark) = ["#@#", "#@?#"]
            .iter()
            .filter_map(|mark| line.find(mark).map(|at| (at, *mark)))
            .min()?;
        if line[..at].contains('#') {
            return None;
        }
        let selector = line[at + mark.len()..].trim();
        if selector.is_empty() || selector.starts_with("+js(") {
            return None;
        }
        let named = line[..at]
            .split(',')
            .map(str::trim)
            .filter(|s| !s.is_empty());
        if named.clone().count() == 0 {
            return Some((Sites::Every, selector));
        }
        let sites = named
            .filter(|site| site.is_ascii() && !site.starts_with('~') && !site.ends_with(".*"))
            .map(str::to_ascii_lowercase)
            .collect();
        Some((Sites::Named(sites), selector))
    }

    /// A rule for certain sites loses the excepted ones, and a rule for every
    /// site gets them as `unless-domain`, subdomains included.
    fn apply(
        &self,
        rules: Vec<adblock::content_blocking::CbRule>,
    ) -> Vec<adblock::content_blocking::CbRule> {
        rules
            .into_iter()
            .filter_map(|mut rule| {
                // WebKit reads a bare name as that host alone; the lists mean
                // its subdomains too, and adblock leaves the `*` out for
                // hiding rules, so `example.com##.ad` never reached www.
                for hosts in [&mut rule.trigger.if_domain, &mut rule.trigger.unless_domain] {
                    for host in hosts.iter_mut().flatten() {
                        if !host.starts_with('*') {
                            host.insert(0, '*');
                        }
                    }
                }
                let Some(sites) = rule
                    .action
                    .selector
                    .as_ref()
                    .and_then(|selector| self.sites.get(selector))
                else {
                    return Some(rule);
                };
                if sites.first().is_some_and(String::is_empty) {
                    return None;
                }
                let excepted = |host: &str| {
                    let host = host.trim_start_matches('*');
                    sites.iter().any(|site| {
                        host == site
                            || host
                                .strip_suffix(site.as_str())
                                .is_some_and(|rest| rest.ends_with('.'))
                    })
                };
                match rule.trigger.if_domain.take() {
                    Some(hosts) => {
                        let left: Vec<String> =
                            hosts.into_iter().filter(|host| !excepted(host)).collect();
                        if left.is_empty() {
                            return None;
                        }
                        rule.trigger.if_domain = Some(left);
                    }
                    None => {
                        let unless = rule.trigger.unless_domain.get_or_insert_with(Vec::new);
                        for site in sites {
                            let entry = format!("*{site}");
                            if !unless.contains(&entry) {
                                unless.push(entry);
                            }
                        }
                    }
                }
                Some(rule)
            })
            .collect()
    }
}

/// Puts the style `s` in the document. A script WebView2 runs when a document
/// is created finds neither a head nor a root element yet, where a plain
/// `appendChild` threw and no generic hiding ever reached a Windows page; it
/// waits for the first element instead.
#[cfg(any(target_os = "windows", test))]
const ATTACH_STYLE: &str = "const a=()=>{const r=document.head||document.documentElement;if(!r)return false;r.appendChild(s);return true};if(!a()){const o=new MutationObserver(()=>{if(a())o.disconnect()});o.observe(document,{childList:true,subtree:true});}";

/// A script for every document on Windows: the hiding rules for every site,
/// each without the sites its exceptions name, and none at all on a site the
/// lists keep generic or all hiding off. One rule per selector, so a selector
/// the browser rejects only drops its own rule.
#[cfg(any(target_os = "windows", test))]
fn generic_script(groups: &[&str]) -> String {
    use adblock::content_blocking::CbType;
    let bare = |hosts: &[String]| -> Vec<String> {
        hosts
            .iter()
            .map(|host| host.trim_start_matches('*').to_owned())
            .collect()
    };
    let mut off: Vec<String> = Vec::new();
    let mut plain = String::new();
    let mut excepted: Vec<(String, Vec<String>)> = Vec::new();
    for rule in webkit_rules(groups, RuleTypes::CosmeticOnly) {
        let hosts = rule.trigger.if_domain.as_deref();
        match (rule.action.typ, rule.action.selector, hosts) {
            (CbType::IgnorePreviousRules, _, Some(hosts)) => off.extend(bare(hosts)),
            (CbType::CssDisplayNone, Some(selector), None) => {
                if selector.contains(['{', '}', '<']) {
                    continue;
                }
                match rule.trigger.unless_domain.as_deref() {
                    Some(hosts) => excepted.push((selector, bare(hosts))),
                    None => {
                        plain.push_str(&selector);
                        plain.push_str("{display:none!important}\n");
                    }
                }
            }
            _ => {}
        }
    }
    if plain.is_empty() && excepted.is_empty() {
        return String::new();
    }
    fn json<T: serde::Serialize>(value: &T) -> String {
        serde_json::to_string(value).unwrap_or_else(|_| "[]".into())
    }
    format!(
        "(()=>{{const h=location.hostname,on=d=>h===d||h.endsWith('.'+d);if({off}.some(on))return;\
         let c={plain};for(const [s,d] of {excepted})if(!d.some(on))c+=s+'{{display:none!important}}\\n';\
         const s=document.createElement('style');s.setAttribute('data-pake-blocking','');s.textContent=c;\
         {attach}}})();",
        attach = ATTACH_STYLE,
        off = json(&off),
        plain = json(&plain),
        excepted = json(&excepted),
    )
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
    use super::{filter_set, generic_script, selected_groups};
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
        /// Hides what the lists hide on every site, exceptions observed.
        generic_script: String,
    }

    // The engine is built once per selection; a process has one selection.
    static BLOCKERS: OnceLock<Mutex<HashMap<Vec<&'static str>, &'static Blocker>>> =
        OnceLock::new();

    fn blocker(groups: Vec<&'static str>) -> &'static Blocker {
        let map = BLOCKERS.get_or_init(|| Mutex::new(HashMap::new()));
        let mut map = map.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
        map.entry(groups.clone()).or_insert_with(|| {
            let engine = Engine::new_with_filter_set(filter_set(&groups, RuleTypes::All, false));
            Box::leak(Box::new(Blocker {
                engine,
                generic_script: generic_script(&groups),
            }))
        })
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
            "(()=>{{const s=document.createElement('style');s.setAttribute('data-pake-blocking','');s.textContent={css};{attach}}})();",
            attach = super::ATTACH_STYLE,
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

                if !blocker.generic_script.is_empty() {
                    core.AddScriptToExecuteOnDocumentCreated(
                        &HSTRING::from(blocker.generic_script.as_str()),
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

    /// The lists except single sites from hiding rules. Each exception once
    /// came out as a rule hiding its selector on every other site: `svg`,
    /// `iframe[style]` and a hundred more that no list hides everywhere.
    #[test]
    fn an_exception_for_one_site_hides_nothing_on_the_others() {
        let all: Vec<&str> = GROUPS.iter().map(|(group, _)| *group).collect();
        let mut everywhere = std::collections::HashSet::new();
        for bytes in list_bytes(&all) {
            let text = gunzip(bytes).expect("list unpacks");
            for line in text.lines() {
                let Some(at) = line.find("##") else { continue };
                let sites = &line[..at];
                if sites.contains('#') || line.starts_with('!') {
                    continue;
                }
                if sites
                    .split(',')
                    .all(|site| site.is_empty() || site.starts_with('~'))
                {
                    everywhere.insert(line[at + 2..].trim().to_owned());
                }
            }
        }
        let rules = webkit_rules(&all, RuleTypes::CosmeticOnly);
        let stray: Vec<&str> = rules
            .iter()
            .filter(|rule| rule.trigger.if_domain.is_none())
            .filter_map(|rule| rule.action.selector.as_deref())
            .filter(|selector| !everywhere.contains(*selector))
            .collect();
        assert!(
            stray.is_empty(),
            "hidden on every site by no list: {stray:?}"
        );
        assert!(!rules
            .iter()
            .any(|rule| rule.action.selector.as_deref() == Some("svg")));
    }

    #[test]
    fn exceptions_narrow_the_rules_they_name() {
        let mut unhide = Unhide::default();
        let kept = unhide.take_from(
            "##.ad\nfoo.com,bar.com##.box\nfoo.com##.only\n##.gone\n\
             keep.com#@#.ad\nFoo.com#@#.box\nfoo.com#@#.only\n#@#.gone\n\
             other.com#@#svg\nx.com#@#+js(nowebrtc)\n~y.com#@#.ad\n",
        );
        assert_eq!(
            kept,
            "##.ad\nfoo.com,bar.com##.box\nfoo.com##.only\n##.gone\nx.com#@#+js(nowebrtc)\n"
        );
        let mut set = FilterSet::new(true);
        set.add_filter_list(
            kept,
            ParseOptions {
                rule_types: RuleTypes::CosmeticOnly,
                ..ParseOptions::default()
            },
        );
        let (rules, _) = set.into_content_blocking().expect("rules convert");
        let rules = unhide.apply(rules);
        let of = |selector: &str| {
            rules
                .iter()
                .find(|rule| rule.action.selector.as_deref() == Some(selector))
        };
        let ad = of(".ad").expect("the generic rule stays");
        assert_eq!(ad.trigger.unless_domain, Some(vec!["*keep.com".to_owned()]));
        let boxed = of(".box").expect("the rule keeps its other site");
        assert_eq!(boxed.trigger.if_domain, Some(vec!["*bar.com".to_owned()]));
        assert!(of(".only").is_none() && of(".gone").is_none() && of("svg").is_none());
    }

    #[test]
    fn page_exceptions_become_rules_webkit_can_follow() {
        let mut allowed = Allowed::default();
        allowed.take_from(
            "@@||a.com^$generichide\n@@||b.com/search?$ghide\n@@||c.com^$elemhide\n\
             @@||d.com^$document\n@@||www.google.*/search?$generichide\n\
             @@://localhost/$generichide\n@@||e.com^$script\n||f.com^$document\n",
        );
        assert_eq!(allowed.generic_hiding, ["*a.com", "*b.com"]);
        assert_eq!(allowed.hiding, ["*c.com", "*d.com"]);
        assert_eq!(allowed.requests, ["*d.com"]);

        use adblock::content_blocking::CbType;
        let all: Vec<&str> = GROUPS.iter().map(|(group, _)| *group).collect();
        let rules = webkit_rules(&all, RuleTypes::CosmeticOnly);
        let ignores: Vec<usize> = (0..rules.len())
            .filter(|index| rules[*index].action.typ == CbType::IgnorePreviousRules)
            .collect();
        assert_eq!(ignores.len(), 2, "generic hiding and all hiding");
        let sites = |index: usize| rules[index].trigger.if_domain.clone().unwrap_or_default();
        assert!(sites(ignores[0]).contains(&"*bing.com".to_owned()));
        assert!(sites(ignores[0]).len() > 300);
        assert!(rules[..ignores[0]]
            .iter()
            .all(|rule| rule.trigger.if_domain.is_none()));
        assert!(rules[ignores[0] + 1..ignores[1]]
            .iter()
            .all(|rule| rule.trigger.if_domain.is_some()));
        assert_eq!(ignores[1], rules.len() - 1);
        // A bare name is that host alone to WebKit.
        assert!(rules
            .iter()
            .flat_map(|rule| rule
                .trigger
                .if_domain
                .iter()
                .chain(&rule.trigger.unless_domain))
            .flatten()
            .all(|host| host.starts_with('*')));
    }

    #[test]
    fn the_windows_script_carries_the_exceptions() {
        let script = generic_script(&["ads"]);
        assert!(
            script.contains("\"bing.com\""),
            "a site with generic hiding off"
        );
        assert!(
            script.contains("\",[\""),
            "a selector with the sites that keep it"
        );
        assert!(!script.contains("\"*"), "hosts are compared bare");
        assert!(!script.contains("svg{display"));
        // At document creation there is no element to hold the style yet.
        assert!(script.contains("MutationObserver"));
        assert!(!script.contains("(document.head||document.documentElement).appendChild"));
    }

    /// Writes what an app with every group on loads, for
    /// `tests/blocking/run.mjs` to try on real pages: the two WebKit lists of
    /// a Mac or Linux app and the hiding script of a Windows one.
    #[test]
    #[ignore = "writes files for tests/blocking/run.mjs"]
    fn dump_for_real_pages() {
        let dir = std::env::var("PAKE_DUMP_BLOCKING").expect("PAKE_DUMP_BLOCKING names a folder");
        let dir = std::path::Path::new(&dir);
        let all: Vec<&str> = GROUPS.iter().map(|(group, _)| *group).collect();
        for (unit, rule_types) in WEBKIT_UNITS {
            let json = serde_json::to_string(&webkit_rules(&all, rule_types)).expect("rules");
            std::fs::write(dir.join(format!("{unit}.json")), json).expect("list written");
        }
        std::fs::write(dir.join("windows.js"), generic_script(&all)).expect("script written");
    }

    #[test]
    fn rules_serialize_to_webkit_json() {
        let rules = webkit_rules(&["ads"], RuleTypes::NetworkOnly);
        let json = serde_json::to_string(&rules).expect("rules serialize");
        assert!(json.starts_with('[') && json.contains("\"url-filter\""));
    }
}
