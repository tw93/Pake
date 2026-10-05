use crate::app::config::PakeConfig;
use crate::app::window::MultiWindowState;
use std::env;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Config, Manager, WebviewWindow};

pub fn get_pake_config() -> (PakeConfig, Config, Option<RuntimeApp>) {
    #[cfg(feature = "cli-build")]
    let pake_config: PakeConfig = serde_json::from_str(include_str!("../.pake/pake.json"))
        .expect("Failed to parse pake config");

    #[cfg(not(feature = "cli-build"))]
    let pake_config: PakeConfig =
        serde_json::from_str(include_str!("../pake.json")).expect("Failed to parse pake config");

    #[cfg(feature = "cli-build")]
    let tauri_config: Config = serde_json::from_str(include_str!("../.pake/tauri.conf.json"))
        .expect("Failed to parse tauri config");

    #[cfg(not(feature = "cli-build"))]
    let tauri_config: Config = serde_json::from_str(include_str!("../tauri.conf.json"))
        .expect("Failed to parse tauri config");

    // Only the prebuilt template reads a runtime override; CLI-built apps keep
    // their compiled configuration even if a pake-runtime folder appears.
    #[cfg(feature = "runtime-template")]
    let runtime_dir = env::current_exe()
        .ok()
        .and_then(|exe| runtime_dir_for_exe(&exe));
    #[cfg(not(feature = "runtime-template"))]
    let runtime_dir: Option<PathBuf> = None;
    match apply_runtime_override(pake_config, tauri_config, runtime_dir.as_deref()) {
        Ok(configs) => configs,
        Err(error) => {
            eprintln!("[Pake] Invalid runtime configuration: {error}");
            std::process::exit(1);
        }
    }
}

const RUNTIME_DIR: &str = "pake-runtime";

/// App identity supplied next to a runtime `pake.json`.
#[derive(Clone, Debug, PartialEq, Eq, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeApp {
    pub identifier: String,
    pub product_name: String,
}

/// macOS keeps overrides in `Contents/Resources/pake-runtime`; other platforms
/// use `pake-runtime` next to the executable.
#[cfg_attr(not(feature = "runtime-template"), allow(dead_code))]
fn runtime_dir_for_exe(exe: &Path) -> Option<PathBuf> {
    let exe_dir = exe.parent()?;
    #[cfg(target_os = "macos")]
    let base = exe_dir.parent()?.join("Resources");
    #[cfg(not(target_os = "macos"))]
    let base = exe_dir.to_path_buf();
    Some(base.join(RUNTIME_DIR))
}

fn read_optional(path: &Path) -> Result<Option<String>, String> {
    match std::fs::read_to_string(path) {
        Ok(contents) => Ok(Some(contents)),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(format!("cannot read {}: {error}", path.display())),
    }
}

/// Without `pake-runtime/pake.json` the compiled configuration is returned
/// unchanged. When it exists, `app.json` is required and both must parse.
fn apply_runtime_override(
    mut pake_config: PakeConfig,
    mut tauri_config: Config,
    runtime_dir: Option<&Path>,
) -> Result<(PakeConfig, Config, Option<RuntimeApp>), String> {
    let Some(dir) = runtime_dir else {
        return Ok((pake_config, tauri_config, None));
    };
    let pake_path = dir.join("pake.json");
    let Some(pake_json) = read_optional(&pake_path)? else {
        return Ok((pake_config, tauri_config, None));
    };
    let app_path = dir.join("app.json");
    let app_json =
        read_optional(&app_path)?.ok_or_else(|| format!("{} is missing", app_path.display()))?;

    pake_config = serde_json::from_str(&pake_json)
        .map_err(|error| format!("cannot parse {}: {error}", pake_path.display()))?;
    if pake_config.windows.is_empty() {
        return Err(format!("{} defines no windows", pake_path.display()));
    }
    let app: RuntimeApp = serde_json::from_str(&app_json)
        .map_err(|error| format!("cannot parse {}: {error}", app_path.display()))?;
    if app.identifier.trim().is_empty() || app.product_name.trim().is_empty() {
        return Err(format!(
            "{} needs a non-empty identifier and productName",
            app_path.display()
        ));
    }
    // The identifier names per-app folders and the Windows AppUserModelID.
    if !is_valid_identifier(&app.identifier) {
        return Err(format!(
            "{} has an invalid identifier {:?}",
            app_path.display(),
            app.identifier
        ));
    }

    pake_config.runtime_custom_js = read_optional(&dir.join("custom.js"))?;
    if !pake_config.system_tray_path.is_empty()
        && Path::new(&pake_config.system_tray_path).is_relative()
    {
        pake_config.system_tray_path = dir
            .join(&pake_config.system_tray_path)
            .to_string_lossy()
            .into_owned();
    }
    pake_config.runtime_app = true;
    tauri_config.identifier = app.identifier.clone();
    tauri_config.product_name = Some(app.product_name.clone());
    Ok((pake_config, tauri_config, Some(app)))
}

/// Same rule as the CLI's --identifier check, capped at the 128 characters an
/// AppUserModelID allows.
fn is_valid_identifier(id: &str) -> bool {
    let bytes = id.as_bytes();
    id.len() <= 128
        && bytes.first().is_some_and(u8::is_ascii_alphabetic)
        && bytes.last().is_some_and(u8::is_ascii_alphanumeric)
        && bytes
            .iter()
            .all(|b| b.is_ascii_alphanumeric() || *b == b'.' || *b == b'-')
}

/// Folder under the config dir that holds the WebView profile (WebView2's
/// EBWebView on Windows). CLI apps keep their product-name folder; a runtime
/// app uses its identifier so a rename keeps its logins and a generated name
/// cannot land in another program's folder.
pub fn data_dir_name(pake_config: &PakeConfig, tauri_config: &Config) -> String {
    if pake_config.runtime_app {
        tauri_config.identifier.clone()
    } else {
        tauri_config
            .product_name
            .clone()
            .unwrap_or_else(|| "pake".to_string())
    }
}

/// The Windows AppUserModelID a runtime app sets before creating windows, so
/// a shortcut carrying the identifier groups with the running window and
/// toasts (sent under the identifier) are attributed to it. CLI apps keep the
/// shell's default.
#[cfg_attr(not(windows), allow(dead_code))]
pub fn app_user_model_id(runtime_app: Option<&RuntimeApp>) -> Option<&str> {
    runtime_app.map(|app| app.identifier.as_str())
}

/// Must run before any window exists; the shell reads the ID at window creation.
#[cfg(windows)]
pub fn set_app_user_model_id(id: &str) {
    use windows_sys::Win32::UI::Shell::SetCurrentProcessExplicitAppUserModelID;
    let wide: Vec<u16> = id.encode_utf16().chain(std::iter::once(0)).collect();
    // SAFETY: `wide` is a NUL-terminated UTF-16 buffer that outlives the call.
    let result = unsafe { SetCurrentProcessExplicitAppUserModelID(wide.as_ptr()) };
    if result < 0 {
        eprintln!("[Pake] Could not set the AppUserModelID {id}: HRESULT {result:#010x}");
    }
}

pub fn get_data_dir(app: &AppHandle, package_name: String) -> std::io::Result<PathBuf> {
    let data_dir = app
        .path()
        .config_dir()
        .map_err(|err| {
            std::io::Error::new(
                std::io::ErrorKind::NotFound,
                format!("Failed to resolve config dir: {err}"),
            )
        })?
        .join(package_name);

    if !data_dir.exists() {
        std::fs::create_dir_all(&data_dir).map_err(|err| {
            std::io::Error::new(
                err.kind(),
                format!("Can't create dir {}: {err}", data_dir.display()),
            )
        })?;
    }

    Ok(data_dir)
}

pub fn read_last_url(path: &Path) -> std::io::Result<Option<tauri::Url>> {
    match std::fs::read_to_string(path) {
        Ok(value) => Ok(tauri::Url::parse(&value)
            .ok()
            .filter(|url| matches!(url.scheme(), "http" | "https"))),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(error),
    }
}

pub fn write_last_url(path: &Path, url: &tauri::Url) -> std::io::Result<()> {
    if matches!(url.scheme(), "http" | "https") {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        std::fs::write(path, url.as_str())?;
    }
    Ok(())
}

/// Both native and IPC downloads use the trusted, packaged configuration.
pub fn get_download_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let state = app
        .try_state::<MultiWindowState>()
        .ok_or("Missing app download configuration")?;
    let configured = &state.pake_config.download_dir;
    let directory = if configured.is_empty() {
        app.path().download_dir().map_err(|e| e.to_string())?
    } else {
        let home = if configured == "~" || configured.starts_with("~/") {
            Some(app.path().home_dir().map_err(|e| e.to_string())?)
        } else {
            None
        };
        expand_download_dir(configured, home.as_deref())?
    };
    std::fs::create_dir_all(&directory).map_err(|e| {
        format!(
            "Cannot create download directory {}: {e}",
            directory.display()
        )
    })?;
    Ok(directory)
}

fn expand_download_dir(configured: &str, home: Option<&Path>) -> Result<PathBuf, String> {
    let directory = if configured == "~" || configured.starts_with("~/") {
        let home = home.ok_or("Cannot resolve the app user's home directory")?;
        let relative = Path::new(configured.strip_prefix("~/").unwrap_or(""));
        if relative.has_root()
            || matches!(
                relative.components().next(),
                Some(std::path::Component::Prefix(_))
            )
        {
            return Err(
                "Download directory after ~/ must be relative to the home directory".into(),
            );
        }
        home.join(relative)
    } else {
        PathBuf::from(configured)
    };
    if !directory.is_absolute() || configured.contains('\0') {
        return Err("Download directory must be an absolute path or ~/path".into());
    }
    Ok(directory)
}

pub fn show_toast(window: &WebviewWindow, message: &str) {
    let script = format!(r#"pakeToast("{message}");"#);
    if let Err(error) = window.eval(&script) {
        eprintln!("[Pake] Failed to show toast: {error}");
    }
}

pub enum MessageType {
    Start,
    Success,
    Failure,
    DirectoryFailure,
}

pub fn get_download_message_with_lang(
    message_type: MessageType,
    language: Option<String>,
) -> String {
    let default_start_message = "Start downloading~";
    let chinese_start_message = "开始下载中~";

    let default_success_message = "Download successful, saved to download directory~";
    let chinese_success_message = "下载成功，已保存到下载目录~";

    let default_failure_message = "Download failed~";
    let chinese_failure_message = "下载失败~";

    let is_chinese = language
        .as_ref()
        .map(|lang| {
            lang.starts_with("zh")
                || lang.contains("CN")
                || lang.contains("TW")
                || lang.contains("HK")
        })
        .unwrap_or_else(|| {
            // Try multiple environment variables for better system detection
            ["LANG", "LC_ALL", "LC_MESSAGES", "LANGUAGE"]
                .iter()
                .find_map(|var| env::var(var).ok())
                .map(|lang| {
                    lang.starts_with("zh")
                        || lang.contains("CN")
                        || lang.contains("TW")
                        || lang.contains("HK")
                })
                .unwrap_or(false)
        });

    if is_chinese {
        match message_type {
            MessageType::Start => chinese_start_message,
            MessageType::Success => chinese_success_message,
            MessageType::Failure => chinese_failure_message,
            MessageType::DirectoryFailure => "无法保存到下载目录~",
        }
    } else {
        match message_type {
            MessageType::Start => default_start_message,
            MessageType::Success => default_success_message,
            MessageType::Failure => default_failure_message,
            MessageType::DirectoryFailure => "Cannot save to the download directory~",
        }
    }
    .to_string()
}

pub fn sanitize_download_filename(filename: &str) -> String {
    let Some(candidate) = filename
        .rsplit(['/', '\\'])
        .find(|part| !part.trim().is_empty())
        .map(str::trim)
    else {
        return "download".to_string();
    };

    // A colon can retain a Windows drive prefix or alternate data stream even
    // after separators have been removed. Colons are ordinary names on Unix.
    if candidate == "."
        || candidate == ".."
        || (cfg!(target_os = "windows") && candidate.contains(':'))
    {
        "download".to_string()
    } else {
        candidate.to_string()
    }
}

/// Check if the file exists. If it does, append `-N` to the stem until a free
/// path is found.
///
/// Robustness notes:
/// - Files without an extension are handled (we keep them extensionless).
/// - If the numeric suffix would overflow `u32::MAX` we fall back to the
///   original file_path so the caller never enters an infinite loop on
///   pathologically large filenames (regression guard for #1183).
pub fn check_file_or_append(file_path: &str) -> String {
    let mut new_path = PathBuf::from(file_path);

    while new_path.exists() {
        let file_stem = new_path
            .file_stem()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_default();
        let extension = new_path
            .extension()
            .map(|e| e.to_string_lossy().to_string());
        let parent_dir = new_path.parent().unwrap_or(Path::new(""));

        let parsed_suffix = file_stem.rfind('-').and_then(|index| {
            file_stem[index + 1..]
                .parse::<u32>()
                .ok()
                .map(|n| (index, n))
        });

        let new_file_stem = match parsed_suffix {
            Some((index, current)) => {
                let Some(next) = current.checked_add(1) else {
                    // u32::MAX collisions are a sign of something pathological;
                    // bail with the original path instead of looping forever.
                    return file_path.to_string();
                };
                let base_name = &file_stem[..index];
                format!("{base_name}-{next}")
            }
            None => format!("{file_stem}-1"),
        };

        new_path = match &extension {
            Some(ext) => parent_dir.join(format!("{new_file_stem}.{ext}")),
            None => parent_dir.join(new_file_stem),
        };
    }

    new_path.to_string_lossy().into_owned()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;
    use std::fs;
    use std::path::PathBuf;
    use std::sync::atomic::{AtomicU64, Ordering};

    static TEMP_PATH_COUNTER: AtomicU64 = AtomicU64::new(0);

    fn temp_path(name: &str) -> PathBuf {
        let mut dir = env::temp_dir();
        let unique = TEMP_PATH_COUNTER.fetch_add(1, Ordering::Relaxed);
        dir.push(format!(
            "pake-util-test-{}-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_nanos())
                .unwrap_or(0),
            unique
        ));
        fs::create_dir_all(&dir).unwrap();
        dir.push(name);
        dir
    }

    #[test]
    fn last_url_round_trip_preserves_full_address() {
        let path = temp_path("state/last-url.txt");
        assert_eq!(read_last_url(&path).unwrap(), None);
        for address in [
            "https://acme.example/projects/42?view=board#activity",
            "https://login.example/callback?code=example#result",
        ] {
            let url = tauri::Url::parse(address).unwrap();
            write_last_url(&path, &url).unwrap();
            assert_eq!(read_last_url(&path).unwrap(), Some(url));
        }
        write_last_url(&path, &tauri::Url::parse("about:blank").unwrap()).unwrap();
        assert!(read_last_url(&path).unwrap().is_some());
        std::fs::write(&path, "invalid URL").unwrap();
        assert_eq!(read_last_url(&path).unwrap(), None);
        fs::remove_dir_all(path.parent().unwrap().parent().unwrap()).unwrap();
    }

    #[test]
    fn expand_download_dir_preserves_absolute_paths_without_home() {
        let absolute = temp_path("My Downloads");
        assert_eq!(
            expand_download_dir(absolute.to_str().unwrap(), None).unwrap(),
            absolute
        );
        fs::remove_dir_all(absolute.parent().unwrap()).unwrap();
    }

    #[test]
    fn expand_download_dir_uses_runtime_home() {
        let home = temp_path("home");
        assert_eq!(
            expand_download_dir("~/Documents/My App", Some(&home)).unwrap(),
            home.join("Documents/My App")
        );
        assert_eq!(expand_download_dir("~", Some(&home)).unwrap(), home);
        assert!(expand_download_dir("~/Downloads", None).is_err());
        fs::remove_dir_all(home.parent().unwrap()).unwrap();
    }

    #[test]
    fn expand_download_dir_rejects_home_replacement() {
        let home = temp_path("home");
        assert!(expand_download_dir("~//tmp", Some(&home)).is_err());
        #[cfg(target_os = "windows")]
        for value in ["~/C:\\other", "~/C:other", "~/\\other"] {
            assert!(
                expand_download_dir(value, Some(&home)).is_err(),
                "accepted {value}"
            );
        }
        fs::remove_dir_all(home.parent().unwrap()).unwrap();
    }

    #[test]
    fn expand_download_dir_rejects_relative_and_nul_paths() {
        for value in [
            "downloads",
            "./downloads",
            "~alice/downloads",
            "~/bad\0path",
        ] {
            assert!(
                expand_download_dir(value, None).is_err(),
                "accepted {value}"
            );
        }
    }

    #[test]
    fn check_file_or_append_returns_input_when_missing() {
        let path = temp_path("ghost.txt");
        let resolved = check_file_or_append(path.to_str().unwrap());
        assert_eq!(resolved, path.to_string_lossy());
        let _ = fs::remove_dir_all(path.parent().unwrap());
    }

    #[test]
    fn check_file_or_append_increments_suffix() {
        let path = temp_path("dup.txt");
        fs::write(&path, b"existing").unwrap();
        let resolved = check_file_or_append(path.to_str().unwrap());
        assert!(resolved.ends_with("dup-1.txt"), "got {resolved}");
        let _ = fs::remove_dir_all(path.parent().unwrap());
    }

    #[test]
    fn check_file_or_append_handles_files_without_extension() {
        let path = temp_path("README");
        fs::write(&path, b"existing").unwrap();
        let resolved = check_file_or_append(path.to_str().unwrap());
        assert!(resolved.ends_with("README-1"), "got {resolved}");
        let _ = fs::remove_dir_all(path.parent().unwrap());
    }

    #[test]
    fn check_file_or_append_does_not_panic_on_huge_suffix() {
        let path = temp_path(&format!("huge-{}.txt", u32::MAX));
        fs::write(&path, b"existing").unwrap();
        let resolved = check_file_or_append(path.to_str().unwrap());
        assert!(resolved.contains("huge-"));
        let _ = fs::remove_dir_all(path.parent().unwrap());
    }

    #[test]
    fn sanitize_download_filename_keeps_plain_names() {
        assert_eq!(sanitize_download_filename("report.pdf"), "report.pdf");
        assert_eq!(sanitize_download_filename(" report.pdf "), "report.pdf");
    }

    #[test]
    fn sanitize_download_filename_takes_the_final_path_segment() {
        assert_eq!(
            sanitize_download_filename("../../private/report.pdf"),
            "report.pdf"
        );
        assert_eq!(
            sanitize_download_filename("..\\private\\report.pdf"),
            "report.pdf"
        );
        assert_eq!(
            sanitize_download_filename("nested/path/archive.tar.gz"),
            "archive.tar.gz"
        );
    }

    #[test]
    fn sanitize_download_filename_falls_back_for_empty_or_parent_segments() {
        for filename in ["", "   ", "/", "\\", ".", "..", "../..", "..\\.."] {
            assert_eq!(
                sanitize_download_filename(filename),
                "download",
                "{filename}"
            );
        }
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn sanitize_download_filename_rejects_windows_drive_prefixes_and_streams() {
        for filename in [
            "C:payload.txt",
            "C:",
            "report.txt:payload",
            "..\\D:payload.txt",
        ] {
            assert_eq!(
                sanitize_download_filename(filename),
                "download",
                "{filename}"
            );
        }
    }

    #[cfg(not(target_os = "windows"))]
    #[test]
    fn sanitize_download_filename_preserves_colons_on_unix() {
        assert_eq!(
            sanitize_download_filename("report-14:30.txt"),
            "report-14:30.txt"
        );
    }

    #[test]
    fn download_message_falls_back_to_english_for_unknown_locale() {
        let msg = get_download_message_with_lang(MessageType::Start, Some("fr-FR".to_string()));
        assert_eq!(msg, "Start downloading~");
    }

    #[test]
    fn download_message_picks_chinese_for_zh_locales() {
        for tag in ["zh", "zh-CN", "zh-TW", "en-CN", "en-HK"] {
            let msg = get_download_message_with_lang(MessageType::Success, Some(tag.to_string()));
            assert_eq!(
                msg, "下载成功，已保存到下载目录~",
                "expected Chinese for {tag}"
            );
        }
    }

    #[test]
    fn download_message_failure_localized() {
        let en = get_download_message_with_lang(MessageType::Failure, Some("en".into()));
        let zh = get_download_message_with_lang(MessageType::Failure, Some("zh".into()));
        assert!(en.contains("Download failed"));
        assert!(zh.contains("下载失败"));
    }

    fn compiled_configs() -> (PakeConfig, Config) {
        (
            serde_json::from_str(include_str!("../pake.json")).unwrap(),
            serde_json::from_str(include_str!("../tauri.conf.json")).unwrap(),
        )
    }

    fn snapshot(pake: &PakeConfig, tauri: &Config) -> (serde_json::Value, serde_json::Value) {
        (
            serde_json::to_value(pake).unwrap(),
            serde_json::to_value(tauri).unwrap(),
        )
    }

    fn runtime_dir(files: &[(&str, &str)]) -> PathBuf {
        let dir = temp_path(RUNTIME_DIR);
        fs::create_dir_all(&dir).unwrap();
        for (name, contents) in files {
            fs::write(dir.join(name), contents).unwrap();
        }
        dir
    }

    const RUNTIME_APP: &str = r#"{"identifier":"com.pake.a1b2c3","productName":"Runtime Probe"}"#;

    #[cfg(target_os = "macos")]
    #[test]
    fn runtime_dir_lives_in_bundle_resources_on_macos() {
        assert_eq!(
            runtime_dir_for_exe(Path::new("/Applications/Probe.app/Contents/MacOS/pake")),
            Some(PathBuf::from(
                "/Applications/Probe.app/Contents/Resources/pake-runtime"
            ))
        );
    }

    #[cfg(not(target_os = "macos"))]
    #[test]
    fn runtime_dir_lives_next_to_executable() {
        let exe = temp_path("pake");
        assert_eq!(
            runtime_dir_for_exe(&exe),
            Some(exe.parent().unwrap().join("pake-runtime"))
        );
    }

    #[test]
    fn absent_runtime_override_keeps_compiled_configs() {
        let (pake, tauri) = compiled_configs();
        let expected = snapshot(&pake, &tauri);

        let (pake, tauri, app) = apply_runtime_override(pake, tauri, None).unwrap();
        assert!(app.is_none());
        assert_eq!(snapshot(&pake, &tauri), expected);

        // A directory without pake.json is not a runtime app, even with app.json.
        let dir = runtime_dir(&[("app.json", RUNTIME_APP), ("custom.js", "x")]);
        let (pake, tauri, app) = apply_runtime_override(pake, tauri, Some(&dir)).unwrap();
        assert!(app.is_none());
        assert!(pake.runtime_custom_js.is_none());
        assert_eq!(snapshot(&pake, &tauri), expected);

        let missing = dir.join("missing");
        let (pake, tauri, app) = apply_runtime_override(pake, tauri, Some(&missing)).unwrap();
        assert!(app.is_none());
        assert_eq!(snapshot(&pake, &tauri), expected);
        fs::remove_dir_all(dir.parent().unwrap()).unwrap();
    }

    #[test]
    fn runtime_override_replaces_config_identity_script_and_tray() {
        let mut runtime: serde_json::Value =
            serde_json::from_str(include_str!("../pake.json")).unwrap();
        runtime["windows"][0]["url"] = "https://example.com/app".into();
        runtime["system_tray_path"] = "tray.png".into();
        // Optional fields fall back to their serde defaults.
        for key in ["password_autosave", "new_window", "enable_find"] {
            runtime["windows"][0].as_object_mut().unwrap().remove(key);
        }
        runtime.as_object_mut().unwrap().remove("download_dir");
        let dir = runtime_dir(&[
            ("pake.json", &runtime.to_string()),
            ("app.json", RUNTIME_APP),
            ("custom.js", "document.documentElement.dataset.probe = '1';"),
        ]);

        let (pake, tauri) = compiled_configs();
        let (pake, tauri, app) = apply_runtime_override(pake, tauri, Some(&dir)).unwrap();
        assert_eq!(
            app,
            Some(RuntimeApp {
                identifier: "com.pake.a1b2c3".into(),
                product_name: "Runtime Probe".into(),
            })
        );
        assert_eq!(tauri.identifier, "com.pake.a1b2c3");
        assert_eq!(tauri.product_name.as_deref(), Some("Runtime Probe"));
        assert_eq!(pake.windows[0].url, "https://example.com/app");
        assert_eq!(pake.windows[0].zoom, 100);
        assert!(!pake.windows[0].enable_find);
        assert!(pake.download_dir.is_empty());
        assert_eq!(
            pake.runtime_custom_js.as_deref(),
            Some("document.documentElement.dataset.probe = '1';")
        );
        assert_eq!(PathBuf::from(&pake.system_tray_path), dir.join("tray.png"));

        // Absolute tray paths and a missing custom.js stay as written.
        let absolute = dir.join("elsewhere.png");
        runtime["system_tray_path"] = absolute.to_string_lossy().into_owned().into();
        fs::write(dir.join("pake.json"), runtime.to_string()).unwrap();
        fs::remove_file(dir.join("custom.js")).unwrap();
        let (pake, tauri) = compiled_configs();
        let (pake, _, _) = apply_runtime_override(pake, tauri, Some(&dir)).unwrap();
        assert_eq!(PathBuf::from(&pake.system_tray_path), absolute);
        assert!(pake.runtime_custom_js.is_none());
        fs::remove_dir_all(dir.parent().unwrap()).unwrap();
    }

    #[test]
    fn invalid_runtime_override_is_an_error() {
        let pake_json = include_str!("../pake.json");
        for files in [
            vec![("pake.json", pake_json)],
            vec![("pake.json", "{"), ("app.json", RUNTIME_APP)],
            vec![
                ("pake.json", r#"{"windows":[]}"#),
                ("app.json", RUNTIME_APP),
            ],
            vec![
                ("pake.json", pake_json),
                ("app.json", r#"{"identifier":"x"}"#),
            ],
            vec![
                ("pake.json", pake_json),
                ("app.json", r#"{"identifier":" ","productName":"Probe"}"#),
            ],
            vec![
                ("pake.json", pake_json),
                (
                    "app.json",
                    r#"{"identifier":"com.pake/../x","productName":"Probe"}"#,
                ),
            ],
            vec![
                ("pake.json", pake_json),
                (
                    "app.json",
                    r#"{"identifier":"com pake","productName":"Probe"}"#,
                ),
            ],
        ] {
            let dir = runtime_dir(&files);
            let (pake, tauri) = compiled_configs();
            assert!(
                apply_runtime_override(pake, tauri, Some(&dir)).is_err(),
                "expected an error for {files:?}"
            );
            fs::remove_dir_all(dir.parent().unwrap()).unwrap();
        }
    }

    #[test]
    fn data_dir_follows_product_name_for_cli_and_identifier_for_runtime() {
        let (pake, tauri) = compiled_configs();
        let cli_name = tauri.product_name.clone().unwrap();
        let (pake, tauri, _) = apply_runtime_override(pake, tauri, None).unwrap();
        assert_eq!(data_dir_name(&pake, &tauri), cli_name);

        let mut nameless = tauri.clone();
        nameless.product_name = None;
        assert_eq!(data_dir_name(&pake, &nameless), "pake");

        let dir = runtime_dir(&[
            ("pake.json", include_str!("../pake.json")),
            ("app.json", RUNTIME_APP),
        ]);
        let (pake, tauri, _) = apply_runtime_override(pake, tauri, Some(&dir)).unwrap();
        assert_eq!(data_dir_name(&pake, &tauri), "com.pake.a1b2c3");
        fs::remove_dir_all(dir.parent().unwrap()).unwrap();
    }

    #[test]
    fn identifiers_follow_the_cli_rule() {
        for id in ["com.pake.a1b2c3", "com.example.app-2", "a1"] {
            assert!(is_valid_identifier(id), "{id}");
        }
        let too_long = format!("a{}", "b".repeat(128));
        for id in [
            "",
            "1abc",
            "com.pake.",
            "com pake",
            "com/pake",
            "..x",
            too_long.as_str(),
        ] {
            assert!(!is_valid_identifier(id), "{id}");
        }
    }

    #[test]
    fn app_user_model_id_is_set_only_for_runtime_apps() {
        assert_eq!(app_user_model_id(None), None);
        let app = RuntimeApp {
            identifier: "com.pake.a1b2c3".into(),
            product_name: "Runtime Probe".into(),
        };
        assert_eq!(app_user_model_id(Some(&app)), Some("com.pake.a1b2c3"));
    }
}
