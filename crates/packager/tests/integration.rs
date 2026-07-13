//! Integration tests for the WebPake workspace.

use std::path::PathBuf;

#[test]
fn workspace_layout_is_complete() {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let workspace_root = manifest_dir
        .parent()
        .and_then(|p| p.parent())
        .expect("workspace root");

    assert!(workspace_root.join("crates/core").exists());
    assert!(workspace_root.join("crates/cli").exists());
    assert!(workspace_root.join("crates/packager").exists());
    assert!(workspace_root.join("crates/runtime").exists());
    assert!(workspace_root.join("templates/pake.json").exists());
}

#[test]
fn app_config_roundtrip() {
    use webpake_core::{save_config, AppConfig};

    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("pake.json");
    let config = AppConfig::new("TestApp", "https://example.com");

    save_config(&path, &config).unwrap();
    let loaded = webpake_core::load_config(&path).unwrap();
    assert_eq!(loaded.name, "TestApp");
    assert_eq!(loaded.url, "https://example.com");
}
