use crate::app::config::PakeConfig;
use std::path::PathBuf;
use tauri::Config;
use dirs::config_dir;

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
        let data_dir = config_dir().expect("Failed to get data dirname").join(package_name);

        if !data_dir.exists() {
            std::fs::create_dir(&data_dir)
                .unwrap_or_else(|_| panic!("Can't create dir {}", data_dir.display()));
        }
        data_dir
    }
}

