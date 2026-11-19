//! macOS 15.4 and later. WebKit runs unpacked WebExtensions through `WKWebExtensionController`, but
//! only for a host that looks like a browser: it asks for a window and its
//! tabs, and a content script that messages its background page fails with
//! "Tab not found" when there are none. Pake has no tabs, so every webview it
//! builds is reported as one tab of a single window.

use super::{installed, unpacked, Installed};
use block2::RcBlock;
use objc2::rc::{Allocated, Retained, Weak};
use objc2::runtime::{AnyClass, AnyObject, NSObject, NSObjectProtocol, ProtocolObject};
use objc2::{class, define_class, msg_send, DefinedClass, MainThreadMarker, MainThreadOnly};
use objc2_foundation::{
    NSArray, NSDate, NSError, NSPoint, NSRect, NSSet, NSSize, NSString, NSURL, NSUUID,
};
use objc2_web_kit::{
    WKWebExtension, WKWebExtensionContext, WKWebExtensionContextPermissionStatus,
    WKWebExtensionController, WKWebExtensionControllerConfiguration,
    WKWebExtensionControllerDelegate, WKWebExtensionMatchPattern, WKWebExtensionPermission,
    WKWebExtensionTab, WKWebExtensionTabConfiguration, WKWebExtensionWindow,
    WKWebViewConfiguration, WKWebsiteDataStore,
};
use std::cell::RefCell;
use std::collections::HashMap;
use std::path::Path;
use std::ptr::NonNull;
use std::time::Duration;

/// Names the controller's storage inside the app's own WebKit folder, so an
/// extension's settings survive a restart. One value serves every app: the
/// folder above it already carries the app's bundle identifier.
const STORAGE_IDENTIFIER: &str = "6B1F0C52-7A0E-4C55-9E57-50414B450001";

/// A first page never waits longer than this for the extensions to load.
const READY_TIMEOUT: Duration = Duration::from_secs(3);

type Callback = Box<dyn FnOnce()>;

struct Host {
    controller: Retained<WKWebExtensionController>,
    window: Retained<HostWindow>,
    store: Retained<WKWebsiteDataStore>,
    // The controller holds its delegate weakly.
    _delegate: Retained<HostDelegate>,
    pending: usize,
    opened: bool,
    callbacks: Vec<Callback>,
    /// What is installed, and each one's context once it has loaded.
    listed: Vec<Installed>,
    contexts: HashMap<String, Retained<WKWebExtensionContext>>,
    /// The windows showing an extension's pages, kept so a second ask raises one.
    pages: HashMap<String, Retained<AnyObject>>,
}

thread_local! {
    static HOST: RefCell<Option<Host>> = const { RefCell::new(None) };
}

struct TabIvars {
    webview: Weak<AnyObject>,
    window: Weak<HostWindow>,
}

define_class!(
    // SAFETY: NSObject has no subclassing requirements and HostTab has no Drop.
    #[unsafe(super(NSObject))]
    #[thread_kind = MainThreadOnly]
    #[name = "PakeExtensionTab"]
    #[ivars = TabIvars]
    struct HostTab;

    unsafe impl NSObjectProtocol for HostTab {}

    unsafe impl WKWebExtensionTab for HostTab {
        #[unsafe(method_id(windowForWebExtensionContext:))]
        fn window(
            &self,
            _context: &WKWebExtensionContext,
        ) -> Option<Retained<ProtocolObject<dyn WKWebExtensionWindow>>> {
            self.ivars()
                .window
                .load()
                .map(ProtocolObject::from_retained)
        }

        #[unsafe(method_id(webViewForWebExtensionContext:))]
        fn web_view(&self, _context: &WKWebExtensionContext) -> Option<Retained<AnyObject>> {
            self.ivars().webview.load()
        }

        #[unsafe(method_id(urlForWebExtensionContext:))]
        fn url(&self, _context: &WKWebExtensionContext) -> Option<Retained<NSURL>> {
            self.ivars()
                .webview
                .load()
                .and_then(|webview| unsafe { msg_send![&*webview, URL] })
        }

        #[unsafe(method_id(titleForWebExtensionContext:))]
        fn title(&self, _context: &WKWebExtensionContext) -> Option<Retained<NSString>> {
            self.ivars()
                .webview
                .load()
                .and_then(|webview| unsafe { msg_send![&*webview, title] })
        }

        #[unsafe(method(isSelectedForWebExtensionContext:))]
        fn is_selected(&self, _context: &WKWebExtensionContext) -> bool {
            self.ivars()
                .window
                .load()
                .and_then(|window| window.active())
                .is_some_and(|active| std::ptr::eq(&*active, self))
        }

        #[unsafe(method(isLoadingCompleteForWebExtensionContext:))]
        fn is_loading_complete(&self, _context: &WKWebExtensionContext) -> bool {
            self.ivars().webview.load().is_some_and(|webview| {
                let loading: bool = unsafe { msg_send![&*webview, isLoading] };
                !loading
            })
        }

        #[unsafe(method(sizeForWebExtensionContext:))]
        fn size(&self, _context: &WKWebExtensionContext) -> NSSize {
            self.ivars()
                .webview
                .load()
                .map(|webview| {
                    let bounds: NSRect = unsafe { msg_send![&*webview, bounds] };
                    bounds.size
                })
                .unwrap_or(NSSize::new(0.0, 0.0))
        }
    }
);

impl HostTab {
    fn new(mtm: MainThreadMarker, webview: &AnyObject, window: &HostWindow) -> Retained<Self> {
        let this = Self::alloc(mtm).set_ivars(TabIvars {
            webview: Weak::new(webview),
            window: Weak::new(window),
        });
        unsafe { msg_send![super(this), init] }
    }

    fn is_alive(&self) -> bool {
        self.ivars().webview.load().is_some()
    }

    /// Whether this tab's webview sits in the key window.
    fn is_key(&self) -> bool {
        self.ivars().webview.load().is_some_and(|webview| unsafe {
            let window: *mut AnyObject = msg_send![&*webview, window];
            !window.is_null() && msg_send![window, isKeyWindow]
        })
    }
}

struct WindowIvars {
    tabs: RefCell<Vec<Retained<HostTab>>>,
}

define_class!(
    // SAFETY: NSObject has no subclassing requirements and HostWindow has no Drop.
    #[unsafe(super(NSObject))]
    #[thread_kind = MainThreadOnly]
    #[name = "PakeExtensionWindow"]
    #[ivars = WindowIvars]
    struct HostWindow;

    unsafe impl NSObjectProtocol for HostWindow {}

    unsafe impl WKWebExtensionWindow for HostWindow {
        #[unsafe(method_id(tabsForWebExtensionContext:))]
        fn tabs(
            &self,
            _context: &WKWebExtensionContext,
        ) -> Retained<NSArray<ProtocolObject<dyn WKWebExtensionTab>>> {
            let tabs: Vec<Retained<ProtocolObject<dyn WKWebExtensionTab>>> = self
                .live()
                .into_iter()
                .map(ProtocolObject::from_retained)
                .collect();
            NSArray::from_retained_slice(&tabs)
        }

        #[unsafe(method_id(activeTabForWebExtensionContext:))]
        fn active_tab(
            &self,
            _context: &WKWebExtensionContext,
        ) -> Option<Retained<ProtocolObject<dyn WKWebExtensionTab>>> {
            self.active().map(ProtocolObject::from_retained)
        }
    }
);

impl HostWindow {
    fn new(mtm: MainThreadMarker) -> Retained<Self> {
        let this = Self::alloc(mtm).set_ivars(WindowIvars {
            tabs: RefCell::new(Vec::new()),
        });
        unsafe { msg_send![super(this), init] }
    }

    fn live(&self) -> Vec<Retained<HostTab>> {
        self.ivars()
            .tabs
            .borrow()
            .iter()
            .filter(|tab| tab.is_alive())
            .cloned()
            .collect()
    }

    /// The tab in the key window, or the first one while the app is in the background.
    fn active(&self) -> Option<Retained<HostTab>> {
        let live = self.live();
        live.iter()
            .find(|tab| tab.is_key())
            .or(live.first())
            .cloned()
    }
}

struct DelegateIvars {
    window: Retained<HostWindow>,
}

define_class!(
    // SAFETY: NSObject has no subclassing requirements and HostDelegate has no Drop.
    #[unsafe(super(NSObject))]
    #[thread_kind = MainThreadOnly]
    #[name = "PakeExtensionDelegate"]
    #[ivars = DelegateIvars]
    struct HostDelegate;

    unsafe impl NSObjectProtocol for HostDelegate {}

    unsafe impl WKWebExtensionControllerDelegate for HostDelegate {
        #[unsafe(method_id(webExtensionController:openWindowsForExtensionContext:))]
        fn open_windows(
            &self,
            _controller: &WKWebExtensionController,
            _context: &WKWebExtensionContext,
        ) -> Retained<NSArray<ProtocolObject<dyn WKWebExtensionWindow>>> {
            let window = ProtocolObject::from_retained(self.ivars().window.clone());
            NSArray::from_retained_slice(&[window])
        }

        #[unsafe(method_id(webExtensionController:focusedWindowForExtensionContext:))]
        fn focused_window(
            &self,
            _controller: &WKWebExtensionController,
            _context: &WKWebExtensionContext,
        ) -> Option<Retained<ProtocolObject<dyn WKWebExtensionWindow>>> {
            Some(ProtocolObject::from_retained(self.ivars().window.clone()))
        }

        // The person chose this extension when they added it to the app, so
        // what its manifest asks for is granted without a second question.
        #[unsafe(method(webExtensionController:promptForPermissions:inTab:forExtensionContext:completionHandler:))]
        fn prompt_permissions(
            &self,
            _controller: &WKWebExtensionController,
            permissions: &NSSet<WKWebExtensionPermission>,
            _tab: Option<&ProtocolObject<dyn WKWebExtensionTab>>,
            _context: &WKWebExtensionContext,
            handler: &block2::DynBlock<
                dyn Fn(NonNull<NSSet<WKWebExtensionPermission>>, *mut NSDate),
            >,
        ) {
            handler.call((NonNull::from(permissions), std::ptr::null_mut()));
        }

        #[unsafe(method(webExtensionController:promptForPermissionToAccessURLs:inTab:forExtensionContext:completionHandler:))]
        fn prompt_urls(
            &self,
            _controller: &WKWebExtensionController,
            urls: &NSSet<NSURL>,
            _tab: Option<&ProtocolObject<dyn WKWebExtensionTab>>,
            _context: &WKWebExtensionContext,
            handler: &block2::DynBlock<dyn Fn(NonNull<NSSet<NSURL>>, *mut NSDate)>,
        ) {
            handler.call((NonNull::from(urls), std::ptr::null_mut()));
        }

        #[unsafe(method(webExtensionController:promptForPermissionMatchPatterns:inTab:forExtensionContext:completionHandler:))]
        fn prompt_patterns(
            &self,
            _controller: &WKWebExtensionController,
            patterns: &NSSet<WKWebExtensionMatchPattern>,
            _tab: Option<&ProtocolObject<dyn WKWebExtensionTab>>,
            _context: &WKWebExtensionContext,
            handler: &block2::DynBlock<
                dyn Fn(NonNull<NSSet<WKWebExtensionMatchPattern>>, *mut NSDate),
            >,
        ) {
            handler.call((NonNull::from(patterns), std::ptr::null_mut()));
        }

        // A popup's "more settings" link asks for the options page.
        #[unsafe(method(webExtensionController:openOptionsPageForExtensionContext:completionHandler:))]
        fn open_options(
            &self,
            _controller: &WKWebExtensionController,
            context: &WKWebExtensionContext,
            handler: &block2::DynBlock<dyn Fn(*mut NSError)>,
        ) {
            let id = unsafe { context.uniqueIdentifier() }.to_string();
            // Once this call has returned: WebKit may be inside a borrow of the host.
            dispatch::Queue::main().exec_async(move || show_page(&id, None));
            handler.call((std::ptr::null_mut(),));
        }

        // Several extensions open a welcome page the first time they run. The
        // app has one page, its site, so an extension gets no tab of its own.
        #[unsafe(method(webExtensionController:openNewTabUsingConfiguration:forExtensionContext:completionHandler:))]
        fn open_new_tab(
            &self,
            _controller: &WKWebExtensionController,
            _configuration: &WKWebExtensionTabConfiguration,
            _context: &WKWebExtensionContext,
            handler: &block2::DynBlock<
                dyn Fn(*mut ProtocolObject<dyn WKWebExtensionTab>, *mut NSError),
            >,
        ) {
            handler.call((std::ptr::null_mut(), std::ptr::null_mut()));
        }
    }
);

impl HostDelegate {
    fn new(mtm: MainThreadMarker, window: Retained<HostWindow>) -> Retained<Self> {
        let this = Self::alloc(mtm).set_ivars(DelegateIvars { window });
        unsafe { msg_send![super(this), init] }
    }
}

/// A webview configuration that carries the extension controller, or `None`
/// where WebKit has none (before macOS 15.4) or nothing is installed.
///
/// Wry takes the data store from a configuration it is handed and ignores its
/// own incognito switch, so the store is chosen here. It must also be the one
/// the controller was made for, or no content script is injected.
pub fn configuration(
    directory: &Path,
    incognito: bool,
) -> Option<Retained<WKWebViewConfiguration>> {
    let mtm = MainThreadMarker::new()?;
    AnyClass::get(c"WKWebExtensionController")?;
    HOST.with_borrow_mut(|host| {
        if host.is_none() {
            *host = start(mtm, directory, incognito);
        }
        let host = host.as_ref()?;
        let configuration = unsafe { WKWebViewConfiguration::new(mtm) };
        unsafe {
            configuration.setWebExtensionController(Some(&host.controller));
            configuration.setWebsiteDataStore(&host.store);
        }
        Some(configuration)
    })
}

fn start(mtm: MainThreadMarker, directory: &Path, incognito: bool) -> Option<Host> {
    let folders = unpacked(directory);
    if folders.is_empty() {
        return None;
    }
    let (settings, store) = unsafe {
        if incognito {
            (
                WKWebExtensionControllerConfiguration::nonPersistentConfiguration(mtm),
                WKWebsiteDataStore::nonPersistentDataStore(mtm),
            )
        } else {
            let identifier = NSUUID::from_string(&NSString::from_str(STORAGE_IDENTIFIER))?;
            (
                WKWebExtensionControllerConfiguration::configurationWithIdentifier(
                    &identifier,
                    mtm,
                ),
                WKWebsiteDataStore::defaultDataStore(mtm),
            )
        }
    };
    unsafe { settings.setDefaultWebsiteDataStore(Some(&store)) };
    let controller = unsafe {
        WKWebExtensionController::initWithConfiguration(
            WKWebExtensionController::alloc(mtm),
            &settings,
        )
    };
    let window = HostWindow::new(mtm);
    let delegate = HostDelegate::new(mtm, window.clone());
    unsafe { controller.setDelegate(Some(ProtocolObject::from_ref(&*delegate))) };

    for folder in &folders {
        let name = folder
            .file_name()
            .map(|name| name.to_string_lossy().into_owned())
            .unwrap_or_default();
        let url = NSURL::fileURLWithPath_isDirectory(
            &NSString::from_str(&folder.to_string_lossy()),
            true,
        );
        let block = RcBlock::new(move |extension: *mut WKWebExtension, error: *mut NSError| {
            let extension = unsafe { Retained::retain(extension) };
            let reason = unsafe { error.as_ref() }
                .map(|error| error.localizedDescription().to_string())
                .unwrap_or_default();
            loaded(&name, extension, &reason);
        });
        unsafe {
            WKWebExtension::extensionWithResourceBaseURL_completionHandler(&url, &block, mtm)
        };
    }

    Some(Host {
        controller,
        window,
        store,
        _delegate: delegate,
        pending: folders.len(),
        opened: false,
        callbacks: Vec::new(),
        listed: installed(directory),
        contexts: HashMap::new(),
        pages: HashMap::new(),
    })
}

fn loaded(name: &str, extension: Option<Retained<WKWebExtension>>, reason: &str) {
    let callbacks = HOST.with_borrow_mut(|host| {
        let host = host.as_mut()?;
        match extension {
            Some(extension) => match load(&host.controller, name, &extension) {
                Ok(context) => {
                    host.contexts.insert(name.to_owned(), context);
                }
                Err(error) => eprintln!("[Pake] Could not load the extension {name}: {error}"),
            },
            None => eprintln!("[Pake] Could not read the extension {name}: {reason}"),
        }
        host.pending = host.pending.saturating_sub(1);
        (host.pending == 0).then(|| std::mem::take(&mut host.callbacks))
    });
    callbacks
        .into_iter()
        .flatten()
        .for_each(|callback| callback());
}

fn load(
    controller: &WKWebExtensionController,
    name: &str,
    extension: &WKWebExtension,
) -> Result<Retained<WKWebExtensionContext>, String> {
    unsafe {
        let context = WKWebExtensionContext::contextForExtension(extension);
        // Named after the folder, so the extension keeps its storage and the
        // address of its pages from one launch to the next. WebKit otherwise
        // gives the pages a new random host every time, and what a page kept
        // in localStorage or IndexedDB would be gone.
        context.setUniqueIdentifier(&NSString::from_str(name));
        if let Some(base) = NSURL::URLWithString(&NSString::from_str(&format!(
            "webkit-extension://{}/",
            page_host(name)
        ))) {
            context.setBaseURL(&base);
        }
        let granted = WKWebExtensionContextPermissionStatus::GrantedExplicitly;
        for permission in extension
            .requestedPermissions()
            .iter()
            .chain(extension.optionalPermissions().iter())
        {
            context.setPermissionStatus_forPermission(granted, &permission);
        }
        for pattern in extension
            .allRequestedMatchPatterns()
            .iter()
            .chain(extension.optionalPermissionMatchPatterns().iter())
        {
            context.setPermissionStatus_forMatchPattern(granted, &pattern);
        }
        controller
            .loadExtensionContext_error(&context)
            .map_err(|error| error.localizedDescription().to_string())?;
        Ok(context)
    }
}

/// A host name for an extension's pages: the folder name where it already is
/// one, else its bytes in hex.
fn page_host(name: &str) -> String {
    let plain = !name.is_empty()
        && name.len() <= 63
        && !name.starts_with('-')
        && !name.ends_with('-')
        && name
            .bytes()
            .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'-');
    if plain {
        return name.to_owned();
    }
    let hex: String = name
        .bytes()
        .take(28)
        .map(|byte| format!("{byte:02x}"))
        .collect();
    format!("x{hex}")
}

/// Whether this macOS can run extensions at all (15.4 and later).
pub fn supported() -> bool {
    AnyClass::get(c"WKWebExtensionController").is_some()
}

/// Shows the settings page of the extension in folder `id` in a window of its
/// own: the popup a browser would hang from its toolbar, or its options page.
pub fn open_page(id: &str) {
    let page = HOST.with_borrow(|host| {
        host.as_ref()?
            .listed
            .iter()
            .find(|extension| extension.id == id)
            .and_then(|extension| extension.page.clone())
    });
    if let Some(page) = page {
        show_page(id, Some(&page));
    }
}

/// `page` is relative to the extension, or `None` for its options page.
fn show_page(id: &str, page: Option<&str>) {
    HOST.with_borrow_mut(|host| {
        let Some(host) = host.as_mut() else {
            return;
        };
        let key = format!("{id}/{}", page.unwrap_or_default());
        if let Some(window) = host.pages.get(&key) {
            // A minimized window is not visible, but it is still there.
            let (visible, minimized): (bool, bool) = unsafe {
                (
                    msg_send![&**window, isVisible],
                    msg_send![&**window, isMiniaturized],
                )
            };
            if visible || minimized {
                unsafe { front(window) };
                return;
            }
        }
        let Some(context) = host.contexts.get(id) else {
            eprintln!("[Pake] The extension {id} is not loaded");
            return;
        };
        let title = host
            .listed
            .iter()
            .find(|extension| extension.id == id)
            .map(|extension| extension.name.clone())
            .unwrap_or_default();
        let window = unsafe {
            let url = match page {
                Some(page) => NSURL::URLWithString_relativeToURL(
                    &NSString::from_str(page),
                    Some(&context.baseURL()),
                ),
                None => context.optionsPageURL(),
            };
            let (Some(url), Some(configuration)) = (url, context.webViewConfiguration()) else {
                eprintln!("[Pake] The extension {id} has no page to show");
                return;
            };
            let frame = NSRect::new(NSPoint::new(0.0, 0.0), NSSize::new(420.0, 620.0));
            let webview: Allocated<AnyObject> = msg_send![class!(WKWebView), alloc];
            let webview: Retained<AnyObject> =
                msg_send![webview, initWithFrame: frame, configuration: &*configuration];
            // Titled, closable, miniaturizable, resizable; buffered backing.
            let window: Allocated<AnyObject> = msg_send![class!(NSWindow), alloc];
            let window: Retained<AnyObject> = msg_send![
                window,
                initWithContentRect: frame,
                styleMask: 15usize,
                backing: 2usize,
                defer: false
            ];
            // The map below owns it; AppKit must not free it a second time.
            let _: () = msg_send![&*window, setReleasedWhenClosed: false];
            let _: () = msg_send![&*window, setTitle: &*NSString::from_str(&title)];
            let _: () = msg_send![&*window, setContentView: &*webview];
            let _: () = msg_send![&*window, center];
            let request: Retained<AnyObject> =
                msg_send![class!(NSURLRequest), requestWithURL: &*url];
            let _: *mut AnyObject = msg_send![&*webview, loadRequest: &*request];
            front(&window);
            window
        };
        host.pages.insert(key, window);
    });
}

unsafe fn front(window: &AnyObject) {
    let _: () = msg_send![window, deminiaturize: std::ptr::null::<AnyObject>()];
    let _: () = msg_send![window, makeKeyAndOrderFront: std::ptr::null::<AnyObject>()];
}

/// Reports a webview Pake built as a tab, so extensions can find its page.
pub fn register(webview: &AnyObject) {
    let Some(mtm) = MainThreadMarker::new() else {
        return;
    };
    HOST.with_borrow_mut(|host| {
        let Some(host) = host.as_mut() else {
            return;
        };
        let ours: Option<Retained<WKWebExtensionController>> = unsafe {
            let configuration: Retained<WKWebViewConfiguration> = msg_send![webview, configuration];
            configuration.webExtensionController()
        };
        if !ours.is_some_and(|ours| std::ptr::eq(&*ours, &*host.controller)) {
            return;
        }

        let tab = HostTab::new(mtm, webview, &host.window);
        let closed: Vec<Retained<HostTab>> = {
            let mut tabs = host.window.ivars().tabs.borrow_mut();
            let (live, closed) = tabs.drain(..).partition(|tab| tab.is_alive());
            *tabs = live;
            tabs.push(tab.clone());
            closed
        };
        let window: &ProtocolObject<dyn WKWebExtensionWindow> =
            ProtocolObject::from_ref(&*host.window);
        let opened: &ProtocolObject<dyn WKWebExtensionTab> = ProtocolObject::from_ref(&*tab);
        unsafe {
            for tab in &closed {
                host.controller
                    .didCloseTab_windowIsClosing(ProtocolObject::from_ref(&**tab), false);
            }
            if !host.opened {
                host.opened = true;
                host.controller.didOpenWindow(window);
            }
            host.controller.didOpenTab(opened);
            host.controller
                .didActivateTab_previousActiveTab(opened, None);
            host.controller.didFocusWindow(Some(window));
        }
    });
}

/// Runs `callback` once every extension is loaded, so the first page gets its
/// content scripts. Runs at once when there are none or they are already in.
pub fn when_ready(callback: Callback) {
    let ready = HOST.with_borrow_mut(|host| match host.as_mut() {
        Some(host) if host.pending > 0 => {
            host.callbacks.push(callback);
            None
        }
        _ => Some(callback),
    });
    if let Some(callback) = ready {
        callback();
        return;
    }
    std::thread::spawn(|| {
        std::thread::sleep(READY_TIMEOUT);
        dispatch::Queue::main().exec_async(|| {
            let late = HOST.with_borrow_mut(|host| {
                host.as_mut()
                    .map(|host| std::mem::take(&mut host.callbacks))
                    .unwrap_or_default()
            });
            if !late.is_empty() {
                eprintln!("[Pake] Extensions are still loading; opening the page without them");
            }
            late.into_iter().for_each(|callback| callback());
        });
    });
}

#[cfg(test)]
mod tests {
    use super::page_host;

    #[test]
    fn page_host_is_always_a_host_name() {
        assert_eq!(page_host("ublock-origin-lite"), "ublock-origin-lite");
        // Anything a URL host cannot hold is spelled in hex instead.
        assert_eq!(page_host("Dark Reader"), "x4461726b20526561646572");
        assert_eq!(page_host("-edge-"), "x2d656467652d");
        assert_eq!(page_host(""), "x");
        assert!(page_host(&"a".repeat(80)).len() <= 63);
    }
}
