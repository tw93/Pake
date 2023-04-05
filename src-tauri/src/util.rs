use crate::app::config::PakeConfig;
use tauri::Config;

pub fn get_pake_config() -> (PakeConfig, Config) {
    let pake_config_path = include_str!("../pake.json");
    let pake_config: PakeConfig =
        serde_json::from_str(pake_config_path).expect("failed to parse pake config");
    // println!("{:#?}", config);
    let tauri_config_path = include_str!("../tauri.conf.json");
    let tauri_config: Config =
        serde_json::from_str(tauri_config_path).expect("failed to parse tauri config");
    (pake_config, tauri_config)
}

pub fn get_data_dir(_tauri_config: Config) -> std::path::PathBuf {
    #[cfg(any(target_os = "linux", target_os = "windows"))]
    let data_dir = {
        let package_name = _tauri_config.package.product_name.unwrap();
        let home_dir = match home::home_dir() {
            Some(path1) => path1,
            None => panic!("Error, can't found you home dir!!"),
        };
        #[cfg(target_os = "windows")]
        let data_dir = home_dir.join("AppData").join("Roaming").join(package_name);
        #[cfg(target_os = "linux")]
        let data_dir = home_dir.join(".config").join(package_name);
        if !data_dir.exists() {
            std::fs::create_dir(&data_dir)
                .unwrap_or_else(|_| panic!("can't create dir {}", data_dir.display()));
        }
        data_dir
    };
    #[cfg(target_os = "macos")]
    let data_dir = std::path::PathBuf::new();
    data_dir
}
