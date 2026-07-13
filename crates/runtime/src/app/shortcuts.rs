use crate::app::events;
use crate::state::AppState;
use tauri::AppHandle;
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

pub fn register(app: &AppHandle, state: &AppState) -> Result<(), Box<dyn std::error::Error>> {
    let shortcuts = &state.config.shortcuts;
    let gs = app.global_shortcut();

    if shortcuts.navigation {
        register_one(app, gs, Modifiers::CONTROL, Code::ArrowLeft, |app| {
            events::handle_back(app);
        })?;
        register_one(app, gs, Modifiers::CONTROL, Code::ArrowRight, |app| {
            events::handle_forward(app);
        })?;
        register_one(app, gs, Modifiers::CONTROL | Modifiers::SHIFT, Code::KeyH, |app| {
            events::handle_navigate_home(app);
        })?;
    }

    if shortcuts.refresh {
        register_one(app, gs, Modifiers::CONTROL, Code::KeyR, |app| {
            events::handle_refresh(app);
        })?;
    }

    if shortcuts.copy_url {
        register_one(app, gs, Modifiers::CONTROL, Code::KeyL, |app| {
            events::handle_copy_url(app);
        })?;
    }

    if shortcuts.zoom {
        register_one(app, gs, Modifiers::CONTROL, Code::Equal, |app| {
            events::handle_zoom(app, 0.1);
        })?;
        register_one(app, gs, Modifiers::CONTROL, Code::Minus, |app| {
            events::handle_zoom(app, -0.1);
        })?;
        register_one(app, gs, Modifiers::CONTROL, Code::Digit0, |app| {
            events::handle_zoom_reset(app);
        })?;
    }

    register_one(app, gs, Modifiers::CONTROL, Code::KeyW, |app| {
        events::handle_hide_window(app);
    })?;

    register_one(app, gs, Modifiers::empty(), Code::F11, |app| {
        events::handle_toggle_fullscreen(app);
    })?;

    if shortcuts.devtools {
        register_one(app, gs, Modifiers::CONTROL | Modifiers::SHIFT, Code::KeyI, |app| {
            events::handle_toggle_devtools(app);
        })?;
    }

    Ok(())
}

fn register_one<F>(
    app: &AppHandle,
    gs: &tauri_plugin_global_shortcut::GlobalShortcut<tauri::Wry>,
    modifiers: Modifiers,
    code: Code,
    handler: F,
) -> Result<(), Box<dyn std::error::Error>>
where
    F: Fn(&AppHandle) + Send + Sync + 'static,
{
    let shortcut = Shortcut::new(Some(modifiers), code);
    let app_handle = app.clone();
    gs.on_shortcut(shortcut, move |_app, _shortcut, event| {
        if event.state == ShortcutState::Pressed {
            handler(&app_handle);
        }
    })?;
    Ok(())
}
