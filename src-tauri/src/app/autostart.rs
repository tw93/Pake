//! Open at login for apps made from a runtime template.
//!
//! A builder writes `launch_at_login` into pake.json and the app keeps its own
//! login item in step each time it starts, so the item always names where the
//! app really is. Each system gets its own per-user form: a LaunchAgent on
//! macOS, a Run value on Windows, an XDG autostart entry on Linux, all named
//! by the app identifier. Tauri's autostart plugin does the same but needs a
//! newer Tauri than this tree locks.

use std::path::Path;

/// Writes or removes the login item. Failures are logged, never fatal: an app
/// that cannot register itself still has to open.
pub fn reconcile(enabled: bool, identifier: &str, name: &str) {
    let executable = match std::env::current_exe() {
        Ok(path) => path,
        Err(error) => {
            eprintln!("[Pake] Failed to resolve the executable for its login item: {error}");
            return;
        }
    };
    if let Err(error) = platform::reconcile(enabled, identifier, name, &executable) {
        eprintln!("[Pake] Failed to update the login item: {error}");
    }
}

/// Writes `content` only when the file differs, and removes it when `content` is None.
#[cfg(any(target_os = "macos", target_os = "linux", test))]
fn sync_file(path: &Path, content: Option<&str>) -> std::io::Result<()> {
    match content {
        Some(content) => {
            if std::fs::read_to_string(path).is_ok_and(|current| current == content) {
                return Ok(());
            }
            if let Some(parent) = path.parent() {
                std::fs::create_dir_all(parent)?;
            }
            std::fs::write(path, content)
        }
        None => match std::fs::remove_file(path) {
            Err(error) if error.kind() != std::io::ErrorKind::NotFound => Err(error),
            _ => Ok(()),
        },
    }
}

#[cfg(any(target_os = "macos", test))]
fn xml_escape(text: &str) -> String {
    text.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
}

/// A LaunchAgent that starts the app's own executable once at login.
#[cfg(any(target_os = "macos", test))]
pub(crate) fn launch_agent(identifier: &str, executable: &Path) -> String {
    format!(
        r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>{}</string>
    <key>ProgramArguments</key>
    <array>
        <string>{}</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>ProcessType</key>
    <string>Interactive</string>
</dict>
</plist>
"#,
        xml_escape(identifier),
        xml_escape(&executable.to_string_lossy())
    )
}

/// A desktop-entry string value: the format unescapes backslash sequences before anything else.
#[cfg(any(target_os = "linux", test))]
fn entry_value(text: &str) -> String {
    text.replace('\\', "\\\\")
        .replace('\n', "\\n")
        .replace('\r', "\\r")
        .replace('\t', "\\t")
}

/// An XDG autostart entry, or None for a path the Exec key cannot carry (`=`, a control
/// character). The argument is quoted first (a backslash before `"`, a backtick, `$` and `\`,
/// `%` doubled) and then escaped as a string value, since unescaping happens before unquoting.
/// GLib checks argv[0] before it expands `%%`, so a path with `%` is passed to env instead.
#[cfg(any(target_os = "linux", test))]
pub(crate) fn autostart_entry(name: &str, executable: &Path) -> Option<String> {
    let path = executable.to_string_lossy();
    if path.contains('=') || path.chars().any(char::is_control) {
        return None;
    }
    let mut quoted = String::with_capacity(path.len() + 2);
    quoted.push('"');
    for character in path.chars() {
        match character {
            '"' | '`' | '$' | '\\' => {
                quoted.push('\\');
                quoted.push(character);
            }
            '%' => quoted.push_str("%%"),
            _ => quoted.push(character),
        }
    }
    quoted.push('"');
    let command = if path.contains('%') {
        format!("/usr/bin/env -- {}", entry_value(&quoted))
    } else {
        entry_value(&quoted)
    };
    let name: String = name.chars().filter(|c| !c.is_control()).collect();
    Some(format!(
        "[Desktop Entry]\nType=Application\nName={}\nExec={command}\nTerminal=false\nX-GNOME-Autostart-enabled=true\n",
        entry_value(&name)
    ))
}

#[cfg(target_os = "macos")]
mod platform {
    use super::*;

    pub fn reconcile(
        enabled: bool,
        identifier: &str,
        _name: &str,
        executable: &Path,
    ) -> std::io::Result<()> {
        let Some(home) = std::env::var_os("HOME") else {
            return Ok(());
        };
        let path = Path::new(&home)
            .join("Library/LaunchAgents")
            .join(format!("{identifier}.plist"));
        let content = enabled.then(|| launch_agent(identifier, executable));
        sync_file(&path, content.as_deref())
    }
}

#[cfg(target_os = "linux")]
mod platform {
    use super::*;

    pub fn reconcile(
        enabled: bool,
        identifier: &str,
        name: &str,
        executable: &Path,
    ) -> std::io::Result<()> {
        let config = std::env::var_os("XDG_CONFIG_HOME")
            .filter(|value| !value.is_empty())
            .map(std::path::PathBuf::from)
            .or_else(|| std::env::var_os("HOME").map(|home| Path::new(&home).join(".config")));
        let Some(config) = config else {
            return Ok(());
        };
        let path = config
            .join("autostart")
            .join(format!("{identifier}.desktop"));
        // A path the entry cannot carry gets no login item rather than a broken one.
        let content = if enabled {
            autostart_entry(name, executable)
        } else {
            None
        };
        sync_file(&path, content.as_deref())
    }
}

#[cfg(target_os = "windows")]
mod platform {
    use super::*;
    use std::os::windows::ffi::OsStrExt;
    use std::ptr;
    use windows_sys::Win32::Foundation::{ERROR_FILE_NOT_FOUND, ERROR_SUCCESS};
    use windows_sys::Win32::System::Registry::{
        RegCloseKey, RegCreateKeyExW, RegDeleteValueW, RegSetValueExW, HKEY, HKEY_CURRENT_USER,
        KEY_SET_VALUE, REG_OPTION_NON_VOLATILE, REG_SZ,
    };

    fn wide(text: &str) -> Vec<u16> {
        text.encode_utf16().chain(std::iter::once(0)).collect()
    }

    pub fn reconcile(
        enabled: bool,
        identifier: &str,
        _name: &str,
        executable: &Path,
    ) -> std::io::Result<()> {
        let subkey = wide(r"Software\Microsoft\Windows\CurrentVersion\Run");
        let value_name = wide(identifier);
        let mut key: HKEY = ptr::null_mut();
        let opened = unsafe {
            RegCreateKeyExW(
                HKEY_CURRENT_USER,
                subkey.as_ptr(),
                0,
                ptr::null(),
                REG_OPTION_NON_VOLATILE,
                KEY_SET_VALUE,
                ptr::null(),
                &mut key,
                ptr::null_mut(),
            )
        };
        if opened != ERROR_SUCCESS {
            return Err(std::io::Error::from_raw_os_error(opened as i32));
        }
        let status = if enabled {
            // The command line is the quoted path, so a space in it is not an argument break.
            let mut command: Vec<u16> = vec![u16::from(b'"')];
            command.extend(executable.as_os_str().encode_wide());
            command.push(u16::from(b'"'));
            command.push(0);
            unsafe {
                RegSetValueExW(
                    key,
                    value_name.as_ptr(),
                    0,
                    REG_SZ,
                    command.as_ptr().cast(),
                    (command.len() * 2) as u32,
                )
            }
        } else {
            match unsafe { RegDeleteValueW(key, value_name.as_ptr()) } {
                ERROR_FILE_NOT_FOUND => ERROR_SUCCESS,
                other => other,
            }
        };
        unsafe { RegCloseKey(key) };
        if status != ERROR_SUCCESS {
            return Err(std::io::Error::from_raw_os_error(status as i32));
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_launch_agent_starts_the_apps_own_executable_at_login() {
        let plist = launch_agent(
            "com.pake.a928b2e",
            Path::new("/Applications/Q&A.app/Contents/MacOS/Q&A"),
        );
        assert!(plist.contains("<string>com.pake.a928b2e</string>"));
        assert!(plist.contains("<string>/Applications/Q&amp;A.app/Contents/MacOS/Q&amp;A</string>"));
        assert!(plist.contains("<key>RunAtLoad</key>\n    <true/>"));
    }

    #[test]
    fn the_autostart_entry_quotes_then_escapes_the_path() {
        let entry = autostart_entry("Hacker\nNews", Path::new("/home/a b/com.pake.a1")).unwrap();
        assert!(entry.contains("Name=HackerNews\n"));
        assert!(entry.contains("Exec=\"/home/a b/com.pake.a1\"\n"));
        assert!(entry.starts_with("[Desktop Entry]\nType=Application\n"));

        // Quoted first, then escaped as a string value: a `$` gets one backslash, doubled.
        let odd = autostart_entry("A", Path::new("/home/a$b/x")).unwrap();
        assert!(odd.contains("Exec=\"/home/a\\\\$b/x\"\n"), "{odd}");
        // GLib checks argv[0] before expanding %%, so env carries such a path.
        let percent = autostart_entry("A", Path::new("/home/50%/x")).unwrap();
        assert!(
            percent.contains("Exec=/usr/bin/env -- \"/home/50%%/x\"\n"),
            "{percent}"
        );
        assert!(autostart_entry("A", Path::new("/home/a=b/x")).is_none());
    }

    #[test]
    fn a_login_item_file_is_written_once_and_removed_when_turned_off() {
        let dir = std::env::temp_dir().join(format!("pake-autostart-{}", std::process::id()));
        let path = dir.join("nested").join("item.plist");
        sync_file(&path, Some("one")).unwrap();
        let written = std::fs::metadata(&path).unwrap().modified().unwrap();
        sync_file(&path, Some("one")).unwrap();
        assert_eq!(
            std::fs::metadata(&path).unwrap().modified().unwrap(),
            written
        );
        sync_file(&path, None).unwrap();
        assert!(!path.exists());
        sync_file(&path, None).unwrap();
        std::fs::remove_dir_all(&dir).unwrap();
    }
}
