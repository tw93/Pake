use crate::app::{events, inject, menu, shortcuts, tray};
use crate::state::AppState;
use tauri::{App, Manager, WebviewUrl, WebviewWindowBuilder};

pub fn setup_app(app: &mut App) -> Result<(), Box<dyn std::error::Error>> {
    let state = app.state::<AppState>().inner().clone();

    if state.config.incognito {
        tracing::info!("incognito mode enabled: using ephemeral session storage");
    }

    menu::build_menu(app.handle())?;
    events::register(app.handle());

    if let Some(window) = app.get_webview_window("main") {
        apply_window_options(&window, &state)?;
        inject::apply_user_agent(&window, state.config.user_agent.as_deref());
        inject::inject_into_window(&window, &state)?;
    }

    inject::register_inject_hooks(app.handle(), &state);
    shortcuts::register(app.handle(), &state)?;
    tray::setup(app.handle(), &state)?;

    tracing::info!(
        "WebPake started: {} -> {}",
        state.config.display_title(),
        state.config.url
    );

    Ok(())
}

fn apply_window_options(
    window: &tauri::WebviewWindow,
    state: &AppState,
) -> Result<(), Box<dyn std::error::Error>> {
    if state.config.maximize {
        window.maximize()?;
    }

    if state.config.hide_title_bar {
        // Drag region for frameless windows
        window.eval(
            "document.addEventListener('DOMContentLoaded',()=>{\
             const bar=document.createElement('div');\
             bar.style.cssText='position:fixed;top:0;left:0;right:0;height:28px;-webkit-app-region:drag;z-index:99999;pointer-events:auto';\
             document.body.prepend(bar);});",
        )?;
    }

    Ok(())
}

/// Create an additional webview window (multi-window mode).
pub fn open_window(
    app: &tauri::AppHandle,
    state: &AppState,
    url: Option<&str>,
) -> Result<(), Box<dyn std::error::Error>> {
    let target = url.unwrap_or(&state.config.url);
    let parsed: url::Url = target.parse()?;
    let label = format!("window-{}", chrono_timestamp());

    let window = WebviewWindowBuilder::new(app, &label, WebviewUrl::External(parsed))
        .title(state.config.display_title())
        .inner_size(state.config.width as f64, state.config.height as f64)
        .decorations(!state.config.hide_title_bar)
        .build()?;

    inject::apply_user_agent(&window, state.config.user_agent.as_deref());
    inject::inject_into_window(&window, state)?;

    Ok(())
}

fn chrono_timestamp() -> u128 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0)
}
