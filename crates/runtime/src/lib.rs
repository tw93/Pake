mod app;
mod commands;
mod state;

use app::setup::setup_app;
use state::AppState;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tracing_subscriber::fmt()
        .with_env_filter("webpake_runtime=info")
        .init();

    let state = AppState::load().unwrap_or_default();

    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .manage(state)
        .invoke_handler(tauri::generate_handler![
            commands::copy_current_url,
            commands::get_app_config,
            commands::navigate_home,
            commands::clear_cache_and_restart,
            commands::show_notification,
            commands::open_new_window,
            commands::hide_window,
            commands::toggle_fullscreen,
        ])
        .setup(setup_app);

    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            let _ = app.get_webview_window("main").map(|w| {
                let _ = w.show();
                let _ = w.set_focus();
            });
        }));
    }

    builder
        .run(tauri::generate_context!())
        .expect("error while running WebPake runtime");
}
