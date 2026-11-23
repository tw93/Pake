//! Windows. WebView2 keeps an unpacked extension in the app's own profile once
//! it is added, and runs its content scripts only in pages opened after that.
//! So the first window waits blank until every folder has been added, then
//! opens its page.

use super::settings::{self, Action, Mode};
use super::{installed, requested_settings, unpacked};
use crate::app::window::MultiWindowState;
use std::cell::{Cell, RefCell};
use std::collections::HashMap;
use std::path::PathBuf;
use std::rc::Rc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Manager, Url, WebviewWindow};
use webview2_com::Microsoft::Web::WebView2::Win32::{
    ICoreWebView2, ICoreWebView2BrowserExtension, ICoreWebView2Controller,
    ICoreWebView2Environment10, ICoreWebView2Profile, ICoreWebView2Profile7, ICoreWebView2_13,
    ICoreWebView2_2,
};
use webview2_com::{
    take_pwstr, BrowserExtensionRemoveCompletedHandler,
    CreateCoreWebView2ControllerCompletedHandler, ExecuteScriptCompletedHandler,
    ProfileAddBrowserExtensionCompletedHandler, ProfileGetBrowserExtensionsCompletedHandler,
};
use windows_core::{Interface, HSTRING, PWSTR};

/// Folder name to the id WebView2 gave the extension, which its pages live under.
static ADDED: Mutex<Option<HashMap<String, String>>> = Mutex::new(None);
/// Set once every extension is settled; a page asked for earlier waits in `ASKED`.
static READY: AtomicBool = AtomicBool::new(false);
static ASKED: Mutex<Option<String>> = Mutex::new(None);

/// Pake's own page of each extension whose settings an app may carry, in a
/// webview of no window of its own (settings.rs). WebView2 objects stay on the
/// thread that made them, the event loop's.
struct StorePage {
    controller: ICoreWebView2Controller,
    core: ICoreWebView2,
    /// Where the extension's pages live, `chrome-extension://<id>/`.
    base: String,
    page: settings::Page,
}

thread_local! {
    /// A slot goes empty once its page is closed; the others keep their place, which the callbacks name.
    static STORE_PAGES: RefCell<Vec<Option<StorePage>>> = const { RefCell::new(Vec::new()) };
    /// Pages asked for whose creation has not answered yet, so polling does not stop before
    /// they exist.
    static PENDING_PAGES: std::cell::Cell<usize> = const { std::cell::Cell::new(0) };
}

/// A first page never waits longer than this for the extensions to be added.
const READY_TIMEOUT: Duration = Duration::from_secs(5);

/// Adds every extension under `directory` to the window's profile, then sends
/// the window to `target`.
pub fn install(
    window: &WebviewWindow,
    directory: PathBuf,
    target: Option<Url>,
    incognito: bool,
) -> tauri::Result<()> {
    let opened = Arc::new(AtomicBool::new(target.is_none()));
    if let Some(target) = target.clone() {
        let late = window.clone();
        let opened = opened.clone();
        std::thread::spawn(move || {
            std::thread::sleep(READY_TIMEOUT);
            if !opened.swap(true, Ordering::SeqCst) {
                eprintln!("[Pake] Extensions are still loading; opening the page without them");
                if let Err(error) = late.navigate(target) {
                    eprintln!("[Pake] Failed to open the page: {error}");
                }
            }
        });
    }
    // A launch that asked for an extension's page gets it once they are in.
    // A second launch may already have left its own request here.
    if let Some(id) = requested_settings(&std::env::args().collect::<Vec<_>>()) {
        if let Ok(mut asked) = ASKED.lock() {
            asked.get_or_insert(id);
        }
    }
    let app = window.app_handle().clone();
    window.with_webview(move |webview| {
        let core = match unsafe { webview.controller().CoreWebView2() } {
            Ok(core) => core,
            Err(error) => {
                eprintln!("[Pake] Failed to reach WebView2 for the extensions: {error}");
                return;
            }
        };
        let done = Rc::new(Done {
            core: core.clone(),
            target,
            opened,
            app,
            directory: directory.clone(),
            incognito,
        });
        let profile = unsafe {
            core.cast::<ICoreWebView2_13>()
                .and_then(|core| core.Profile())
                .and_then(|profile| profile.cast::<ICoreWebView2Profile7>())
        };
        let profile = match profile {
            Ok(profile) => profile,
            Err(error) => {
                // A WebView2 too old for extensions: the page opens without them.
                eprintln!("[Pake] This WebView2 cannot add extensions: {error}");
                done.finish(None);
                return;
            }
        };
        let folders = unpacked(&directory);
        let pending = Rc::new(Cell::new(folders.len()));
        let failed = Rc::new(Cell::new(false));
        if folders.is_empty() {
            done.finish(Some(&profile));
            return;
        }
        for folder in folders {
            let name = folder
                .file_name()
                .map(|name| name.to_string_lossy().into_owned())
                .unwrap_or_default();
            // One more is settled, added or not; the last one opens the page.
            let settle = {
                let (pending, failed, done, profile) = (
                    pending.clone(),
                    failed.clone(),
                    done.clone(),
                    profile.clone(),
                );
                move |added: bool| {
                    if !added {
                        failed.set(true);
                    }
                    pending.set(pending.get().saturating_sub(1));
                    if pending.get() == 0 {
                        // Removing what was not added is only safe when all were.
                        done.finish((!failed.get()).then_some(&profile));
                    }
                }
            };
            let report = settle.clone();
            let handler_name = name.clone();
            let started = unsafe {
                profile.AddBrowserExtension(
                    &HSTRING::from(folder.as_os_str()),
                    &ProfileAddBrowserExtensionCompletedHandler::create(Box::new(
                        move |result, extension| {
                            let id = match (&result, &extension) {
                                (Ok(()), Some(extension)) => identifier(extension),
                                _ => None,
                            };
                            match (&id, ADDED.lock()) {
                                (Some(id), Ok(mut added)) => {
                                    added
                                        .get_or_insert_with(HashMap::new)
                                        .insert(handler_name.clone(), id.clone());
                                }
                                _ => eprintln!(
                                    "[Pake] Could not add the extension {handler_name}: {result:?}"
                                ),
                            }
                            report(id.is_some());
                            Ok(())
                        },
                    )),
                )
            };
            if let Err(error) = started {
                eprintln!("[Pake] Could not add the extension {name}: {error}");
                settle(false);
            }
        }
    })
}

/// What happens once every extension is settled.
struct Done {
    core: ICoreWebView2,
    target: Option<Url>,
    opened: Arc<AtomicBool>,
    app: AppHandle,
    directory: PathBuf,
    incognito: bool,
}

impl Done {
    /// `cleanup` is the profile to drop removed extensions from, when that is safe.
    fn finish(&self, cleanup: Option<&ICoreWebView2Profile7>) {
        open(&self.core, self.target.as_ref(), &self.opened);
        if let Some(profile) = cleanup {
            remove_others(profile);
        }
        READY.store(true, Ordering::SeqCst);
        let asked = ASKED.lock().ok().and_then(|mut asked| asked.take());
        if let Some(id) = asked {
            open_page(&self.app, &id);
        }
        start_settings(&self.app, &self.core, &self.directory, self.incognito);
    }
}

/// Opens Pake's page of every added extension that has one, out of sight, and
/// asks each one every `settings::INTERVAL` whether there is news.
fn start_settings(
    app: &AppHandle,
    core: &ICoreWebView2,
    directory: &std::path::Path,
    incognito: bool,
) {
    // The pages need a parent window, never shown in it: the app's own.
    let Some(Ok(hwnd)) = app.get_webview_window("pake").map(|window| window.hwnd()) else {
        return;
    };
    let added: HashMap<String, String> = ADDED
        .lock()
        .ok()
        .and_then(|added| added.clone())
        .unwrap_or_default();
    let wanted: Vec<(String, String, Mode)> = unpacked(directory)
        .iter()
        .filter_map(|folder| {
            let name = settings::folder_name(folder);
            let mode = settings::mode(folder, incognito)?;
            let id = added.get(&name)?.clone();
            Some((name, format!("chrome-extension://{id}/"), mode))
        })
        .collect();
    if wanted.is_empty() {
        return;
    }
    let made = (|| unsafe {
        let environment = core
            .cast::<ICoreWebView2_2>()?
            .Environment()?
            .cast::<ICoreWebView2Environment10>()?;
        let profile: ICoreWebView2Profile = core.cast::<ICoreWebView2_13>()?.Profile()?;
        let mut profile_name = PWSTR::null();
        profile.ProfileName(&mut profile_name)?;
        let mut private = windows_core::BOOL::default();
        profile.IsInPrivateModeEnabled(&mut private)?;
        let options = environment.CreateCoreWebView2ControllerOptions()?;
        options.SetProfileName(&HSTRING::from(take_pwstr(profile_name)))?;
        options.SetIsInPrivateModeEnabled(private.as_bool())?;
        PENDING_PAGES.set(wanted.len());
        for (name, base, mode) in wanted {
            let incognito_page = incognito;
            let label = name.clone();
            let asked = environment.CreateCoreWebView2ControllerWithOptions(
                hwnd,
                &options,
                &CreateCoreWebView2ControllerCompletedHandler::create(Box::new(
                    move |result, controller| {
                        PENDING_PAGES.set(PENDING_PAGES.get().saturating_sub(1));
                        let Some(controller) = controller.filter(|_| result.is_ok()) else {
                            eprintln!("[Pake] Could not open the settings page of {name}");
                            stop_when_done();
                            return Ok(());
                        };
                        let opened = (|| {
                            controller.SetIsVisible(false)?;
                            controller.SetBounds(Default::default())?;
                            let core = controller.CoreWebView2()?;
                            core.Navigate(&HSTRING::from(format!(
                                "{base}{}",
                                settings::page_path(mode)
                            )))?;
                            windows_core::Result::Ok(core)
                        })();
                        match opened {
                            Ok(core) => {
                                let page = settings::Page::new(name.clone(), mode, incognito_page);
                                STORE_PAGES.with_borrow_mut(|pages| {
                                    pages.push(Some(StorePage {
                                        controller,
                                        core,
                                        base: base.clone(),
                                        page,
                                    }))
                                });
                            }
                            Err(error) => {
                                eprintln!(
                                    "[Pake] Could not open the settings page of {name}: {error}"
                                );
                                let _ = controller.Close();
                                stop_when_done();
                            }
                        }
                        Ok(())
                    },
                )),
            );
            if let Err(error) = asked {
                eprintln!("[Pake] Could not open the settings page of {label}: {error}");
                PENDING_PAGES.set(PENDING_PAGES.get().saturating_sub(1));
            }
        }
        windows_core::Result::Ok(())
    })();
    if let Err(error) = made {
        eprintln!("[Pake] Could not open the extensions' settings pages: {error}");
        PENDING_PAGES.set(0);
        settings::stop_polling();
        return;
    }
    stop_when_done();
    if !settings::polling() {
        return;
    }
    let app = app.clone();
    std::thread::spawn(move || {
        while settings::polling() {
            std::thread::sleep(settings::INTERVAL);
            let poller = app.clone();
            if app
                .run_on_main_thread(move || poll_settings(&poller))
                .is_err()
            {
                return;
            }
        }
    });
}

/// Runs `script` in `core` and hands its result, as text, to `done`.
fn evaluate(core: &ICoreWebView2, script: &str, done: impl FnOnce(String) + 'static) {
    let result = unsafe {
        core.ExecuteScript(
            &HSTRING::from(script),
            &ExecuteScriptCompletedHandler::create(Box::new(move |result, json| {
                let text = match (result, serde_json::from_str::<serde_json::Value>(&json)) {
                    (Ok(()), Ok(serde_json::Value::String(text))) => text,
                    _ => String::new(),
                };
                done(text);
                Ok(())
            })),
        )
    };
    if let Err(error) = result {
        eprintln!("[Pake] Could not ask a settings page: {error}");
    }
}

fn poll_settings(app: &AppHandle) {
    let cores: Vec<(usize, ICoreWebView2)> = STORE_PAGES.with_borrow(|pages| {
        pages
            .iter()
            .enumerate()
            .filter_map(|(index, page)| Some((index, page.as_ref()?.core.clone())))
            .collect()
    });
    for (index, core) in cores {
        let app = app.clone();
        evaluate(&core, settings::PROBE_SCRIPT, move |answer| {
            settings_answered(&app, index, &answer)
        });
    }
}

fn settings_answered(app: &AppHandle, index: usize, answer: &str) {
    let Some((action, core)) = STORE_PAGES.with_borrow_mut(|pages| {
        let page = pages.get_mut(index)?.as_mut()?;
        Some((page.page.next(answer), page.core.clone()))
    }) else {
        return;
    };
    match action {
        Action::ReadSnapshot => evaluate(&core, settings::SNAPSHOT_SCRIPT, move |snapshot| {
            STORE_PAGES.with_borrow_mut(|pages| {
                if let Some(Some(page)) = pages.get_mut(index) {
                    page.page.save(&snapshot);
                }
            });
        }),
        Action::Restart => {
            evaluate(&core, settings::RESTART_SCRIPT, |_| {});
            let app = app.clone();
            std::thread::spawn(move || {
                std::thread::sleep(settings::RESTART_DELAY);
                let _ = app.run_on_main_thread(move || settings_restarted(index));
            });
        }
        Action::Close => {
            // Taken out first: Close runs after the list is no longer borrowed.
            let closed =
                STORE_PAGES.with_borrow_mut(|pages| pages.get_mut(index).and_then(Option::take));
            if let Some(page) = closed {
                let _ = unsafe { page.controller.Close() };
            }
            stop_when_done();
        }
        Action::Watch => STORE_PAGES.with_borrow(|pages| {
            if let Some(Some(page)) = pages.get(index) {
                navigate(
                    &page.core,
                    &format!("{}{}", page.base, settings::page_path(Mode::Watch)),
                );
            }
        }),
        Action::Nothing => {}
    }
}

/// Stops polling once no page is left and none is still being made.
fn stop_when_done() {
    let empty = STORE_PAGES.with_borrow(|pages| pages.iter().all(Option::is_none));
    if empty && PENDING_PAGES.get() == 0 {
        settings::stop_polling();
    }
}

fn navigate(core: &ICoreWebView2, address: &str) {
    if let Err(error) = unsafe { core.Navigate(&HSTRING::from(address)) } {
        eprintln!("[Pake] Could not load a settings page: {error}");
    }
}

/// The extension has its carried settings and has restarted: Pake's page
/// loads again to follow it, and every page of the app loads again to get it.
fn settings_restarted(index: usize) {
    let closed = STORE_PAGES.with_borrow_mut(|pages| {
        let slot = pages.get_mut(index)?;
        let watching = match slot.as_mut() {
            Some(page) => {
                page.page.restarted();
                page.page.mode == Mode::Watch
            }
            None => return None,
        };
        if watching {
            if let Some(page) = slot.as_ref() {
                navigate(
                    &page.core,
                    &format!("{}{}", page.base, settings::page_path(Mode::Watch)),
                );
            }
            None
        } else {
            // A private window keeps nothing, so its page has nothing left to do.
            slot.take()
        }
    });
    // Closed after the list is no longer borrowed.
    if let Some(page) = closed {
        let _ = unsafe { page.controller.Close() };
    }
    stop_when_done();
    settings::reload_windows();
}

fn open(core: &ICoreWebView2, target: Option<&Url>, opened: &AtomicBool) {
    let Some(target) = target else {
        return;
    };
    if opened.swap(true, Ordering::SeqCst) {
        return;
    }
    if let Err(error) = unsafe { core.Navigate(&HSTRING::from(target.as_str())) } {
        eprintln!("[Pake] Failed to open the page: {error}");
    }
}

fn identifier(extension: &ICoreWebView2BrowserExtension) -> Option<String> {
    let mut id = PWSTR::null();
    unsafe { extension.Id(&mut id) }.ok()?;
    Some(take_pwstr(id))
}

/// The profile keeps an extension until it is removed, so one whose folder is
/// gone from the app would run on. Whatever was not just added goes.
fn remove_others(profile: &ICoreWebView2Profile7) {
    let result = unsafe {
        profile.GetBrowserExtensions(&ProfileGetBrowserExtensionsCompletedHandler::create(
            Box::new(|result, list| {
                result?;
                let Some(list) = list else {
                    return Ok(());
                };
                let kept: Vec<String> = ADDED
                    .lock()
                    .ok()
                    .and_then(|added| added.as_ref().map(|map| map.values().cloned().collect()))
                    .unwrap_or_default();
                let mut count = 0;
                list.Count(&mut count)?;
                for index in 0..count {
                    let extension = list.GetValueAtIndex(index)?;
                    let Some(id) = identifier(&extension) else {
                        continue;
                    };
                    if !kept.contains(&id) {
                        extension.Remove(&BrowserExtensionRemoveCompletedHandler::create(
                            Box::new(move |result| {
                                if let Err(error) = result {
                                    eprintln!(
                                        "[Pake] Could not remove the extension {id}: {error}"
                                    );
                                }
                                Ok(())
                            }),
                        ))?;
                    }
                }
                Ok(())
            }),
        ))
    };
    if let Err(error) = result {
        eprintln!("[Pake] Failed to list the profile's extensions: {error}");
    }
}

/// Shows the settings page of the extension in folder `id` in a window of its
/// own: the popup a browser would hang from its toolbar, or its options page.
pub fn open_page(app: &AppHandle, id: &str) {
    if !READY.load(Ordering::SeqCst) {
        if let Ok(mut asked) = ASKED.lock() {
            *asked = Some(id.to_owned());
        }
        return;
    }
    let Some(state) = app.try_state::<MultiWindowState>() else {
        return;
    };
    let Some(directory) = state.pake_config.runtime_extensions.clone() else {
        return;
    };
    let Some(extension) = installed(&directory)
        .into_iter()
        .find(|extension| extension.id == id)
    else {
        return;
    };
    let added = ADDED
        .lock()
        .ok()
        .and_then(|added| added.as_ref()?.get(id).cloned());
    let (Some(page), Some(added)) = (extension.page, added) else {
        eprintln!("[Pake] The extension {id} has no page to show");
        return;
    };
    let Ok(url) = Url::parse(&format!("chrome-extension://{added}/{page}")) else {
        return;
    };
    // Off the event loop: building a window from inside a WebView2 callback
    // or the single-instance handler would wait on the loop it is running on.
    let app = app.clone();
    std::thread::spawn(move || {
        if let Err(error) = crate::app::window::open_extension_window(&app, url, &extension.name) {
            eprintln!(
                "[Pake] Failed to open the page of {}: {error}",
                extension.name
            );
        }
    });
}
