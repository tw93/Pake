use serde::{Deserialize, Serialize};
use url::Url;

pub const MANIFEST_SCHEMA_VERSION: u32 = 1;
const MAX_MANIFEST_BYTES: u64 = 1024 * 1024;

#[derive(Debug, Clone)]
pub struct ReleaseChannel {
    pub repository: String,
    pub release_tag: String,
    pub config_id: String,
}

impl ReleaseChannel {
    pub fn from_build_environment() -> Result<Self, String> {
        let repository = option_env!("PAKE_ONLINE_REPOSITORY")
            .unwrap_or_default()
            .trim()
            .to_string();
        let release_tag = option_env!("PAKE_ONLINE_RELEASE_TAG")
            .unwrap_or_default()
            .trim()
            .to_string();
        let config_id = option_env!("PAKE_ONLINE_CONFIG_ID")
            .unwrap_or_default()
            .trim()
            .to_string();
        let channel = Self {
            repository,
            release_tag,
            config_id,
        };
        channel.validate()?;
        Ok(channel)
    }

    pub fn validate(&self) -> Result<(), String> {
        let mut repository_parts = self.repository.split('/');
        let owner = repository_parts.next().unwrap_or_default();
        let name = repository_parts.next().unwrap_or_default();
        if owner.is_empty()
            || name.is_empty()
            || repository_parts.next().is_some()
            || !owner.chars().all(is_github_identifier_character)
            || !name.chars().all(is_github_identifier_character)
        {
            return Err("The embedded repository must use a safe owner/name value.".into());
        }
        if !is_safe_channel_value(&self.release_tag) || !is_safe_channel_value(&self.config_id) {
            return Err("The embedded release channel is invalid.".into());
        }
        Ok(())
    }

    pub fn release_api_url(&self) -> String {
        format!(
            "https://api.github.com/repos/{}/releases/tags/{}",
            self.repository, self.release_tag
        )
    }
}

fn is_github_identifier_character(character: char) -> bool {
    character.is_ascii_alphanumeric() || matches!(character, '-' | '_' | '.')
}

fn is_safe_channel_value(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 120
        && value
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || matches!(character, '-' | '_'))
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GithubRelease {
    pub assets: Vec<GithubReleaseAsset>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct GithubReleaseAsset {
    pub id: u64,
    pub name: String,
    pub size: u64,
    pub browser_download_url: String,
    pub digest: Option<String>,
}

impl GithubReleaseAsset {
    pub fn validate_manifest_url(&self, channel: &ReleaseChannel) -> Result<(), String> {
        let url = Url::parse(&self.browser_download_url)
            .map_err(|error| format!("The manifest asset URL is invalid: {error}"))?;
        let expected_path = format!(
            "/{}/releases/download/{}/{}",
            channel.repository, channel.release_tag, self.name
        );
        if url.scheme() != "https"
            || url.host_str() != Some("github.com")
            || url.path() != expected_path
            || url.query().is_some()
            || url.fragment().is_some()
        {
            return Err("The manifest asset points outside this release channel.".into());
        }
        Ok(())
    }
}

impl GithubRelease {
    pub fn manifest_assets(&self) -> Vec<&GithubReleaseAsset> {
        let mut assets: Vec<_> = self
            .assets
            .iter()
            .filter(|asset| {
                asset.name.starts_with("pake-online-manifest-")
                    && asset.name.ends_with(".json")
                    && asset.size > 0
                    && asset.size <= MAX_MANIFEST_BYTES
            })
            .collect();
        assets.sort_by_key(|asset| std::cmp::Reverse(asset.id));
        assets
    }
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OnlineManifest {
    pub schema_version: u32,
    pub config_id: String,
    pub repository: String,
    pub release_tag: String,
    pub source: SourceBuild,
    pub application: Application,
    pub platform: Platform,
    pub artifacts: Vec<InstallerArtifact>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceBuild {
    pub branch: String,
    pub sha: String,
    pub built_at: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Application {
    pub name: String,
    pub version: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Platform {
    pub runner: String,
    pub os: String,
    pub arch: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallerArtifact {
    pub name: String,
    pub format: String,
    pub size: u64,
    pub sha256: String,
    pub download_url: String,
    pub package_id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub expanded_size: Option<u64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub executable_name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub executable_sha256: Option<String>,
}

impl OnlineManifest {
    pub fn validate(&self, channel: &ReleaseChannel) -> Result<(), String> {
        if self.schema_version != MANIFEST_SCHEMA_VERSION {
            return Err(format!(
                "Unsupported manifest schema version: {}",
                self.schema_version
            ));
        }
        if self.repository != channel.repository
            || self.release_tag != channel.release_tag
            || self.config_id != channel.config_id
        {
            return Err("The manifest does not belong to this online installer channel.".into());
        }
        if self.application.name.trim().is_empty() || self.source.branch.trim().is_empty() {
            return Err("The manifest is missing application or source metadata.".into());
        }
        if self.platform.os.trim().is_empty() || self.platform.arch.trim().is_empty() {
            return Err("The manifest is missing platform metadata.".into());
        }
        if self.source.sha.len() < 12
            || !self
                .source
                .sha
                .chars()
                .all(|character| character.is_ascii_hexdigit())
        {
            return Err("The manifest contains an invalid source commit.".into());
        }
        if self.artifacts.is_empty() {
            return Err("The manifest does not contain an installer artifact.".into());
        }
        for artifact in &self.artifacts {
            validate_artifact(artifact, channel)?;
        }
        Ok(())
    }
}

fn validate_artifact(artifact: &InstallerArtifact, channel: &ReleaseChannel) -> Result<(), String> {
    if artifact.name.is_empty()
        || artifact.name.contains('/')
        || artifact.name.contains('\\')
        || artifact.size == 0
        || artifact.package_id.trim().is_empty()
        || !matches!(
            artifact.format.as_str(),
            "msi" | "exe" | "dmg" | "deb" | "rpm" | "zst" | "appimage" | "tar.zst"
        )
    {
        return Err("The manifest contains invalid artifact metadata.".into());
    }
    if artifact.sha256.len() != 64
        || !artifact
            .sha256
            .chars()
            .all(|character| character.is_ascii_hexdigit())
    {
        return Err(format!(
            "Artifact {} has an invalid SHA-256.",
            artifact.name
        ));
    }
    if artifact.format == "tar.zst" {
        let executable_name = artifact
            .executable_name
            .as_deref()
            .ok_or_else(|| "The Windows payload is missing its executable name.".to_string())?;
        let executable_sha256 = artifact
            .executable_sha256
            .as_deref()
            .ok_or_else(|| "The Windows payload is missing its executable digest.".to_string())?;
        if artifact.expanded_size == Some(0)
            || artifact.expanded_size.is_none()
            || artifact
                .expanded_size
                .is_some_and(|size| size > 512 * 1024 * 1024)
            || executable_name.is_empty()
            || executable_name.contains('/')
            || executable_name.contains('\\')
            || !executable_name.to_ascii_lowercase().ends_with(".exe")
            || executable_sha256.len() != 64
            || !executable_sha256
                .chars()
                .all(|character| character.is_ascii_hexdigit())
        {
            return Err("The Windows payload contains invalid archive metadata.".into());
        }
    }
    let url = Url::parse(&artifact.download_url)
        .map_err(|error| format!("Artifact {} has an invalid URL: {error}", artifact.name))?;
    if url.scheme() != "https" || url.host_str() != Some("github.com") {
        return Err(format!(
            "Artifact {} must be downloaded from GitHub over HTTPS.",
            artifact.name
        ));
    }
    let expected_prefix = format!(
        "/{}/releases/download/{}/",
        channel.repository, channel.release_tag
    );
    if !url.path().starts_with(&expected_prefix)
        || url.path_segments().and_then(Iterator::last) != Some(artifact.name.as_str())
        || url.query().is_some()
        || url.fragment().is_some()
    {
        return Err(format!(
            "Artifact {} points outside this release channel.",
            artifact.name
        ));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn channel() -> ReleaseChannel {
        ReleaseChannel {
            repository: "owner/repo".into(),
            release_tag: "pake-online-example".into(),
            config_id: "example-windows-123".into(),
        }
    }

    fn manifest() -> OnlineManifest {
        OnlineManifest {
            schema_version: 1,
            config_id: "example-windows-123".into(),
            repository: "owner/repo".into(),
            release_tag: "pake-online-example".into(),
            source: SourceBuild {
                branch: "main".into(),
                sha: "0123456789abcdef".into(),
                built_at: "2026-07-23T00:00:00Z".into(),
            },
            application: Application {
                name: "Example".into(),
                version: "1.0.0".into(),
            },
            platform: Platform {
                runner: "windows-latest".into(),
                os: "windows".into(),
                arch: "X64".into(),
            },
            artifacts: vec![InstallerArtifact {
                name: "example.msi".into(),
                format: "msi".into(),
                size: 42,
                sha256: "a".repeat(64),
                download_url:
                    "https://github.com/owner/repo/releases/download/pake-online-example/example.msi"
                        .into(),
                package_id: "example".into(),
                expanded_size: None,
                executable_name: None,
                executable_sha256: None,
            }],
        }
    }

    #[test]
    fn accepts_a_manifest_bound_to_the_embedded_channel() {
        assert!(manifest().validate(&channel()).is_ok());
    }

    #[test]
    fn rejects_cross_repository_and_non_https_artifacts() {
        let mut wrong_repository = manifest();
        wrong_repository.repository = "other/repo".into();
        assert!(wrong_repository.validate(&channel()).is_err());

        let mut insecure = manifest();
        insecure.artifacts[0].download_url =
            "http://github.com/owner/repo/releases/download/pake-online-example/example.msi".into();
        assert!(insecure.validate(&channel()).is_err());
    }

    #[test]
    fn requires_bounded_metadata_for_windows_tar_zst_payloads() {
        let mut value = manifest();
        let artifact = &mut value.artifacts[0];
        artifact.name = "example.tar.zst".into();
        artifact.format = "tar.zst".into();
        artifact.download_url =
            "https://github.com/owner/repo/releases/download/pake-online-example/example.tar.zst"
                .into();
        assert!(value.validate(&channel()).is_err());

        let artifact = &mut value.artifacts[0];
        artifact.expanded_size = Some(42);
        artifact.executable_name = Some("app.exe".into());
        artifact.executable_sha256 = Some("b".repeat(64));
        assert!(value.validate(&channel()).is_ok());
    }

    #[test]
    fn selects_the_newest_bounded_manifest_asset() {
        let release = GithubRelease {
            assets: vec![
                GithubReleaseAsset {
                    id: 1,
                    name: "pake-online-manifest-old.json".into(),
                    size: 10,
                    browser_download_url: "https://example.invalid/old".into(),
                    digest: None,
                },
                GithubReleaseAsset {
                    id: 2,
                    name: "pake-online-manifest-new.json".into(),
                    size: 10,
                    browser_download_url: "https://example.invalid/new".into(),
                    digest: None,
                },
            ],
        };
        assert_eq!(release.manifest_assets()[0].id, 2);
    }

    #[test]
    fn validates_the_manifest_asset_github_url() {
        let mut asset = GithubReleaseAsset {
            id: 1,
            name: "pake-online-manifest-new.json".into(),
            size: 10,
            browser_download_url: "https://github.com/owner/repo/releases/download/pake-online-example/pake-online-manifest-new.json".into(),
            digest: None,
        };
        assert!(asset.validate_manifest_url(&channel()).is_ok());
        asset.browser_download_url = "https://example.com/pake-online-manifest-new.json".into();
        assert!(asset.validate_manifest_url(&channel()).is_err());
    }

    #[test]
    fn reads_githubs_snake_case_asset_metadata() {
        let release: GithubRelease = serde_json::from_str(
            r#"{"assets":[{"id":1,"name":"pake-online-manifest-new.json","size":10,"browser_download_url":"https://github.com/owner/repo/releases/download/pake-online-example/pake-online-manifest-new.json"}]}"#,
        )
        .unwrap();
        assert_eq!(
            release.assets[0].browser_download_url,
            "https://github.com/owner/repo/releases/download/pake-online-example/pake-online-manifest-new.json"
        );
    }
}
