#[cfg_attr(mobile, tauri::mobile_entry_point)]
mod app;
mod util;

use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
};
use tauri::{webview::PageLoadEvent, Manager, Url, WebviewWindow};
use tauri_plugin_window_state::Builder as WindowStatePlugin;
use tauri_plugin_window_state::StateFlags;

#[cfg(target_os = "macos")]
use std::time::Duration;

// Fallback when PageLoadEvent::Finished never arrives (offline / stalled).
// Deliberately longer than a paint tick so the normal path can win first.
const STARTUP_WINDOW_FALLBACK_DELAY: u64 = 3_000;
#[cfg(target_os = "linux")]
const PAKE_LINUX_WEBKIT_SAFE_MODE: &str = "PAKE_LINUX_WEBKIT_SAFE_MODE";
#[cfg(target_os = "linux")]
const WEBKIT_DISABLE_DMABUF_RENDERER: &str = "WEBKIT_DISABLE_DMABUF_RENDERER";
#[cfg(target_os = "linux")]
const WEBKIT_DISABLE_COMPOSITING_MODE: &str = "WEBKIT_DISABLE_COMPOSITING_MODE";
#[cfg(target_os = "linux")]
const GDK_BACKEND: &str = "GDK_BACKEND";

use app::{
    invoke::{
        clear_dock_badge, download_file, increment_dock_badge, send_notification, set_dock_badge,
        set_dock_badge_label, set_zoom, update_theme_mode, webview_navigate,
    },
    setup::{set_global_shortcut, set_system_tray},
    window::{
        open_additional_window_safe, reapply_window_icon, reveal_built_window, set_window,
        MultiWindowState,
    },
};
use util::get_pake_config;

/// Placeholder documents used before the real target URL navigates (e.g. macOS
/// cert-bypass starts on about:blank). Revealing on these would reintroduce the
/// blank-window flash the page-load gate is meant to prevent.
fn is_placeholder_startup_url(url: &Url) -> bool {
    url.scheme().eq_ignore_ascii_case("about")
}

/// First automatic reveal wins. Returns true if the caller should show the window.
fn claim_startup_reveal(revealed: &AtomicBool) -> bool {
    !revealed.swap(true, Ordering::AcqRel)
}

/// User took control of main-window visibility (tray, shortcut, dock, second
/// instance, hide-on-close). Drop any pending page-load / fallback reveal so a
/// slow cold start cannot re-open a window the user just hid.
pub(crate) fn cancel_startup_reveal(revealed: &AtomicBool) {
    revealed.store(true, Ordering::Release);
}

fn reveal_startup_window(window: WebviewWindow, init_fullscreen: bool, revealed: &Arc<AtomicBool>) {
    if !claim_startup_reveal(revealed) {
        return;
    }

    tauri::async_runtime::spawn(async move {
        let _ = window.show();
        reapply_window_icon(&window);

        // Fixed: Linux fullscreen issue with virtual keyboard
        #[cfg(target_os = "linux")]
        {
            if init_fullscreen {
                let _ = window.set_fullscreen(true);
                // Ensure webview maintains focus for input after fullscreen
                let _ = window.set_focus();
            } else {
                // Fix: Ubuntu 24.04/GNOME window buttons non-functional until resize (#1122)
                // The window manager needs time to process the MapWindow event before
                // accepting focus requests. Without this, decorations remain non-interactive.
                tokio::time::sleep(tokio::time::Duration::from_millis(30)).await;
                let _ = window.set_focus();
            }
        }

        #[cfg(not(target_os = "linux"))]
        let _ = init_fullscreen;
    });
}

#[cfg(any(target_os = "linux", test))]
fn is_disabled_env_value(value: &str) -> bool {
    matches!(
        value.trim().to_ascii_lowercase().as_str(),
        "0" | "false" | "off" | "no" | "native" | "disabled"
    )
}

#[cfg(any(target_os = "linux", test))]
fn is_non_empty_env_value(value: Option<&str>) -> bool {
    value.map(|value| !value.trim().is_empty()).unwrap_or(false)
}

#[cfg(any(target_os = "linux", test))]
fn contains_niri(value: &str) -> bool {
    value
        .split([':', ';', ',', ' '])
        .any(|part| part.eq_ignore_ascii_case("niri"))
}

#[cfg(any(target_os = "linux", test))]
fn should_enable_linux_webkit_safe_mode_from_values(
    safe_mode: Option<&str>,
    niri_socket: Option<&str>,
    desktop_values: &[Option<&str>],
) -> bool {
    if let Some(value) = safe_mode.filter(|value| !value.trim().is_empty()) {
        return !is_disabled_env_value(value);
    }

    let is_niri_session = is_non_empty_env_value(niri_socket)
        || desktop_values
            .iter()
            .flatten()
            .any(|value| contains_niri(value));

    !is_niri_session
}

#[cfg(any(target_os = "linux", test))]
fn should_force_wayland_gdk_backend(
    gdk_backend: Option<&str>,
    wayland_display: Option<&str>,
    display: Option<&str>,
) -> bool {
    // Respect an explicit user choice.
    if is_non_empty_env_value(gdk_backend) {
        return false;
    }

    // On pure Wayland compositors without XWayland (e.g. Niri), $DISPLAY is unset
    // and GTK defaults to the X11 backend, which aborts with "Failed to initialize
    // GTK". Wayland is then the only viable backend, so forcing it is safe.
    is_non_empty_env_value(wayland_display) && !is_non_empty_env_value(display)
}

#[cfg(target_os = "linux")]
fn apply_linux_gdk_backend() {
    if should_force_wayland_gdk_backend(
        std::env::var(GDK_BACKEND).ok().as_deref(),
        std::env::var("WAYLAND_DISPLAY").ok().as_deref(),
        std::env::var("DISPLAY").ok().as_deref(),
    ) {
        std::env::set_var(GDK_BACKEND, "wayland");
    }
}

#[cfg(target_os = "linux")]
fn apply_linux_webkit_runtime_flags() {
    let safe_mode = std::env::var(PAKE_LINUX_WEBKIT_SAFE_MODE).ok();
    if safe_mode.as_deref().is_some_and(is_disabled_env_value) {
        std::env::remove_var(WEBKIT_DISABLE_DMABUF_RENDERER);
        std::env::remove_var(WEBKIT_DISABLE_COMPOSITING_MODE);
        return;
    }

    let desktop_values = [
        std::env::var("XDG_CURRENT_DESKTOP").ok(),
        std::env::var("XDG_SESSION_DESKTOP").ok(),
        std::env::var("DESKTOP_SESSION").ok(),
    ];
    let desktop_refs = desktop_values
        .iter()
        .map(|value| value.as_deref())
        .collect::<Vec<_>>();

    if !should_enable_linux_webkit_safe_mode_from_values(
        safe_mode.as_deref(),
        std::env::var("NIRI_SOCKET").ok().as_deref(),
        &desktop_refs,
    ) {
        return;
    }

    if std::env::var(WEBKIT_DISABLE_DMABUF_RENDERER).is_err() {
        std::env::set_var(WEBKIT_DISABLE_DMABUF_RENDERER, "1");
    }
    if std::env::var(WEBKIT_DISABLE_COMPOSITING_MODE).is_err() {
        std::env::set_var(WEBKIT_DISABLE_COMPOSITING_MODE, "1");
    }
}

pub fn run_app() {
    #[cfg(target_os = "linux")]
    {
        apply_linux_gdk_backend();
        apply_linux_webkit_runtime_flags();
    }

    let (pake_config, tauri_config) = get_pake_config();
    let tauri_app = tauri::Builder::default();

    let show_system_tray = pake_config.show_system_tray();
    let hide_on_close = pake_config.windows[0].hide_on_close;
    let activation_shortcut = pake_config.windows[0].activation_shortcut.clone();
    let init_fullscreen = pake_config.windows[0].fullscreen;
    let start_to_tray = pake_config.windows[0].start_to_tray && show_system_tray; // Only valid when tray is enabled
    let multi_instance = pake_config.multi_instance;
    let multi_window = pake_config.multi_window;
    let _enable_find = pake_config.windows[0].enable_find;
    let startup_window_revealed = Arc::new(AtomicBool::new(false));

    let window_state_plugin = WindowStatePlugin::default()
        .with_state_flags(if init_fullscreen {
            StateFlags::FULLSCREEN
        } else {
            // Prevent flickering on the first open.
            // Exclude FULLSCREEN so a prior --fullscreen build's persisted state
            // doesn't force fullscreen on a rebuild without --fullscreen.
            StateFlags::all() & !StateFlags::VISIBLE & !StateFlags::FULLSCREEN
        })
        .build();

    #[allow(deprecated)]
    let mut app_builder = tauri_app
        .plugin(window_state_plugin)
        .plugin(tauri_plugin_oauth::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init()); // Add this

    // Only add single instance plugin if multiple instances are not allowed
    if !multi_instance {
        let instance_revealed = startup_window_revealed.clone();
        app_builder = app_builder.plugin(tauri_plugin_single_instance::init(
            move |app, _args, _cwd| {
                if multi_window {
                    open_additional_window_safe(app);
                } else if let Some(window) = app.get_webview_window("pake") {
                    cancel_startup_reveal(&instance_revealed);
                    let _ = window.unminimize();
                    let _ = window.show();
                    reapply_window_icon(&window);
                    let _ = window.set_focus();
                }
            },
        ));
    }

    // Reveal hidden windows after the first real document finishes loading so
    // slow WKWebView cold starts do not expose an empty but interactive shell.
    // - Main label "pake": once-only latch + start_to_tray opt-out.
    // - Secondary multi-window labels ("pake-N"): reveal if still hidden (Cmd+N).
    // start_to_tray keeps the main window hidden until the user opens it.
    {
        let page_load_revealed = startup_window_revealed.clone();
        app_builder = app_builder.on_page_load(move |webview, payload| {
            if !matches!(payload.event(), PageLoadEvent::Finished) {
                return;
            }
            // Skip about:blank (and other about: placeholders) used by the macOS
            // cert-bypass path before the real target URL navigates.
            if is_placeholder_startup_url(payload.url()) {
                return;
            }

            let label = webview.label();
            if label == "pake" {
                if start_to_tray {
                    return;
                }
                if let Some(window) = webview.app_handle().get_webview_window("pake") {
                    reveal_startup_window(window, init_fullscreen, &page_load_revealed);
                }
                return;
            }

            // Multi-window clones (pake-1, pake-2, …) built hidden by
            // open_additional_window_safe.
            if label.starts_with("pake-") {
                if let Some(window) = webview.app_handle().get_webview_window(label) {
                    reveal_built_window(&window);
                }
            }
        });
    }

    // Clone before setup moves the Arc into tray / shortcut / fallback handlers.
    let close_revealed = startup_window_revealed.clone();
    #[cfg(target_os = "macos")]
    let reopen_revealed = startup_window_revealed.clone();

    app_builder
        .invoke_handler(tauri::generate_handler![
            download_file,
            send_notification,
            increment_dock_badge,
            set_dock_badge,
            set_dock_badge_label,
            clear_dock_badge,
            update_theme_mode,
            set_zoom,
            webview_navigate,
        ])
        .setup(move |app| {
            app.manage(MultiWindowState::new(
                pake_config.clone(),
                tauri_config.clone(),
            ));

            // --- Menu Construction Start ---
            #[cfg(target_os = "macos")]
            {
                app::menu::set_app_menu(app.app_handle(), multi_window, _enable_find)?;

                // Event Handling for Custom Menu Item
                app.on_menu_event(move |app_handle, event| {
                    app::menu::handle_menu_click(app_handle, event.id().as_ref());
                });
            }
            // --- Menu Construction End ---

            let window = set_window(app.app_handle(), &pake_config, &tauri_config)?;
            set_system_tray(
                app.app_handle(),
                show_system_tray,
                &pake_config.system_tray_path,
                init_fullscreen,
                multi_window,
                startup_window_revealed.clone(),
            )?;
            set_global_shortcut(
                app.app_handle(),
                activation_shortcut,
                init_fullscreen,
                startup_window_revealed.clone(),
            )?;

            // Show window after state restoration to prevent position flashing
            // once its first page finishes. A fallback keeps offline or stalled
            // pages reachable without exposing a blank webview during normal startup.
            if !start_to_tray {
                let window_clone = window.clone();
                tauri::async_runtime::spawn(async move {
                    tokio::time::sleep(tokio::time::Duration::from_millis(
                        STARTUP_WINDOW_FALLBACK_DELAY,
                    ))
                    .await;
                    reveal_startup_window(window_clone, init_fullscreen, &startup_window_revealed);
                });
            } else {
                // Tray/shortcut already hold clones that cancel user-driven toggles.
                drop(startup_window_revealed);
            }

            Ok(())
        })
        .on_window_event(move |_window, _event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = _event {
                if hide_on_close && _window.label() == "pake" {
                    // User dismissed the window; do not let startup reveal reopen it.
                    cancel_startup_reveal(&close_revealed);
                    // Hide window when hide_on_close is enabled (regardless of tray status)
                    let window = _window.clone();
                    tauri::async_runtime::spawn(async move {
                        #[cfg(target_os = "macos")]
                        {
                            if window.is_fullscreen().unwrap_or(false) {
                                let _ = window.set_fullscreen(false);
                                tokio::time::sleep(Duration::from_millis(900)).await;
                            }
                        }
                        #[cfg(target_os = "linux")]
                        {
                            if window.is_fullscreen().unwrap_or(false) {
                                let _ = window.set_fullscreen(false);
                                // Restore focus after exiting fullscreen to fix input issues
                                let _ = window.set_focus();
                            }
                        }
                        // On macOS, directly hide without minimize to avoid duplicate Dock icons
                        #[cfg(not(target_os = "macos"))]
                        let _ = window.minimize();
                        let _ = window.hide();
                    });
                    api.prevent_close();
                }
                // If hide_on_close is false, allow normal close behavior
                // This lets tauri-plugin-window-state save the window position and size
            }
        })
        .build(tauri::generate_context!())
        .unwrap_or_else(|error| {
            eprintln!("[Pake] Fatal error while building Tauri application: {error}");
            std::process::exit(1);
        })
        .run(move |_app, _event| {
            // Handle macOS dock icon click to reopen hidden window
            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::Reopen {
                has_visible_windows,
                ..
            } = _event
            {
                if !has_visible_windows {
                    if let Some(window) = _app.get_webview_window("pake") {
                        cancel_startup_reveal(&reopen_revealed);
                        let _ = window.show();
                        reapply_window_icon(&window);
                        let _ = window.set_focus();
                    }
                }
            }
        });
}

pub fn run() {
    run_app()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn placeholder_startup_urls_cover_about_blank() {
        let blank: Url = "about:blank".parse().unwrap();
        let srcdoc: Url = "about:srcdoc".parse().unwrap();
        let https: Url = "https://github.com/".parse().unwrap();
        let tauri: Url = "tauri://localhost/".parse().unwrap();

        assert!(is_placeholder_startup_url(&blank));
        assert!(is_placeholder_startup_url(&srcdoc));
        assert!(!is_placeholder_startup_url(&https));
        assert!(!is_placeholder_startup_url(&tauri));
    }

    #[test]
    fn first_claim_wins_startup_reveal() {
        let revealed = AtomicBool::new(false);
        assert!(claim_startup_reveal(&revealed));
        assert!(!claim_startup_reveal(&revealed));
    }

    #[test]
    fn user_show_then_hide_blocks_automatic_startup_reveal() {
        // Slow page load: user opens from tray/shortcut, then hides again.
        // Page-load finish and the 3s fallback must not reopen the window.
        let revealed = AtomicBool::new(false);
        cancel_startup_reveal(&revealed); // explicit show
        cancel_startup_reveal(&revealed); // explicit hide
        assert!(
            !claim_startup_reveal(&revealed),
            "automatic reveal must stay cancelled after user visibility control"
        );
    }

    #[test]
    fn cancel_before_any_claim_blocks_reveal() {
        let revealed = AtomicBool::new(false);
        cancel_startup_reveal(&revealed);
        assert!(!claim_startup_reveal(&revealed));
    }

    #[test]
    fn linux_webkit_safe_mode_stays_on_by_default() {
        assert!(should_enable_linux_webkit_safe_mode_from_values(
            None,
            None,
            &[None, None, None]
        ));
    }

    #[test]
    fn linux_webkit_safe_mode_is_disabled_for_niri_socket() {
        assert!(!should_enable_linux_webkit_safe_mode_from_values(
            None,
            Some("/run/user/501/niri.sock"),
            &[None, None, None]
        ));
    }

    #[test]
    fn linux_webkit_safe_mode_is_disabled_for_niri_desktop() {
        assert!(!should_enable_linux_webkit_safe_mode_from_values(
            None,
            None,
            &[Some("niri"), None, None]
        ));
    }

    #[test]
    fn linux_webkit_safe_mode_can_be_forced_on_for_niri() {
        assert!(should_enable_linux_webkit_safe_mode_from_values(
            Some("1"),
            Some("/run/user/501/niri.sock"),
            &[Some("niri"), None, None]
        ));
    }

    #[test]
    fn linux_webkit_safe_mode_can_be_disabled_explicitly() {
        for value in ["0", "false", "off", "no", "native", "disabled"] {
            assert!(
                !should_enable_linux_webkit_safe_mode_from_values(
                    Some(value),
                    None,
                    &[None, None, None]
                ),
                "expected {value} to disable safe mode"
            );
        }
    }

    #[test]
    fn forces_wayland_backend_on_pure_wayland() {
        assert!(should_force_wayland_gdk_backend(
            None,
            Some("wayland-0"),
            None
        ));
    }

    #[test]
    fn forces_wayland_backend_when_display_is_blank() {
        assert!(should_force_wayland_gdk_backend(
            None,
            Some("wayland-0"),
            Some("   ")
        ));
    }

    #[test]
    fn keeps_default_backend_when_x11_display_present() {
        assert!(!should_force_wayland_gdk_backend(
            None,
            Some("wayland-0"),
            Some(":0")
        ));
    }

    #[test]
    fn keeps_default_backend_without_wayland_display() {
        assert!(!should_force_wayland_gdk_backend(None, None, None));
    }

    #[test]
    fn respects_explicit_gdk_backend_override() {
        assert!(!should_force_wayland_gdk_backend(
            Some("x11"),
            Some("wayland-0"),
            None
        ));
    }
}
