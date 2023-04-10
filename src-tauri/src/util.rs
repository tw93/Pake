use crate::app::config::PakeConfig;
use std::env;
use std::path::PathBuf;
use tauri::{api, Config, Window};

pub fn get_pake_config() -> (PakeConfig, Config) {
    let pake_config: PakeConfig =
        serde_json::from_str(include_str!("../pake.json")).expect("Failed to parse pake config");

    let tauri_config: Config = serde_json::from_str(include_str!("../tauri.conf.json"))
        .expect("Failed to parse tauri config");

    (pake_config, tauri_config)
}

pub fn get_data_dir(_tauri_config: Config) -> PathBuf {
    {
        let package_name = _tauri_config.package.product_name.unwrap();
        let data_dir = api::path::config_dir()
            .expect("Failed to get data dirname")
            .join(package_name);

        if !data_dir.exists() {
            std::fs::create_dir(&data_dir)
                .unwrap_or_else(|_| panic!("Can't create dir {}", data_dir.display()));
        }
        data_dir
    }
}

pub fn show_toast(window: &Window, message: &str) {
    let script = format!(r#"pakeToast("{}");"#, message);
    window.eval(&script).unwrap();
}

pub fn get_download_message() -> String {
    let default_message = "Download successful, saved to download directory~";
    let chinese_message = "下载成功，已保存到下载目录~";

    env::var("LANG")
        .map(|lang| {
            if lang.starts_with("zh") {
                chinese_message
            } else {
                default_message
            }
        })
        .unwrap_or(default_message)
        .to_string()
}

// Check if the file exists, if it exists, add a number to file name
pub fn check_file_or_append(file_path: &str) -> String {
    let mut new_path = PathBuf::from(file_path);
    let mut counter = 0;

    while new_path.exists() {
        let file_stem = new_path.file_stem().unwrap().to_string_lossy().to_string();
        let extension = new_path.extension().unwrap().to_string_lossy().to_string();
        let parent_dir = new_path.parent().unwrap();

        let new_file_stem = match file_stem.rfind('-') {
            Some(index) if file_stem[index + 1..].parse::<u32>().is_ok() => {
                let base_name = &file_stem[..index];
                counter = file_stem[index + 1..].parse::<u32>().unwrap() + 1;
                format!("{}-{}", base_name, counter)
            }
            _ => {
                counter += 1;
                format!("{}-{}", file_stem, counter)
            }
        };

        new_path = parent_dir.join(format!("{}.{}", new_file_stem, extension));
    }

    new_path.to_string_lossy().into_owned()
}
