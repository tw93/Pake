//! Windows. WebView2 keeps an unpacked extension in the app's own profile once
//! it is added, and runs its content scripts only in pages opened after that.
//! So the first window waits blank until every folder has been added, then
//! opens its page.

use super::{installed, requested_settings, unpacked};
use crate::app::window::MultiWindowState;
use std::cell::Cell;
use std::collections::HashMap;
use std::path::PathBuf;
use std::rc::Rc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Manager, Url, WebviewWindow};
use webview2_com::Microsoft::Web::WebView2::Win32::{
    ICoreWebView2, ICoreWebView2BrowserExtension, ICoreWebView2Profile7, ICoreWebView2_13,
};
use webview2_com::{
    take_pwstr, BrowserExtensionRemoveCompletedHandler, ProfileAddBrowserExtensionCompletedHandler,
    ProfileGetBrowserExtensionsCompletedHandler,
};
use windows_core::{Interface, HSTRING, PWSTR};

/// Folder name to the id WebView2 gave the extension, which its pages live under.
static ADDED: Mutex<Option<HashMap<String, String>>> = Mutex::new(None);
/// Set once every extension is settled; a page asked for earlier waits in `ASKED`.
static READY: AtomicBool = AtomicBool::new(false);
static ASKED: Mutex<Option<String>> = Mutex::new(None);

/// A first page never waits longer than this for the extensions to be added.
const READY_TIMEOUT: Duration = Duration::from_secs(5);

/// Adds every extension under `directory` to the window's profile, then sends
/// the window to `target`.
pub fn install(
    window: &WebviewWindow,
    directory: PathBuf,
    target: Option<Url>,
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
    }
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
