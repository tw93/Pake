use crate::app::config::PakeConfig;
use std::path::PathBuf;
use tauri::Config;

pub fn get_pake_config() -> (PakeConfig, Config) {
    let pake_config: PakeConfig =
        serde_json::from_str(include_str!("../pake.json")).expect("failed to parse pake config");

    let tauri_config: Config = serde_json::from_str(include_str!("../tauri.conf.json"))
        .expect("failed to parse tauri config");

    (pake_config, tauri_config)
}

pub fn get_data_dir(_tauri_config: Config) -> PathBuf {
    #[cfg(any(target_os = "linux", target_os = "windows"))]
    {
        let package_name = _tauri_config.package.product_name.unwrap();
        let home_dir = home::home_dir().expect("Error, can't found your home dir!!");

        let data_dir = match cfg!(target_os = "windows") {
            true => home_dir.join("AppData").join("Roaming").join(package_name),
            false => home_dir.join(".config").join(package_name),
        };

        if !data_dir.exists() {
            std::fs::create_dir(&data_dir)
                .unwrap_or_else(|_| panic!("can't create dir {}", data_dir.display()));
        }
        data_dir
    }
    #[cfg(target_os = "macos")]
    {
        PathBuf::new()
    }
}

