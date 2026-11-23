//! Browser extensions for a runtime app, on macOS 15.4 and later and on
//! Windows. Linux has none: WebKitGTK does not run WebExtensions.
//!
//! Nothing here runs unless `pake-runtime/extensions` holds an unpacked
//! extension; an app without that folder builds its webviews as before.

use std::path::{Path, PathBuf};

#[cfg_attr(not(any(target_os = "macos", target_os = "windows")), allow(dead_code))]
pub mod settings;

#[cfg(target_os = "macos")]
mod macos;
#[cfg(target_os = "macos")]
pub use macos::{configuration, open_page, register, supported, when_ready};

#[cfg(target_os = "windows")]
mod windows;
#[cfg(target_os = "windows")]
pub use windows::{install, open_page};

/// The unpacked extensions under `directory`: every folder with a manifest,
/// in name order so they load the same way each time.
pub fn unpacked(directory: &Path) -> Vec<PathBuf> {
    let Ok(entries) = std::fs::read_dir(directory) else {
        return Vec::new();
    };
    let mut folders: Vec<PathBuf> = entries
        .filter_map(|entry| entry.ok().map(|entry| entry.path()))
        .filter(|path| path.join("manifest.json").is_file())
        .collect();
    folders.sort();
    folders
}

/// What the app shows for one extension: its folder name, the name its
/// manifest gives it, and the page where its settings are.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Installed {
    pub id: String,
    pub name: String,
    pub page: Option<String>,
}

/// The argument a second launch passes to open one extension's page, as in
/// `--extension-settings=dark-reader`. Windows has no menu bar to offer them.
#[cfg_attr(not(target_os = "windows"), allow(dead_code))]
pub const SETTINGS_ARGUMENT: &str = "--extension-settings=";

#[cfg_attr(not(target_os = "windows"), allow(dead_code))]
pub fn requested_settings(arguments: &[String]) -> Option<String> {
    arguments
        .iter()
        .find_map(|argument| argument.strip_prefix(SETTINGS_ARGUMENT))
        .filter(|id| !id.is_empty())
        .map(str::to_owned)
}

pub fn installed(directory: &Path) -> Vec<Installed> {
    unpacked(directory)
        .into_iter()
        .filter_map(|folder| {
            let id = folder.file_name()?.to_string_lossy().into_owned();
            let manifest: serde_json::Value =
                serde_json::from_str(&std::fs::read_to_string(folder.join("manifest.json")).ok()?)
                    .ok()?;
            let name = display_name(&folder, &manifest).unwrap_or_else(|| id.clone());
            Some(Installed {
                id,
                name,
                page: settings_page(&manifest),
            })
        })
        .collect()
}

/// The popup a browser shows from the toolbar when there is one, since that
/// is where an extension puts what people change most, else its options page.
fn settings_page(manifest: &serde_json::Value) -> Option<String> {
    [
        "/action/default_popup",
        "/browser_action/default_popup",
        "/options_ui/page",
        "/options_page",
    ]
    .iter()
    .find_map(|pointer| manifest.pointer(pointer)?.as_str())
    .map(|page| page.trim_start_matches('/').to_owned())
    .filter(|page| !page.is_empty())
}

/// A manifest names itself outright or as `__MSG_key__`, a key into the
/// messages of its default locale.
fn display_name(folder: &Path, manifest: &serde_json::Value) -> Option<String> {
    let name = manifest.get("name")?.as_str()?;
    let Some(key) = name
        .strip_prefix("__MSG_")
        .and_then(|rest| rest.strip_suffix("__"))
    else {
        return Some(name.to_owned());
    };
    let locale = manifest.get("default_locale")?.as_str()?;
    let messages: serde_json::Value = serde_json::from_str(
        &std::fs::read_to_string(folder.join("_locales").join(locale).join("messages.json"))
            .ok()?,
    )
    .ok()?;
    messages
        .as_object()?
        .iter()
        .find(|(candidate, _)| candidate.eq_ignore_ascii_case(key))
        .and_then(|(_, entry)| entry.get("message")?.as_str())
        .map(str::to_owned)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn folder(name: &str) -> PathBuf {
        let directory =
            std::env::temp_dir().join(format!("pake-extensions-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&directory);
        fs::create_dir_all(&directory).unwrap();
        directory
    }

    #[test]
    fn lists_extensions_with_their_name_and_settings_page() {
        let directory = folder("list");
        let plain = directory.join("b-plain");
        fs::create_dir_all(&plain).unwrap();
        fs::write(
            plain.join("manifest.json"),
            r#"{"name":"Plain","options_ui":{"page":"/options.html"}}"#,
        )
        .unwrap();
        let localized = directory.join("a-localized");
        fs::create_dir_all(localized.join("_locales/en")).unwrap();
        fs::write(
            localized.join("manifest.json"),
            r#"{"name":"__MSG_extName__","default_locale":"en",
                "action":{"default_popup":"popup.html"},"options_page":"options.html"}"#,
        )
        .unwrap();
        fs::write(
            localized.join("_locales/en/messages.json"),
            r#"{"extname":{"message":"Localized"}}"#,
        )
        .unwrap();
        // No manifest: not an extension.
        fs::create_dir_all(directory.join("c-empty")).unwrap();
        // No page and a name it cannot resolve: listed under its folder name.
        let bare = directory.join("d-bare");
        fs::create_dir_all(&bare).unwrap();
        fs::write(bare.join("manifest.json"), r#"{"name":"__MSG_missing__"}"#).unwrap();

        assert_eq!(
            installed(&directory),
            vec![
                Installed {
                    id: "a-localized".into(),
                    name: "Localized".into(),
                    page: Some("popup.html".into()),
                },
                Installed {
                    id: "b-plain".into(),
                    name: "Plain".into(),
                    page: Some("options.html".into()),
                },
                Installed {
                    id: "d-bare".into(),
                    name: "d-bare".into(),
                    page: None,
                },
            ]
        );
        fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn reads_the_settings_argument() {
        let arguments = |list: &[&str]| list.iter().map(|s| s.to_string()).collect::<Vec<_>>();
        assert_eq!(
            requested_settings(&arguments(&[
                "pake.exe",
                "--extension-settings=dark-reader"
            ])),
            Some("dark-reader".into())
        );
        assert_eq!(requested_settings(&arguments(&["pake.exe"])), None);
        assert_eq!(
            requested_settings(&arguments(&["pake.exe", "--extension-settings="])),
            None
        );
    }
}
