// The title bar of a Pake window on Wayland.
//
// tao 0.34 gave every Wayland window a GTK header bar of its own; 0.37 dropped
// it and leaves the title bar to GTK, which asks the compositor for one when
// the compositor supports server-side decorations. Hyprland (Omarchy) and
// other tiling compositors draw none, so after the Tauri 2.12 upgrade a Pake
// window there had no title, no buttons and nothing to drag (2026-11-19, on
// Omarchy). A header bar set before the window first shows makes GTK draw the
// title bar itself again, as it did before.

use gtk::prelude::*;
use gtk::HeaderBar;
use tauri::WebviewWindow;

fn layout(resizable: bool) -> &'static str {
    if resizable {
        "menu:minimize,maximize,close"
    } else {
        "menu:minimize,close"
    }
}

/// Gives a decorated Wayland window GTK's own title bar, with the window's
/// title and its minimize, maximize and close buttons. Call it before the
/// window is first shown; a window that already has a title bar keeps it.
pub fn install(window: &WebviewWindow) {
    let gtk_window = match window.gtk_window() {
        Ok(gtk_window) => gtk_window,
        Err(error) => {
            eprintln!("[Pake] No GTK window for the title bar: {error}");
            return;
        }
    };
    if !gtk_window.display().backend().is_wayland()
        || !gtk_window.is_decorated()
        || gtk_window.titlebar().is_some()
    {
        return;
    }

    let header = HeaderBar::builder()
        .show_close_button(true)
        .decoration_layout(layout(gtk_window.is_resizable()))
        .build();
    header.set_title(gtk_window.title().as_deref());
    header.show();
    gtk_window.set_titlebar(Some(&header));

    let title_header = header.downgrade();
    gtk_window.connect_title_notify(move |window| {
        if let Some(header) = title_header.upgrade() {
            header.set_title(window.title().as_deref());
        }
    });
    let layout_header = header.downgrade();
    gtk_window.connect_resizable_notify(move |window| {
        if let Some(header) = layout_header.upgrade() {
            header.set_decoration_layout(Some(layout(window.is_resizable())));
        }
    });
}
