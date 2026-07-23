use std::env;
use std::path::PathBuf;

fn main() {
    println!("cargo:rerun-if-env-changed=PAKE_OFFLINE_MSI");
    println!("cargo:rerun-if-env-changed=PAKE_OFFLINE_ICON");
    println!("cargo:rerun-if-env-changed=PAKE_OFFLINE_APP_NAME");
    if let Some(msi) = env::var_os("PAKE_OFFLINE_MSI") {
        println!("cargo:rerun-if-changed={}", PathBuf::from(msi).display());
    }
    if let Some(icon) = env::var_os("PAKE_OFFLINE_ICON") {
        println!("cargo:rerun-if-changed={}", PathBuf::from(icon).display());
    }

    #[cfg(windows)]
    {
        let manifest_directory = PathBuf::from(env::var_os("CARGO_MANIFEST_DIR").unwrap());
        let default_icon = manifest_directory
            .join("..")
            .join("..")
            .join("src-tauri")
            .join("png")
            .join("icon_256.ico");
        let icon = env::var_os("PAKE_OFFLINE_ICON")
            .map(PathBuf::from)
            .unwrap_or(default_icon);
        let app_name =
            env::var("PAKE_OFFLINE_APP_NAME").unwrap_or_else(|_| "Pake Application".into());

        let mut resource = winres::WindowsResource::new();
        resource.set_icon(icon.to_string_lossy().as_ref());
        resource.set("ProductName", &app_name);
        resource.set("FileDescription", &format!("{app_name} Offline Installer"));
        resource
            .compile()
            .expect("failed to compile the offline installer resources");
    }
}
