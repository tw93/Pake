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
