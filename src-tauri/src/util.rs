use crate::app::config::PakeConfig;
use std::env;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Config, Manager, WebviewWindow};

pub fn get_pake_config() -> (PakeConfig, Config) {
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

    (pake_config, tauri_config)
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
}

pub fn get_download_message_with_lang(
    message_type: MessageType,
    language: Option<String>,
) -> String {
    let default_start_message = "Start downloading~";
    let chinese_start_message = "开始下载中~";

    let default_success_message = "Download successful, saved to download directory~";
    let chinese_success_message = "下载成功，已保存到下载目录~";

    let default_failure_message = "Download failed, please check your network connection~";
    let chinese_failure_message = "下载失败，请检查你的网络连接~";

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
        }
    } else {
        match message_type {
            MessageType::Start => default_start_message,
            MessageType::Success => default_success_message,
            MessageType::Failure => default_failure_message,
        }
    }
    .to_string()
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

    fn temp_path(name: &str) -> PathBuf {
        let mut dir = env::temp_dir();
        dir.push(format!(
            "pake-util-test-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_nanos())
                .unwrap_or(0)
        ));
        fs::create_dir_all(&dir).unwrap();
        dir.push(name);
        dir
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
}
