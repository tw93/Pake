fn main() {
    println!("cargo:rerun-if-changed=.pake/pake.json");
    println!("cargo:rerun-if-changed=.pake/tauri.conf.json");
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&[
            "download_file",
            "send_notification",
            "close_notification",
            "increment_dock_badge",
            "set_dock_badge",
            "set_dock_badge_label",
            "clear_dock_badge",
            "update_theme_mode",
            "set_zoom",
            "webview_navigate",
        ]),
    ))
    .expect("Failed to build Pake permissions")
}
