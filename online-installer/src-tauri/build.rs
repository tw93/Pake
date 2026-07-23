fn main() {
    println!("cargo:rerun-if-env-changed=PAKE_ONLINE_REPOSITORY");
    println!("cargo:rerun-if-env-changed=PAKE_ONLINE_RELEASE_TAG");
    println!("cargo:rerun-if-env-changed=PAKE_ONLINE_CONFIG_ID");
    tauri_build::build()
}
