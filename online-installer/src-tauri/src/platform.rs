use std::path::Path;

#[cfg(target_os = "linux")]
use std::path::PathBuf;

use crate::model::{InstallerArtifact, OnlineManifest};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CommandSpec {
    pub program: String,
    pub args: Vec<String>,
}

impl CommandSpec {
    pub fn new(program: impl Into<String>, args: Vec<String>) -> Self {
        Self {
            program: program.into(),
            args,
        }
    }
}

pub fn select_artifact<'a>(
    manifest: &'a OnlineManifest,
    operating_system: &str,
    os_release: &str,
) -> Result<&'a InstallerArtifact, String> {
    let preferred_formats: &[&str] = match operating_system {
        "windows" => &["msi"],
        "macos" => &["dmg"],
        "linux" if is_arch_family(os_release) => &["zst", "appimage"],
        "linux" if is_rpm_family(os_release) => &["rpm", "appimage"],
        "linux" => &["deb", "appimage"],
        other => return Err(format!("Unsupported operating system: {other}")),
    };

    preferred_formats
        .iter()
        .find_map(|format| {
            manifest
                .artifacts
                .iter()
                .find(|artifact| artifact.format.eq_ignore_ascii_case(format))
        })
        .ok_or_else(|| {
            format!(
                "No compatible {} installer is available in this release.",
                operating_system
            )
        })
}

fn os_release_tokens(os_release: &str) -> Vec<String> {
    os_release
        .lines()
        .filter_map(|line| line.split_once('='))
        .filter(|(key, _)| matches!(*key, "ID" | "ID_LIKE"))
        .flat_map(|(_, value)| {
            value
                .trim_matches('"')
                .split_whitespace()
                .map(str::to_lowercase)
                .collect::<Vec<_>>()
        })
        .collect()
}

fn is_arch_family(os_release: &str) -> bool {
    os_release_tokens(os_release)
        .iter()
        .any(|token| matches!(token.as_str(), "arch" | "manjaro" | "endeavouros"))
}

fn is_rpm_family(os_release: &str) -> bool {
    os_release_tokens(os_release).iter().any(|token| {
        matches!(
            token.as_str(),
            "fedora"
                | "rhel"
                | "centos"
                | "rocky"
                | "almalinux"
                | "ol"
                | "suse"
                | "opensuse"
                | "opensuse-leap"
                | "opensuse-tumbleweed"
        )
    })
}

#[cfg(windows)]
pub fn windows_installer_command(msi_path: &Path, log_path: &Path) -> CommandSpec {
    CommandSpec::new(
        "msiexec.exe",
        vec![
            "/i".into(),
            msi_path.display().to_string(),
            "/norestart".into(),
            "REINSTALL=ALL".into(),
            "REINSTALLMODE=amus".into(),
            "/L*V".into(),
            log_path.display().to_string(),
        ],
    )
}

#[cfg(target_os = "linux")]
pub fn linux_installer_command(
    artifact: &InstallerArtifact,
    artifact_path: &Path,
    os_release: &str,
) -> Result<Option<CommandSpec>, String> {
    let file = artifact_path.display().to_string();
    let spec = match artifact.format.as_str() {
        "deb" => CommandSpec::new(
            "pkexec",
            vec![
                "apt-get".into(),
                "install".into(),
                "--reinstall".into(),
                "-y".into(),
                file,
            ],
        ),
        "rpm" if os_release_tokens(os_release).iter().any(|id| id == "suse") => CommandSpec::new(
            "pkexec",
            vec![
                "zypper".into(),
                "--non-interactive".into(),
                "install".into(),
                "--allow-unsigned-rpm".into(),
                file,
            ],
        ),
        "rpm" => CommandSpec::new(
            "pkexec",
            vec!["dnf".into(), "install".into(), "-y".into(), file],
        ),
        "zst" => CommandSpec::new(
            "pkexec",
            vec!["pacman".into(), "-U".into(), "--noconfirm".into(), file],
        ),
        "appimage" => return Ok(None),
        format => return Err(format!("Unsupported Linux installer format: {format}")),
    };
    Ok(Some(spec))
}

#[cfg(any(target_os = "linux", test))]
pub fn linux_rpm_fallback_command(artifact_path: &Path) -> CommandSpec {
    CommandSpec::new(
        "pkexec",
        vec![
            "rpm".into(),
            "-U".into(),
            "--replacepkgs".into(),
            artifact_path.display().to_string(),
        ],
    )
}

#[cfg(target_os = "linux")]
pub fn appimage_install_paths(package_id: &str) -> Result<(PathBuf, PathBuf), String> {
    let home = std::env::var_os("HOME")
        .map(PathBuf::from)
        .ok_or_else(|| "HOME is unavailable; cannot install the AppImage.".to_string())?;
    let safe_name: String = package_id
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() || matches!(character, '-' | '_') {
                character
            } else {
                '-'
            }
        })
        .collect();
    Ok((
        home.join(".local")
            .join("opt")
            .join(format!("{safe_name}.AppImage")),
        home.join(".local")
            .join("share")
            .join("applications")
            .join(format!("{safe_name}.desktop")),
    ))
}

#[cfg(test)]
mod tests {
    use crate::model::{Application, InstallerArtifact, OnlineManifest, Platform, SourceBuild};

    use super::*;

    fn manifest() -> OnlineManifest {
        let artifact = |format: &str| InstallerArtifact {
            name: format!("app.{format}"),
            format: format.into(),
            size: 1,
            sha256: "a".repeat(64),
            download_url: format!("https://example.invalid/app.{format}"),
            package_id: "example".into(),
        };
        OnlineManifest {
            schema_version: 1,
            config_id: "id".into(),
            repository: "owner/repo".into(),
            release_tag: "tag".into(),
            source: SourceBuild {
                branch: "main".into(),
                sha: "0123456789ab".into(),
                built_at: "now".into(),
            },
            application: Application {
                name: "Example".into(),
                version: "1".into(),
            },
            platform: Platform {
                runner: "ubuntu".into(),
                os: "linux".into(),
                arch: "x64".into(),
            },
            artifacts: vec![
                artifact("deb"),
                artifact("rpm"),
                artifact("zst"),
                artifact("appimage"),
            ],
        }
    }

    #[test]
    fn selects_linux_packages_from_os_release() {
        let value = manifest();
        assert_eq!(
            select_artifact(&value, "linux", "ID=ubuntu\nID_LIKE=debian")
                .unwrap()
                .format,
            "deb"
        );
        assert_eq!(
            select_artifact(&value, "linux", "ID=fedora\nID_LIKE=rhel")
                .unwrap()
                .format,
            "rpm"
        );
        assert_eq!(
            select_artifact(&value, "linux", "ID=arch").unwrap().format,
            "zst"
        );
    }

    #[test]
    fn falls_back_to_appimage_when_the_native_family_is_missing() {
        let mut value = manifest();
        value
            .artifacts
            .retain(|artifact| artifact.format == "appimage");
        assert_eq!(
            select_artifact(&value, "linux", "ID=fedora")
                .unwrap()
                .format,
            "appimage"
        );
    }

    #[cfg(windows)]
    #[test]
    fn windows_msi_command_enables_reinstall_and_verbose_logging() {
        let command = windows_installer_command(
            Path::new(r"C:\Temp\app.msi"),
            Path::new(r"C:\Temp\install.log"),
        );
        assert_eq!(command.program, "msiexec.exe");
        assert!(command.args.iter().any(|value| value == "REINSTALL=ALL"));
        assert!(command
            .args
            .iter()
            .any(|value| value == "REINSTALLMODE=amus"));
        assert!(command.args.iter().any(|value| value == "/L*V"));
    }

    #[test]
    fn rpm_fallback_reinstalls_the_verified_local_package() {
        let command = linux_rpm_fallback_command(Path::new("/tmp/app.rpm"));
        assert_eq!(command.program, "pkexec");
        assert_eq!(command.args, ["rpm", "-U", "--replacepkgs", "/tmp/app.rpm"]);
    }
}
