#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    #[cfg(target_os = "macos")]
    if let Some(exit_code) = pake_online_installer::maybe_run_macos_elevated_helper() {
        std::process::exit(exit_code);
    }

    pake_online_installer::run();
}
