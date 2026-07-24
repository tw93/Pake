use std::fs::{self, File, OpenOptions};
use std::io::{self, Read};
use std::path::{Component, Path, PathBuf};

use serde::Serialize;
use sha2::{Digest, Sha256};

use crate::model::InstallerArtifact;

const PAYLOAD_EXECUTABLE: &str = "app.exe";
const MAX_WINDOWS_PAYLOAD_SIZE: u64 = 512 * 1024 * 1024;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PayloadMetadata {
    format: &'static str,
    expanded_size: u64,
    executable_name: &'static str,
    executable_sha256: String,
}

#[cfg(windows)]
pub struct WindowsPayloadActivation {
    pub executable: PathBuf,
    pub cleanup_warnings: Vec<String>,
}

#[cfg(windows)]
pub fn find_cached_windows_payload(
    artifact: &InstallerArtifact,
    config_id: &str,
    source_sha: &str,
) -> Result<Option<WindowsPayloadActivation>, String> {
    let expanded_size = artifact
        .expanded_size
        .ok_or_else(|| "The Windows payload is missing its expanded size.".to_string())?;
    if expanded_size == 0 || expanded_size > MAX_WINDOWS_PAYLOAD_SIZE {
        return Err("The Windows payload expanded size exceeds the safety limit.".into());
    }
    let executable_name = artifact
        .executable_name
        .as_deref()
        .ok_or_else(|| "The Windows payload is missing its executable name.".to_string())?;
    validate_single_file_name(executable_name)?;
    let expected_digest = artifact
        .executable_sha256
        .as_deref()
        .ok_or_else(|| "The Windows payload is missing its executable digest.".to_string())?;
    let local_app_data = std::env::var_os("LOCALAPPDATA")
        .map(PathBuf::from)
        .ok_or_else(|| {
            "LOCALAPPDATA is unavailable; cannot inspect the online payload.".to_string()
        })?;
    let versions = local_app_data
        .join("Pake")
        .join("Online")
        .join(config_id)
        .join("versions");
    let executable = versions.join(source_sha).join(executable_name);
    if !executable.is_file() {
        return Ok(None);
    }
    let matches_size = fs::metadata(&executable)
        .map(|metadata| metadata.len() == expanded_size)
        .unwrap_or(false);
    if !matches_size || !sha256_file(&executable)?.eq_ignore_ascii_case(expected_digest) {
        return Ok(None);
    }
    Ok(Some(WindowsPayloadActivation {
        executable,
        cleanup_warnings: cleanup_old_versions(&versions, source_sha),
    }))
}

pub fn pack_windows_payload(
    executable_path: &Path,
    archive_path: &Path,
    metadata_path: &Path,
) -> Result<(), String> {
    let metadata = fs::metadata(executable_path)
        .map_err(|error| format!("Failed to inspect the Windows executable: {error}"))?;
    if !metadata.is_file() || metadata.len() == 0 {
        return Err("The Windows payload executable is empty or is not a file.".into());
    }
    if metadata.len() > MAX_WINDOWS_PAYLOAD_SIZE {
        return Err("The Windows payload executable exceeds the safety limit.".into());
    }

    let input = File::open(executable_path)
        .map_err(|error| format!("Failed to open the Windows executable: {error}"))?;
    let output = File::create(archive_path)
        .map_err(|error| format!("Failed to create the payload archive: {error}"))?;
    let mut encoder = zstd::Encoder::new(output, 19)
        .map_err(|error| format!("Failed to initialize Zstandard compression: {error}"))?;
    encoder
        .include_checksum(true)
        .map_err(|error| format!("Failed to enable the Zstandard checksum: {error}"))?;

    let mut archive = tar::Builder::new(encoder);
    archive.mode(tar::HeaderMode::Deterministic);
    let mut header = tar::Header::new_gnu();
    header.set_size(metadata.len());
    header.set_mode(0o755);
    header.set_uid(0);
    header.set_gid(0);
    header.set_mtime(0);
    header.set_cksum();
    archive
        .append_data(&mut header, PAYLOAD_EXECUTABLE, input)
        .map_err(|error| format!("Failed to write the payload archive: {error}"))?;
    let encoder = archive
        .into_inner()
        .map_err(|error| format!("Failed to finish the tar archive: {error}"))?;
    encoder
        .finish()
        .map_err(|error| format!("Failed to finish Zstandard compression: {error}"))?;

    let payload_metadata = PayloadMetadata {
        format: "tar.zst",
        expanded_size: metadata.len(),
        executable_name: PAYLOAD_EXECUTABLE,
        executable_sha256: sha256_file(executable_path)?,
    };
    let json = serde_json::to_vec_pretty(&payload_metadata)
        .map_err(|error| format!("Failed to serialize payload metadata: {error}"))?;
    fs::write(metadata_path, json)
        .map_err(|error| format!("Failed to write payload metadata: {error}"))
}

#[cfg(windows)]
pub fn install_windows_payload(
    archive_path: &Path,
    artifact: &InstallerArtifact,
    config_id: &str,
    source_sha: &str,
) -> Result<WindowsPayloadActivation, String> {
    let expanded_size = artifact
        .expanded_size
        .ok_or_else(|| "The Windows payload is missing its expanded size.".to_string())?;
    if expanded_size == 0 || expanded_size > MAX_WINDOWS_PAYLOAD_SIZE {
        return Err("The Windows payload expanded size exceeds the safety limit.".into());
    }
    let executable_name = artifact
        .executable_name
        .as_deref()
        .ok_or_else(|| "The Windows payload is missing its executable name.".to_string())?;
    validate_single_file_name(executable_name)?;
    let expected_digest = artifact
        .executable_sha256
        .as_deref()
        .ok_or_else(|| "The Windows payload is missing its executable digest.".to_string())?;

    let local_app_data = std::env::var_os("LOCALAPPDATA")
        .map(PathBuf::from)
        .ok_or_else(|| {
            "LOCALAPPDATA is unavailable; cannot install the online payload.".to_string()
        })?;
    let versions = local_app_data
        .join("Pake")
        .join("Online")
        .join(config_id)
        .join("versions");
    fs::create_dir_all(&versions)
        .map_err(|error| format!("Failed to create the payload directory: {error}"))?;
    let destination = versions.join(source_sha);
    let executable = destination.join(executable_name);

    if executable.is_file()
        && fs::metadata(&executable)
            .map(|metadata| metadata.len() == expanded_size)
            .unwrap_or(false)
        && sha256_file(&executable)?.eq_ignore_ascii_case(expected_digest)
    {
        let cleanup_warnings = cleanup_old_versions(&versions, source_sha);
        return Ok(WindowsPayloadActivation {
            executable,
            cleanup_warnings,
        });
    }
    if destination.exists() {
        fs::remove_dir_all(&destination)
            .map_err(|error| format!("Failed to clear an invalid cached payload: {error}"))?;
    }

    let staging = tempfile::Builder::new()
        .prefix(".pake-payload-")
        .tempdir_in(&versions)
        .map_err(|error| format!("Failed to create the payload staging directory: {error}"))?;
    let staged_executable = staging.path().join(executable_name);
    extract_single_windows_executable(
        archive_path,
        &staged_executable,
        executable_name,
        expanded_size,
    )?;
    let actual_digest = sha256_file(&staged_executable)?;
    if !actual_digest.eq_ignore_ascii_case(expected_digest) {
        return Err("The extracted Windows executable failed SHA-256 verification.".into());
    }

    let staging_path = staging.keep();
    match fs::rename(&staging_path, &destination) {
        Ok(()) => {
            let cleanup_warnings = cleanup_old_versions(&versions, source_sha);
            Ok(WindowsPayloadActivation {
                executable,
                cleanup_warnings,
            })
        }
        Err(error) if destination.is_dir() => {
            fs::remove_dir_all(&staging_path).map_err(|cleanup_error| {
                format!(
                    "Another update activated concurrently, but staging cleanup failed: {cleanup_error}"
                )
            })?;
            if executable.is_file()
                && fs::metadata(&executable)
                    .map(|metadata| metadata.len() == expanded_size)
                    .unwrap_or(false)
                && sha256_file(&executable)?.eq_ignore_ascii_case(expected_digest)
            {
                let cleanup_warnings = cleanup_old_versions(&versions, source_sha);
                Ok(WindowsPayloadActivation {
                    executable,
                    cleanup_warnings,
                })
            } else {
                Err("A concurrent update produced an invalid payload.".into())
            }
        }
        Err(error) => {
            let cleanup = fs::remove_dir_all(&staging_path);
            match cleanup {
                Ok(()) => Err(format!("Failed to activate the Windows payload: {error}")),
                Err(cleanup_error) => Err(format!(
                    "Failed to activate the Windows payload: {error}; staging cleanup also failed: {cleanup_error}"
                )),
            }
        }
    }
}

#[cfg(windows)]
fn cleanup_old_versions(versions: &Path, current_sha: &str) -> Vec<String> {
    let entries = match fs::read_dir(versions) {
        Ok(entries) => entries,
        Err(error) => {
            return vec![format!(
                "Could not inspect old payload versions for cleanup: {error}"
            )];
        }
    };
    let mut old_versions: Vec<_> = entries
        .filter_map(|entry| match entry {
            Ok(entry)
                if entry.path().is_dir()
                    && entry.file_name().to_string_lossy() != current_sha
                    && !entry
                        .file_name()
                        .to_string_lossy()
                        .starts_with(".pake-payload-") =>
            {
                let modified = entry
                    .metadata()
                    .and_then(|metadata| metadata.modified())
                    .unwrap_or(std::time::SystemTime::UNIX_EPOCH);
                Some((modified, entry.path()))
            }
            _ => None,
        })
        .collect();
    old_versions.sort_by_key(|(modified, _)| std::cmp::Reverse(*modified));

    old_versions
        .into_iter()
        .skip(1)
        .filter_map(|(_, path)| {
            fs::remove_dir_all(&path).err().map(|error| {
                format!(
                    "Could not remove old payload version {}: {error}",
                    path.display()
                )
            })
        })
        .collect()
}

#[cfg(windows)]
fn extract_single_windows_executable(
    archive_path: &Path,
    output_path: &Path,
    expected_name: &str,
    expected_size: u64,
) -> Result<(), String> {
    let input = File::open(archive_path)
        .map_err(|error| format!("Failed to open the payload archive: {error}"))?;
    let decoder = zstd::Decoder::new(input)
        .map_err(|error| format!("Failed to decompress the payload archive: {error}"))?;
    let mut archive = tar::Archive::new(decoder);
    let mut entries = archive
        .entries()
        .map_err(|error| format!("Failed to inspect the payload archive: {error}"))?;
    let mut entry = entries
        .next()
        .transpose()
        .map_err(|error| format!("Failed to read the payload archive: {error}"))?
        .ok_or_else(|| "The payload archive is empty.".to_string())?;
    let path = entry
        .path()
        .map_err(|error| format!("The payload archive path is invalid: {error}"))?;
    let mut components = path.components();
    let valid_path = matches!(components.next(), Some(Component::Normal(name)) if name == expected_name)
        && components.next().is_none();
    if !valid_path || !entry.header().entry_type().is_file() {
        return Err("The payload archive must contain exactly one safe executable.".into());
    }
    if entry.size() != expected_size {
        return Err("The payload archive expanded size does not match the manifest.".into());
    }

    let mut output = OpenOptions::new()
        .create_new(true)
        .write(true)
        .open(output_path)
        .map_err(|error| format!("Failed to create the staged executable: {error}"))?;
    let copied = io::copy(&mut entry.by_ref().take(expected_size + 1), &mut output)
        .map_err(|error| format!("Failed to extract the Windows payload: {error}"))?;
    if copied != expected_size {
        return Err("The extracted Windows payload size does not match the manifest.".into());
    }
    if entries.next().is_some() {
        return Err("The payload archive contains unexpected additional entries.".into());
    }
    Ok(())
}

fn validate_single_file_name(name: &str) -> Result<(), String> {
    let path = Path::new(name);
    let mut components = path.components();
    let is_single =
        matches!(components.next(), Some(Component::Normal(_))) && components.next().is_none();
    if !is_single || !name.to_ascii_lowercase().ends_with(".exe") {
        return Err("The Windows payload executable name is unsafe.".into());
    }
    Ok(())
}

fn sha256_file(path: &Path) -> Result<String, String> {
    let mut file =
        File::open(path).map_err(|error| format!("Failed to hash {}: {error}", path.display()))?;
    let mut hash = Sha256::new();
    let mut buffer = [0_u8; 64 * 1024];
    loop {
        let read = file
            .read(&mut buffer)
            .map_err(|error| format!("Failed to hash {}: {error}", path.display()))?;
        if read == 0 {
            break;
        }
        hash.update(&buffer[..read]);
    }
    Ok(format!("{:x}", hash.finalize()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn produces_a_deterministic_single_file_tar_zst_payload() {
        let temporary = tempfile::tempdir().unwrap();
        let executable = temporary.path().join("source.exe");
        let first = temporary.path().join("first.tar.zst");
        let second = temporary.path().join("second.tar.zst");
        let first_metadata = temporary.path().join("first.json");
        let second_metadata = temporary.path().join("second.json");
        fs::write(&executable, b"pake-payload").unwrap();

        pack_windows_payload(&executable, &first, &first_metadata).unwrap();
        pack_windows_payload(&executable, &second, &second_metadata).unwrap();

        assert_eq!(fs::read(&first).unwrap(), fs::read(&second).unwrap());
        assert_eq!(
            fs::read(&first_metadata).unwrap(),
            fs::read(&second_metadata).unwrap()
        );
        let metadata: serde_json::Value =
            serde_json::from_slice(&fs::read(first_metadata).unwrap()).unwrap();
        assert_eq!(metadata["format"], "tar.zst");
        assert_eq!(metadata["expandedSize"], 12);
        assert_eq!(metadata["executableName"], PAYLOAD_EXECUTABLE);
    }

    #[test]
    fn rejects_nested_or_non_executable_payload_names() {
        assert!(validate_single_file_name("app.exe").is_ok());
        assert!(validate_single_file_name("../app.exe").is_err());
        assert!(validate_single_file_name("folder/app.exe").is_err());
        assert!(validate_single_file_name("app.dll").is_err());
    }

    #[cfg(windows)]
    #[test]
    fn extracts_only_the_declared_single_executable() {
        let temporary = tempfile::tempdir().unwrap();
        let source = temporary.path().join("source.exe");
        let archive = temporary.path().join("payload.tar.zst");
        let metadata = temporary.path().join("payload.json");
        let extracted = temporary.path().join("app.exe");
        fs::write(&source, b"verified executable").unwrap();
        pack_windows_payload(&source, &archive, &metadata).unwrap();

        extract_single_windows_executable(&archive, &extracted, "app.exe", 19).unwrap();
        assert_eq!(fs::read(extracted).unwrap(), b"verified executable");
    }

    #[cfg(windows)]
    #[test]
    fn rejects_an_archive_with_an_unexpected_path() {
        let temporary = tempfile::tempdir().unwrap();
        let archive_path = temporary.path().join("payload.tar.zst");
        let output = File::create(&archive_path).unwrap();
        let encoder = zstd::Encoder::new(output, 1).unwrap();
        let mut archive = tar::Builder::new(encoder);
        let bytes = b"unexpected";
        let mut header = tar::Header::new_gnu();
        header.set_size(bytes.len() as u64);
        header.set_mode(0o755);
        header.set_cksum();
        archive
            .append_data(&mut header, "other.exe", &bytes[..])
            .unwrap();
        archive.into_inner().unwrap().finish().unwrap();

        let result = extract_single_windows_executable(
            &archive_path,
            &temporary.path().join("app.exe"),
            "app.exe",
            bytes.len() as u64,
        );
        assert!(result.is_err());
    }
}
