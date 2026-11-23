//! Carrying an extension's settings into a built app.
//!
//! The app builder puts a page of its own, `pake-settings.html`, into each
//! extension whose settings it may carry. The runtime keeps that page open out
//! of sight. The page holds a copy of the extension's storage, which the
//! runtime writes to `<app data>/extension-settings/<folder>.json` whenever it
//! changes, for the builder to read when it builds the app again. A built app
//! carries such a copy as `pake-settings.json` in the extension's folder. On a
//! machine whose storage never held that copy, the first launch writes it into
//! the extension's storage, restarts the extension and reloads the app's pages.
//!
//! The page speaks through `window.pakeSettings`: `state` (`ready` once its
//! copy is current, `written` once a carried copy is in storage, `failed`),
//! `version`, which grows with every new copy, `id`, the copy's digest, and
//! `snapshot`, the copy as JSON. `restart()` restarts the extension.

use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::OnceLock;
use std::time::Duration;

use tauri::{AppHandle, Manager};

pub const PAGE: &str = "pake-settings.html";
pub const PRESET: &str = "pake-settings.json";
/// How often the runtime asks the page whether there is something new.
pub const INTERVAL: Duration = Duration::from_secs(2);
/// How long a restarting extension gets before the page and the app's pages load again.
pub const RESTART_DELAY: Duration = Duration::from_secs(2);

pub const PROBE_SCRIPT: &str =
    "window.pakeSettings ? [pakeSettings.state, pakeSettings.version, pakeSettings.id].join(' ') : ''";
pub const SNAPSHOT_SCRIPT: &str = "window.pakeSettings ? pakeSettings.snapshot : ''";
pub const RESTART_SCRIPT: &str = "window.pakeSettings && pakeSettings.restart(); 0";

/// The digests a store held, newest last; older ones fall off past this many.
/// A carried copy is decided by `<name>.applied`, which never drops one.
const REMEMBERED: usize = 64;

static STORE: OnceLock<PathBuf> = OnceLock::new();
static APP: OnceLock<AppHandle> = OnceLock::new();
/// The hosts' pollers run while this holds; a host clears it once it has no page left to ask.
static POLLING: AtomicBool = AtomicBool::new(true);

/// Where the copies and the digests go: the app's own data folder.
pub fn set_store(app: &AppHandle, directory: PathBuf) {
    let _ = STORE.set(directory.join("extension-settings"));
    let _ = APP.set(app.clone());
}

pub fn polling() -> bool {
    POLLING.load(Ordering::Relaxed)
}

pub fn stop_polling() {
    POLLING.store(false, Ordering::Relaxed);
}

/// The app's own windows, which load again once an extension has its carried settings:
/// the first and any later one, never a sign-in popup, whose half-done sign-in a reload loses.
pub fn reloadable(label: &str) -> bool {
    label == "pake"
        || (label.starts_with("pake-")
            && !label.starts_with(crate::app::window::POPUP_WINDOW_LABEL_PREFIX))
}

/// Loads a page again once it has finished loading, so a page still on its way in is not cut off
/// and still ends up with what the extension now holds. A window on its first blank page is on
/// its way to the site, which it reaches with the restarted extension, so it is left alone.
pub const RELOAD_SCRIPT: &str = "(() => { if (location.protocol === 'about:') return; \
const again = () => location.reload(); \
if (document.readyState === 'complete') again(); \
else addEventListener('load', again, { once: true }); })();";

/// For a web view the host knows is navigating: a document still loading is loaded again once
/// it has finished, and a finished one is left, since the navigation under way is to a new page
/// that comes up with the restarted extension, and reloading would drop it.
#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
pub const NAVIGATING_RELOAD_SCRIPT: &str = "(() => { if (location.protocol === 'about:') return; \
if (document.readyState === 'complete') return; \
addEventListener('load', () => location.reload(), { once: true }); })();";

/// The app's own windows, those a carried copy loads again.
pub fn own_windows() -> Vec<(String, tauri::WebviewWindow)> {
    let Some(app) = APP.get() else {
        return Vec::new();
    };
    app.webview_windows()
        .into_iter()
        .filter(|(label, _)| reloadable(label))
        .collect()
}

/// Loads each of the app's own windows again, after an extension took its carried settings.
#[cfg_attr(target_os = "macos", allow(dead_code))]
pub fn reload_windows() {
    for (label, window) in own_windows() {
        if let Err(error) = window.eval(RELOAD_SCRIPT) {
            eprintln!("[Pake] Could not reload {label} for the extension settings: {error}");
        }
    }
}

fn store() -> Option<&'static PathBuf> {
    STORE.get()
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Mode {
    /// Write the carried copy into storage, then restart the extension.
    Apply,
    /// The extension is restarting after that.
    Restarting,
    /// Keep the copy on disk current.
    Watch,
}

/// What to do with the extension in `folder`, or `None` when it has no page of
/// Pake's. In a private window nothing is kept, and a carried copy is written
/// on every launch, since the storage starts empty each time.
pub fn mode(folder: &Path, incognito: bool) -> Option<Mode> {
    if !folder.join(PAGE).is_file() {
        return None;
    }
    let name = folder_name(folder);
    if let Some(id) = preset_id(folder) {
        if incognito {
            return Some(Mode::Apply);
        }
        if !applied(&name).contains(&id) {
            // Built from a copy this store saved: the store already holds it.
            if !remembered(&name).contains(&id) {
                return Some(Mode::Apply);
            }
            mark_applied(&name, &id);
        }
    }
    (!incognito).then_some(Mode::Watch)
}

/// The page's address inside the extension for `mode`.
pub fn page_path(mode: Mode) -> String {
    match mode {
        Mode::Apply => format!("{PAGE}#apply"),
        _ => PAGE.to_owned(),
    }
}

pub fn folder_name(folder: &Path) -> String {
    folder
        .file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .unwrap_or_default()
}

fn preset_id(folder: &Path) -> Option<String> {
    let text = std::fs::read_to_string(folder.join(PRESET)).ok()?;
    let value: serde_json::Value = serde_json::from_str(&text).ok()?;
    value
        .get("id")?
        .as_str()
        .filter(|id| !id.is_empty())
        .map(str::to_owned)
}

#[derive(Debug, PartialEq, Eq)]
struct Probe {
    state: String,
    id: String,
}

fn parse(probe: &str) -> Option<Probe> {
    let mut parts = probe.split_whitespace();
    let state = parts.next()?.to_owned();
    let _version = parts.next()?;
    let id = parts.next().unwrap_or_default().to_owned();
    Some(Probe { state, id })
}

#[derive(Debug, PartialEq, Eq)]
pub enum Action {
    Nothing,
    /// Read `SNAPSHOT_SCRIPT` and pass it to `Page::save`.
    ReadSnapshot,
    /// Writing the carried copy failed: load the page again without `#apply`, so this
    /// launch still keeps a copy; the next launch tries the carried one again.
    Watch,
    /// Writing the carried copy failed in a private window, which keeps nothing: close the page.
    Close,
    /// Run `RESTART_SCRIPT`, then after `RESTART_DELAY` load the page again
    /// without `#apply`, reload the app's pages and call `Page::restarted`.
    Restart,
}

/// One extension's page as the runtime follows it.
pub struct Page {
    pub name: String,
    pub mode: Mode,
    incognito: bool,
    written: String,
}

impl Page {
    pub fn new(name: String, mode: Mode, incognito: bool) -> Self {
        Self {
            name,
            mode,
            incognito,
            written: String::new(),
        }
    }

    /// What the page's answer to `PROBE_SCRIPT` asks for.
    pub fn next(&mut self, probe: &str) -> Action {
        let Some(probe) = parse(probe) else {
            return Action::Nothing;
        };
        match self.mode {
            Mode::Apply if probe.state == "written" => {
                if !self.incognito {
                    remember(&self.name, &probe.id);
                    mark_applied(&self.name, &probe.id);
                }
                self.mode = Mode::Restarting;
                Action::Restart
            }
            Mode::Apply if probe.state == "failed" => {
                if self.incognito {
                    self.mode = Mode::Restarting;
                    Action::Close
                } else {
                    self.mode = Mode::Watch;
                    Action::Watch
                }
            }
            Mode::Watch
                if probe.state == "ready"
                    && !self.incognito
                    && !probe.id.is_empty()
                    && probe.id != self.written =>
            {
                Action::ReadSnapshot
            }
            _ => Action::Nothing,
        }
    }

    pub fn restarted(&mut self) {
        self.mode = if self.incognito {
            Mode::Restarting
        } else {
            Mode::Watch
        };
    }

    /// Writes the page's copy, a JSON object with its `id`, for the builder.
    pub fn save(&mut self, snapshot: &str) {
        let Some(id) = serde_json::from_str::<serde_json::Value>(snapshot)
            .ok()
            .and_then(|value| value.get("id")?.as_str().map(str::to_owned))
        else {
            return;
        };
        let Some(store) = store() else {
            return;
        };
        match write(store, &self.name, snapshot) {
            Ok(()) => {
                remember(&self.name, &id);
                self.written = id;
            }
            Err(error) => eprintln!(
                "[Pake] Could not keep the settings of the extension {}: {error}",
                self.name
            ),
        }
    }
}

fn write(store: &Path, name: &str, snapshot: &str) -> std::io::Result<()> {
    write_whole(&store.join(format!("{name}.json")), snapshot)
}

/// Writes beside the file and moves it into place, so a cut-off write never leaves half a file.
fn write_whole(target: &Path, text: &str) -> std::io::Result<()> {
    if let Some(parent) = target.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let mut partial = target.as_os_str().to_owned();
    partial.push(".partial");
    std::fs::write(&partial, text)?;
    std::fs::rename(&partial, target)
}

fn list_file(name: &str, kind: &str) -> Option<PathBuf> {
    store().map(|store| store.join(format!("{name}.{kind}")))
}

fn read_list(name: &str, kind: &str) -> Vec<String> {
    list_file(name, kind)
        .and_then(|file| std::fs::read_to_string(file).ok())
        .map(|text| text.lines().map(str::to_owned).collect())
        .unwrap_or_default()
}

fn add_to_list(name: &str, kind: &str, id: &str, keep: usize) {
    let Some(file) = list_file(name, kind) else {
        return;
    };
    let mut ids = read_list(name, kind);
    if id.is_empty() || ids.iter().any(|known| known == id) {
        return;
    }
    ids.push(id.to_owned());
    let start = ids.len().saturating_sub(keep);
    if let Err(error) = write_whole(&file, &(ids[start..].join("\n") + "\n")) {
        eprintln!("[Pake] Could not note the settings of the extension {name}: {error}");
    }
}

/// The digests of the latest copies this app's storage has held for the extension.
fn remembered(name: &str) -> Vec<String> {
    read_list(name, "ids")
}

fn remember(name: &str, id: &str) {
    add_to_list(name, "ids", id, REMEMBERED);
}

/// The carried copies this store has taken in, each once and for good: one written
/// back after the person changed things would undo what they changed.
fn applied(name: &str) -> Vec<String> {
    read_list(name, "applied")
}

fn mark_applied(name: &str, id: &str) {
    add_to_list(name, "applied", id, usize::MAX);
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn setup(name: &str) -> (PathBuf, PathBuf) {
        let root = std::env::temp_dir().join(format!(
            "pake-extension-settings-{name}-{}",
            std::process::id()
        ));
        let _ = fs::remove_dir_all(&root);
        let folder = root.join("extensions").join(name);
        fs::create_dir_all(&folder).unwrap();
        // One store for the whole test binary; each test uses its own folder name. It starts
        // empty, since a later run can get the same process id.
        static FRESH: std::sync::Once = std::sync::Once::new();
        let store = std::env::temp_dir().join(format!(
            "pake-extension-settings-store-{}",
            std::process::id()
        ));
        FRESH.call_once(|| {
            let _ = fs::remove_dir_all(&store);
        });
        let _ = STORE.set(store);
        (root, folder)
    }

    #[test]
    fn an_extension_without_the_page_is_left_alone() {
        let (_root, folder) = setup("no-page");
        assert_eq!(mode(&folder, false), None);
        fs::write(folder.join(PRESET), r#"{"id":"a1","local":{}}"#).unwrap();
        assert_eq!(mode(&folder, false), None);
    }

    #[test]
    fn a_carried_copy_is_written_once_per_store() {
        let (_root, folder) = setup("carried-once");
        fs::write(folder.join(PAGE), "").unwrap();
        assert_eq!(mode(&folder, false), Some(Mode::Watch));
        fs::write(folder.join(PRESET), r#"{"id":"carried-once-1","local":{}}"#).unwrap();
        assert_eq!(mode(&folder, false), Some(Mode::Apply));

        let mut page = Page::new("carried-once".into(), Mode::Apply, false);
        assert_eq!(page.next("loading 0 "), Action::Nothing);
        assert_eq!(page.next("written 1 carried-once-1"), Action::Restart);
        page.restarted();
        assert_eq!(page.mode, Mode::Watch);
        // The next launch finds the copy already held.
        assert_eq!(mode(&folder, false), Some(Mode::Watch));
    }

    #[test]
    fn a_private_window_writes_the_copy_every_time_and_keeps_nothing() {
        let (_root, folder) = setup("private");
        fs::write(folder.join(PAGE), "").unwrap();
        assert_eq!(mode(&folder, true), None);
        fs::write(folder.join(PRESET), r#"{"id":"private-1","local":{}}"#).unwrap();
        let mut page = Page::new("private".into(), Mode::Apply, true);
        assert_eq!(page.next("written 1 private-1"), Action::Restart);
        assert_eq!(mode(&folder, true), Some(Mode::Apply));
        page.restarted();
        assert_eq!(page.next("ready 2 private-2"), Action::Nothing);
    }

    #[test]
    fn a_new_copy_is_saved_and_a_build_from_it_is_not_written_back() {
        let (_root, folder) = setup("watched");
        fs::write(folder.join(PAGE), "").unwrap();
        let mut page = Page::new("watched".into(), Mode::Watch, false);
        assert_eq!(page.next("ready 1 watched-1"), Action::ReadSnapshot);
        page.save(r#"{"id":"watched-1","local":{"site.example.com":["p"]}}"#);
        assert_eq!(page.next("ready 1 watched-1"), Action::Nothing);
        assert_eq!(page.next("ready 2 watched-2"), Action::ReadSnapshot);
        let saved = fs::read_to_string(store().unwrap().join("watched.json")).unwrap();
        assert!(saved.contains("site.example.com"));

        // An app built from the first copy, after the second, keeps the second.
        fs::write(folder.join(PRESET), r#"{"id":"watched-1","local":{}}"#).unwrap();
        assert_eq!(mode(&folder, false), Some(Mode::Watch));
    }

    #[test]
    fn a_carried_copy_is_never_written_again_however_much_changes_after() {
        let (_root, folder) = setup("many-changes");
        fs::write(folder.join(PAGE), "").unwrap();
        fs::write(folder.join(PRESET), r#"{"id":"many-1","local":{}}"#).unwrap();
        let mut page = Page::new("many-changes".into(), Mode::Apply, false);
        assert_eq!(page.next("written 1 many-1"), Action::Restart);
        page.restarted();
        for n in 0..REMEMBERED + 10 {
            let id = format!("many-change-{n}");
            assert_eq!(page.next(&format!("ready {n} {id}")), Action::ReadSnapshot);
            page.save(&format!(r#"{{"id":"{id}","local":{{}}}}"#));
        }
        assert!(!remembered("many-changes").contains(&"many-1".to_owned()));
        assert_eq!(mode(&folder, false), Some(Mode::Watch));
    }

    #[test]
    fn a_build_from_this_stores_own_copy_is_taken_as_held() {
        let (_root, folder) = setup("own-copy");
        fs::write(folder.join(PAGE), "").unwrap();
        let mut page = Page::new("own-copy".into(), Mode::Watch, false);
        assert_eq!(page.next("ready 1 own-1"), Action::ReadSnapshot);
        page.save(r#"{"id":"own-1","local":{}}"#);
        fs::write(folder.join(PRESET), r#"{"id":"own-1","local":{}}"#).unwrap();
        assert_eq!(mode(&folder, false), Some(Mode::Watch));
        // Noted for good on that launch, so later changes cannot bring it back.
        assert!(applied("own-copy").contains(&"own-1".to_owned()));
    }

    #[test]
    fn a_copy_that_cannot_be_written_still_lets_the_launch_keep_one() {
        let mut page = Page::new("refused".into(), Mode::Apply, false);
        assert_eq!(page.next("failed 0 "), Action::Watch);
        assert_eq!(page.mode, Mode::Watch);
        let mut private = Page::new("refused-private".into(), Mode::Apply, true);
        assert_eq!(private.next("failed 0 "), Action::Close);
    }

    #[test]
    fn only_the_apps_own_windows_load_again() {
        assert!(reloadable("pake"));
        assert!(reloadable("pake-2"));
        assert!(!reloadable("pake-popup-1"));
        assert!(!reloadable("extension-settings"));
    }

    #[test]
    fn a_page_that_answers_nothing_asks_for_nothing() {
        let mut page = Page::new("silent".into(), Mode::Watch, false);
        assert_eq!(page.next(""), Action::Nothing);
        assert_eq!(page.next("failed 0 "), Action::Nothing);
    }
}
