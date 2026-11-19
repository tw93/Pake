// Follow the freedesktop color-scheme preference on Linux (#1387).
//
// tao derives the Linux theme from `gtk-theme-name` only, so GNOME's
// `color-scheme` setting (also served by xdg-desktop-portal-gtk on i3 and
// other desktops) never reached GTK decorations or WebKitGTK's
// `prefers-color-scheme`, at startup or when it changes.

use tauri::Theme;

/// What to do with the app theme for one `color-scheme` reading.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ColorSchemeAction {
    /// Leave the current GTK settings alone.
    Keep,
    /// Pass this to `AppHandle::set_theme`.
    Apply(Option<Theme>),
}

/// Maps an `org.freedesktop.appearance` `color-scheme` value
/// (0 = no preference, 1 = prefer dark, 2 = prefer light).
///
/// On Linux, `AppHandle::set_theme` only toggles
/// `gtk-application-prefer-dark-theme`: `Some(Dark)` sets it, while
/// `Some(Light)` and `None` both clear it. An explicit light preference is
/// therefore applied at startup so a `prefer-dark` setting from settings.ini
/// cannot keep the app dark. "No preference" at startup keeps whatever GTK
/// resolved from settings.ini or `GTK_THEME`; after a live change it clears a
/// dark preference applied earlier. Unknown values are ignored.
pub fn color_scheme_action(value: u32, at_startup: bool) -> ColorSchemeAction {
    match value {
        1 => ColorSchemeAction::Apply(Some(Theme::Dark)),
        2 => ColorSchemeAction::Apply(Some(Theme::Light)),
        0 if !at_startup => ColorSchemeAction::Apply(None),
        _ => ColorSchemeAction::Keep,
    }
}

/// The installed theme to use in place of `name`, when GTK cannot load
/// `name` itself and it is a `-dark` name of a theme that is installed.
///
/// GTK 3 falls back to plain Adwaita when its theme is missing, and that
/// fallback drops the dark variant, so `prefer-dark` changes nothing.
/// Omarchy sets `gtk-theme` to `Adwaita-dark`, which only the separate
/// gnome-themes-extra package installs: every Pake app there drew a light
/// header bar over a dark page, `--dark-mode` included (2026-11-19).
pub fn dark_theme_base(name: &str, installed: impl Fn(&str) -> bool) -> Option<&str> {
    if installed(name) {
        return None;
    }
    let base = name
        .strip_suffix("-dark")
        .or_else(|| name.strip_suffix("-Dark"))?;
    (!base.is_empty() && installed(base)).then_some(base)
}

#[cfg(target_os = "linux")]
mod gtk_theme {
    use super::dark_theme_base;
    use gtk::gio::{resources_get_info, ResourceLookupFlags};
    use gtk::glib;
    use gtk::prelude::*;
    use std::path::{Path, PathBuf};

    /// Where GTK 3 looks for a theme by name, after its built-in ones.
    fn theme_dirs() -> Vec<PathBuf> {
        let mut dirs = vec![
            glib::user_data_dir().join("themes"),
            glib::home_dir().join(".themes"),
        ];
        dirs.extend(
            glib::system_data_dirs()
                .iter()
                .map(|dir| dir.join("themes")),
        );
        dirs.push(PathBuf::from("/usr/share/themes"));
        dirs
    }

    fn has_gtk3_css(theme: &Path) -> bool {
        std::fs::read_dir(theme).is_ok_and(|entries| {
            entries.flatten().any(|entry| {
                entry.file_name().to_string_lossy().starts_with("gtk-3.")
                    && entry.path().join("gtk.css").is_file()
            })
        })
    }

    fn installed(name: &str) -> bool {
        let builtin = format!("/org/gtk/libgtk/theme/{name}/gtk.css");
        resources_get_info(&builtin, ResourceLookupFlags::NONE).is_ok()
            || theme_dirs().iter().any(|dir| has_gtk3_css(&dir.join(name)))
    }

    /// Keeps a missing `-dark` theme dark: its installed base theme with
    /// GTK's dark variant. The desktop's color scheme, read after this, and
    /// `--dark-mode` still decide the variant.
    pub fn keep_missing_dark_theme_dark() {
        let Some(settings) = gtk::Settings::default() else {
            return;
        };
        let Some(name) = settings.gtk_theme_name() else {
            return;
        };
        if let Some(base) = dark_theme_base(name.as_str(), installed) {
            settings.set_gtk_theme_name(Some(base));
            settings.set_gtk_application_prefer_dark_theme(true);
        }
    }
}

#[cfg(target_os = "linux")]
pub use gtk_theme::keep_missing_dark_theme_dark;

#[cfg(target_os = "linux")]
mod portal {
    use super::{color_scheme_action, ColorSchemeAction};
    use tauri::AppHandle;
    use zbus::blocking::{Connection, Proxy};
    use zbus::zvariant::{OwnedValue, Value};

    const PORTAL_DESTINATION: &str = "org.freedesktop.portal.Desktop";
    const PORTAL_PATH: &str = "/org/freedesktop/portal/desktop";
    const PORTAL_INTERFACE: &str = "org.freedesktop.portal.Settings";
    const APPEARANCE_NAMESPACE: &str = "org.freedesktop.appearance";
    const COLOR_SCHEME_KEY: &str = "color-scheme";

    /// Extracts the setting from a portal reply. The deprecated `Read` method
    /// wraps the value in one more variant than `ReadOne` and `SettingChanged`.
    pub(super) fn color_scheme_value(value: &Value<'_>) -> Option<u32> {
        match value {
            Value::U32(scheme) => Some(*scheme),
            Value::Value(inner) => match inner.as_ref() {
                Value::U32(scheme) => Some(*scheme),
                _ => None,
            },
            _ => None,
        }
    }

    fn read_color_scheme(proxy: &Proxy<'_>) -> zbus::Result<OwnedValue> {
        let args = (APPEARANCE_NAMESPACE, COLOR_SCHEME_KEY);
        match proxy.call::<_, _, OwnedValue>("ReadOne", &args) {
            Ok(value) => Ok(value),
            // Portal versions before 2 only provide Read.
            Err(_) => proxy.call::<_, _, OwnedValue>("Read", &args),
        }
    }

    fn apply(app: &AppHandle, value: Option<u32>, at_startup: bool) {
        if let Some(value) = value {
            if let ColorSchemeAction::Apply(theme) = color_scheme_action(value, at_startup) {
                app.set_theme(theme);
            }
        }
    }

    fn watch(app: &AppHandle) -> zbus::Result<()> {
        let connection = Connection::session()?;
        let proxy = Proxy::new(
            &connection,
            PORTAL_DESTINATION,
            PORTAL_PATH,
            PORTAL_INTERFACE,
        )?;
        // Subscribe before the first read so a change in between is not lost.
        let changes = proxy.receive_signal_with_args(
            "SettingChanged",
            &[(0, APPEARANCE_NAMESPACE), (1, COLOR_SCHEME_KEY)],
        )?;

        let initial = read_color_scheme(&proxy)?;
        apply(app, color_scheme_value(&initial), true);

        for message in changes {
            let (namespace, key, value): (String, String, OwnedValue) =
                message.body().deserialize()?;
            if namespace == APPEARANCE_NAMESPACE && key == COLOR_SCHEME_KEY {
                apply(app, color_scheme_value(&value), false);
            }
        }
        Ok(())
    }

    /// Follows the desktop color scheme on a background thread. Any D-Bus
    /// failure (no session bus, no portal, no appearance setting) is logged
    /// once and leaves the GTK-derived theme in place.
    pub fn follow_desktop_color_scheme(app: &AppHandle) {
        let app = app.clone();
        let spawned = std::thread::Builder::new()
            .name("pake-color-scheme".into())
            .spawn(move || {
                if let Err(error) = watch(&app) {
                    eprintln!("[Pake] Desktop color scheme is unavailable: {error}");
                }
            });
        if let Err(error) = spawned {
            eprintln!("[Pake] Failed to start the color scheme listener: {error}");
        }
    }
}

#[cfg(target_os = "linux")]
pub use portal::follow_desktop_color_scheme;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_missing_dark_theme_uses_its_installed_base() {
        let installed = |name: &str| matches!(name, "Adwaita" | "Yaru");
        assert_eq!(dark_theme_base("Adwaita-dark", installed), Some("Adwaita"));
        assert_eq!(dark_theme_base("Yaru-Dark", installed), Some("Yaru"));
    }

    #[test]
    fn an_installed_or_unrelated_theme_is_left_alone() {
        let installed = |name: &str| matches!(name, "Adwaita" | "Adwaita-dark");
        assert_eq!(dark_theme_base("Adwaita-dark", installed), None);
        assert_eq!(dark_theme_base("Missing", installed), None);
        assert_eq!(dark_theme_base("Missing-dark", installed), None);
        assert_eq!(dark_theme_base("-dark", |_| true), None);
        assert_eq!(dark_theme_base("-dark", |name| name.is_empty()), None);
    }

    #[test]
    fn prefer_dark_applies_dark() {
        assert_eq!(
            color_scheme_action(1, true),
            ColorSchemeAction::Apply(Some(Theme::Dark))
        );
        assert_eq!(
            color_scheme_action(1, false),
            ColorSchemeAction::Apply(Some(Theme::Dark))
        );
    }

    #[test]
    fn prefer_light_clears_dark_even_at_startup() {
        assert_eq!(
            color_scheme_action(2, true),
            ColorSchemeAction::Apply(Some(Theme::Light))
        );
        assert_eq!(
            color_scheme_action(2, false),
            ColorSchemeAction::Apply(Some(Theme::Light))
        );
    }

    #[test]
    fn no_preference_keeps_gtk_settings_at_startup() {
        assert_eq!(color_scheme_action(0, true), ColorSchemeAction::Keep);
    }

    #[test]
    fn no_preference_after_change_resets_theme() {
        assert_eq!(
            color_scheme_action(0, false),
            ColorSchemeAction::Apply(None)
        );
    }

    #[test]
    fn unknown_values_are_ignored() {
        assert_eq!(color_scheme_action(3, true), ColorSchemeAction::Keep);
        assert_eq!(
            color_scheme_action(u32::MAX, false),
            ColorSchemeAction::Keep
        );
    }

    #[cfg(target_os = "linux")]
    #[test]
    fn reads_plain_and_wrapped_portal_values() {
        use super::portal::color_scheme_value;
        use zbus::zvariant::Value;

        assert_eq!(color_scheme_value(&Value::U32(1)), Some(1));
        assert_eq!(
            color_scheme_value(&Value::Value(Box::new(Value::U32(2)))),
            Some(2)
        );
        assert_eq!(color_scheme_value(&Value::Str("dark".into())), None);
    }
}
