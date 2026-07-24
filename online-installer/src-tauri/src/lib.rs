mod model;
mod network;
pub mod payload;
mod platform;

use std::fs;
use std::path::Path;
#[cfg(target_os = "macos")]
use std::path::PathBuf;
#[cfg(not(windows))]
use std::process::Stdio;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;

use futures_util::StreamExt;
use model::{GithubRelease, GithubReleaseAsset, InstallerArtifact, OnlineManifest, ReleaseChannel};
use network::{download_response, is_mainland_china};
use platform::select_artifact;
#[cfg(not(windows))]
use platform::CommandSpec;
use reqwest::{redirect::Policy, Client};
use serde::Serialize;
use sha2::{Digest, Sha256};
use tauri::ipc::Channel;
use tokio::io::AsyncWriteExt;
#[cfg(not(windows))]
use tokio::io::{AsyncBufReadExt, AsyncRead, BufReader};
#[cfg(not(windows))]
use tokio::process::Command;

const USER_AGENT: &str = "pake-online-installer/0.1";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct InstallerEvent {
    kind: String,
    message: String,
    downloaded: Option<u64>,
    total: Option<u64>,
    source_sha: Option<String>,
    application_name: Option<String>,
}

#[derive(Clone)]
struct Reporter {
    channel: Channel<InstallerEvent>,
}

impl Reporter {
    fn send(&self, kind: &str, message: impl Into<String>) {
        let _ = self.channel.send(InstallerEvent {
            kind: kind.into(),
            message: message.into(),
            downloaded: None,
            total: None,
            source_sha: None,
            application_name: None,
        });
    }

    fn progress(&self, downloaded: u64, total: u64) {
        let _ = self.channel.send(InstallerEvent {
            kind: "progress".into(),
            message: "Downloading the verified installer…".into(),
            downloaded: Some(downloaded),
            total: Some(total),
            source_sha: None,
            application_name: None,
        });
    }

    fn manifest(&self, manifest: &OnlineManifest) {
        let _ = self.channel.send(InstallerEvent {
            kind: "manifest".into(),
            message: format!(
                "Latest successful build: {}",
                short_sha(&manifest.source.sha)
            ),
            downloaded: None,
            total: None,
            source_sha: Some(manifest.source.sha.clone()),
            application_name: Some(manifest.application.name.clone()),
        });
    }
}

#[derive(Default)]
struct InstallState {
    running: AtomicBool,
}

struct RunningGuard<'a>(&'a AtomicBool);

impl Drop for RunningGuard<'_> {
    fn drop(&mut self) {
        self.0.store(false, Ordering::Release);
    }
}

#[tauri::command]
async fn start_install(
    state: tauri::State<'_, InstallState>,
    on_event: Channel<InstallerEvent>,
) -> Result<(), String> {
    if state
        .running
        .compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
        .is_err()
    {
        return Err("An installation is already running.".into());
    }
    let _guard = RunningGuard(&state.running);
    let reporter = Reporter { channel: on_event };
    reporter.send("status", "Resolving the latest successful build…");
    match install_latest(&reporter).await {
        Ok(()) => {
            reporter.send("complete", "Installation completed successfully.");
            Ok(())
        }
        Err(error) => {
            reporter.send("error", &error);
            Err(error)
        }
    }
}

async fn install_latest(reporter: &Reporter) -> Result<(), String> {
    let channel = ReleaseChannel::from_build_environment()?;
    let client = Client::builder()
        .user_agent(USER_AGENT)
        .redirect(Policy::limited(10))
        .connect_timeout(Duration::from_secs(12))
        .timeout(Duration::from_secs(20 * 60))
        .build()
        .map_err(|error| format!("Failed to initialize HTTPS: {error}"))?;

    let release: GithubRelease = client
        .get(channel.release_api_url())
        .send()
        .await
        .map_err(|error| format!("Failed to query the GitHub release: {error}"))?
        .error_for_status()
        .map_err(|error| format!("GitHub release lookup failed: {error}"))?
        .json()
        .await
        .map_err(|error| format!("GitHub returned invalid release metadata: {error}"))?;
    let manifest_assets: Vec<_> = release.manifest_assets().into_iter().cloned().collect();
    if manifest_assets.is_empty() {
        return Err("No completed online build manifest was found in the release.".into());
    }
    let use_china_proxy = is_mainland_china(&client).await;
    if use_china_proxy {
        reporter.send(
            "status",
            "Mainland China network detected; GitHub asset acceleration is enabled.",
        );
    }
    let mut selected_manifest = None;
    for manifest_asset in manifest_assets {
        let candidate = async {
            manifest_asset.validate_manifest_url(&channel)?;
            let manifest = download_manifest(&client, &manifest_asset, use_china_proxy).await?;
            manifest.validate(&channel)?;
            if manifest.platform.os != current_operating_system() {
                return Err(format!(
                    "This online installer targets {}, but the manifest targets {}.",
                    current_operating_system(),
                    manifest.platform.os
                ));
            }
            Ok::<_, String>(manifest)
        }
        .await;
        match candidate {
            Ok(manifest) => {
                selected_manifest = Some(manifest);
                break;
            }
            Err(error) => reporter.send(
                "stderr",
                format!("Skipped invalid manifest {}: {error}", manifest_asset.name),
            ),
        }
    }
    let manifest = selected_manifest
        .ok_or_else(|| "No valid completed online build manifest was found.".to_string())?;
    reporter.manifest(&manifest);

    let os_release = if cfg!(target_os = "linux") {
        fs::read_to_string("/etc/os-release").unwrap_or_default()
    } else {
        String::new()
    };
    let artifact = select_artifact(&manifest, current_operating_system(), &os_release)?.clone();
    reporter.send(
        "status",
        format!(
            "Selected {} installer: {}",
            artifact.format.to_uppercase(),
            artifact.name
        ),
    );

    #[cfg(windows)]
    {
        let cached_artifact = artifact.clone();
        let cached_config_id = manifest.config_id.clone();
        let cached_source_sha = manifest.source.sha.clone();
        if let Some(activation) = tokio::task::spawn_blocking(move || {
            payload::find_cached_windows_payload(
                &cached_artifact,
                &cached_config_id,
                &cached_source_sha,
            )
        })
        .await
        .map_err(|error| format!("The payload cache check failed: {error}"))??
        {
            reporter.send(
                "status",
                "The latest verified build is already cached; skipping the download.",
            );
            return launch_windows_payload(activation, reporter);
        }
    }

    let temporary = tempfile::tempdir()
        .map_err(|error| format!("Failed to create a temporary directory: {error}"))?;
    let artifact_path = temporary.path().join(&artifact.name);
    download_artifact(
        &client,
        &artifact,
        &artifact_path,
        use_china_proxy,
        reporter,
    )
    .await?;
    reporter.send("status", "SHA-256 verified. Activating the build…");
    install_artifact(&artifact, &artifact_path, &manifest, &os_release, reporter).await
}

async fn download_manifest(
    client: &Client,
    asset: &GithubReleaseAsset,
    use_china_proxy: bool,
) -> Result<OnlineManifest, String> {
    let expected_digest = asset
        .digest
        .as_deref()
        .and_then(|value| value.strip_prefix("sha256:"));
    // A proxy may carry the manifest only when GitHub's directly authenticated
    // release metadata gives us an independent digest for it.
    let (response, used_proxy) = download_response(
        client,
        &asset.browser_download_url,
        use_china_proxy && expected_digest.is_some(),
    )
    .await?;
    let first_result = read_manifest_response(response, asset, expected_digest).await;
    if first_result.is_ok() || !used_proxy {
        return first_result;
    }
    let (response, _) = download_response(client, &asset.browser_download_url, false).await?;
    read_manifest_response(response, asset, expected_digest).await
}

async fn read_manifest_response(
    response: reqwest::Response,
    asset: &GithubReleaseAsset,
    expected_digest: Option<&str>,
) -> Result<OnlineManifest, String> {
    if response.content_length().unwrap_or(asset.size) > 1024 * 1024 {
        return Err("The online build manifest is unexpectedly large.".into());
    }
    let bytes = read_response_with_limit(response, 1024 * 1024, "online build manifest").await?;
    if bytes.len() as u64 != asset.size {
        return Err("The online build manifest size does not match GitHub metadata.".into());
    }
    if let Some(expected) = expected_digest {
        let actual = format!("{:x}", Sha256::digest(&bytes));
        if !actual.eq_ignore_ascii_case(expected) {
            return Err("The online build manifest failed GitHub digest verification.".into());
        }
    }
    serde_json::from_slice(&bytes)
        .map_err(|error| format!("The online build manifest is invalid: {error}"))
}

async fn read_response_with_limit(
    response: reqwest::Response,
    limit: usize,
    label: &str,
) -> Result<Vec<u8>, String> {
    let mut stream = response.bytes_stream();
    let mut bytes = Vec::new();
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|error| format!("Failed to read the {label}: {error}"))?;
        if bytes.len().saturating_add(chunk.len()) > limit {
            return Err(format!("The {label} exceeded the allowed size."));
        }
        bytes.extend_from_slice(&chunk);
    }
    Ok(bytes)
}

async fn download_artifact(
    client: &Client,
    artifact: &InstallerArtifact,
    output_path: &Path,
    use_china_proxy: bool,
    reporter: &Reporter,
) -> Result<(), String> {
    let (response, used_proxy) =
        download_response(client, &artifact.download_url, use_china_proxy).await?;
    if use_china_proxy && !used_proxy {
        reporter.send(
            "stderr",
            "GitHub acceleration was unavailable; falling back to the official download URL.",
        );
    }
    let first_result = write_verified_artifact(response, artifact, output_path, reporter).await;
    if first_result.is_ok() || !used_proxy {
        return first_result;
    }
    reporter.send(
        "stderr",
        "The accelerated response failed verification; retrying from GitHub.",
    );
    let (response, _) = download_response(client, &artifact.download_url, false).await?;
    write_verified_artifact(response, artifact, output_path, reporter).await
}

async fn write_verified_artifact(
    response: reqwest::Response,
    artifact: &InstallerArtifact,
    output_path: &Path,
    reporter: &Reporter,
) -> Result<(), String> {
    let mut output = tokio::fs::File::create(output_path)
        .await
        .map_err(|error| format!("Failed to create the temporary installer: {error}"))?;
    let mut stream = response.bytes_stream();
    let mut hash = Sha256::new();
    let mut downloaded = 0_u64;
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|error| format!("Installer download failed: {error}"))?;
        if downloaded.saturating_add(chunk.len() as u64) > artifact.size {
            return Err("Installer download exceeded the manifest size.".into());
        }
        output
            .write_all(&chunk)
            .await
            .map_err(|error| format!("Failed to save the installer: {error}"))?;
        hash.update(&chunk);
        downloaded += chunk.len() as u64;
        reporter.progress(downloaded, artifact.size);
    }
    output
        .flush()
        .await
        .map_err(|error| format!("Failed to flush the installer: {error}"))?;
    let digest = format!("{:x}", hash.finalize());
    verify_installer_metadata(downloaded, &digest, artifact)
}

fn verify_installer_metadata(
    downloaded: u64,
    digest: &str,
    artifact: &InstallerArtifact,
) -> Result<(), String> {
    if downloaded != artifact.size {
        return Err(format!(
            "Installer size mismatch: expected {}, downloaded {} bytes.",
            artifact.size, downloaded
        ));
    }
    if !digest.eq_ignore_ascii_case(&artifact.sha256) {
        return Err("Installer SHA-256 verification failed. The file was discarded.".into());
    }
    Ok(())
}

async fn install_artifact(
    artifact: &InstallerArtifact,
    artifact_path: &Path,
    manifest: &OnlineManifest,
    os_release: &str,
    reporter: &Reporter,
) -> Result<(), String> {
    #[cfg(windows)]
    {
        let _ = os_release;
        let archive_path = artifact_path.to_path_buf();
        let artifact = artifact.clone();
        let config_id = manifest.config_id.clone();
        let source_sha = manifest.source.sha.clone();
        reporter.send("status", "Extracting the verified Zstandard payload…");
        let activation = tokio::task::spawn_blocking(move || {
            payload::install_windows_payload(&archive_path, &artifact, &config_id, &source_sha)
        })
        .await
        .map_err(|error| format!("The payload activation task failed: {error}"))??;
        return launch_windows_payload(activation, reporter);
    }

    #[cfg(target_os = "macos")]
    {
        return install_macos_dmg(artifact_path, reporter).await;
    }

    #[cfg(target_os = "linux")]
    {
        if let Some(mut command) =
            platform::linux_installer_command(artifact, artifact_path, os_release)?
        {
            if !command_exists("pkexec") {
                return Err(
                    "pkexec is required to authorize the system package installation.".into(),
                );
            }
            let package_manager = command.args.first().map(String::as_str).unwrap_or_default();
            if !command_exists(package_manager) {
                if artifact.format == "rpm" && command_exists("rpm") {
                    reporter.send(
                        "status",
                        format!("{package_manager} is unavailable; using rpm directly."),
                    );
                    command = platform::linux_rpm_fallback_command(artifact_path);
                } else {
                    return Err(format!(
                        "{package_manager} is required to install this package."
                    ));
                }
            }
            return run_command(command, reporter).await.map(|_| ());
        }
        return install_appimage(
            artifact_path,
            &artifact.package_id,
            &manifest.application.name,
            reporter,
        )
        .await;
    }

    #[allow(unreachable_code)]
    Err(format!(
        "No installation strategy is available for {}.",
        artifact.format
    ))
}

#[cfg(windows)]
fn launch_windows_payload(
    activation: payload::WindowsPayloadActivation,
    reporter: &Reporter,
) -> Result<(), String> {
    for warning in activation.cleanup_warnings {
        reporter.send("stderr", warning);
    }
    reporter.send(
        "stdout",
        format!(
            "Activated application at {}",
            activation.executable.display()
        ),
    );
    let forwarded_arguments: Vec<_> = std::env::args_os().skip(1).collect();
    std::process::Command::new(&activation.executable)
        .args(forwarded_arguments)
        .spawn()
        .map_err(|error| format!("Failed to launch the installed application: {error}"))?;
    reporter.send("stdout", "Launched the latest verified application build.");
    Ok(())
}

#[cfg(not(windows))]
async fn run_command(spec: CommandSpec, reporter: &Reporter) -> Result<i32, String> {
    reporter.send(
        "status",
        format!("Launching: {} {}", spec.program, spec.args.join(" ")),
    );
    let mut child = Command::new(&spec.program)
        .args(&spec.args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(false)
        .spawn()
        .map_err(|error| format!("Failed to launch {}: {error}", spec.program))?;
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "Failed to capture installer stdout.".to_string())?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| "Failed to capture installer stderr.".to_string())?;
    let stdout_reporter = reporter.clone();
    let stderr_reporter = reporter.clone();
    let stdout_task =
        tokio::spawn(async move { stream_reader(stdout, "stdout", stdout_reporter).await });
    let stderr_task =
        tokio::spawn(async move { stream_reader(stderr, "stderr", stderr_reporter).await });
    let status = child
        .wait()
        .await
        .map_err(|error| format!("Failed while waiting for the real installer: {error}"))?;
    let _ = stdout_task.await;
    let _ = stderr_task.await;
    let code = status.code().unwrap_or(-1);
    reporter.send("status", format!("Real installer exit code: {code}"));
    installer_exit_result(code, status.success())
}

#[cfg(any(not(windows), test))]
fn installer_exit_result(code: i32, success: bool) -> Result<i32, String> {
    success
        .then_some(code)
        .ok_or_else(|| format!("The real installer exited with code {code}."))
}

#[cfg(not(windows))]
async fn stream_reader<R>(reader: R, kind: &'static str, reporter: Reporter) -> Vec<u8>
where
    R: AsyncRead + Unpin,
{
    let mut reader = BufReader::new(reader);
    let mut collected = Vec::new();
    loop {
        let mut line = Vec::new();
        match reader.read_until(b'\n', &mut line).await {
            Ok(0) | Err(_) => break,
            Ok(_) => {
                collected.extend_from_slice(&line);
                reporter.send(kind, String::from_utf8_lossy(&line).trim_end());
            }
        }
    }
    collected
}

#[cfg(target_os = "macos")]
async fn install_macos_dmg(dmg_path: &Path, reporter: &Reporter) -> Result<(), String> {
    let attach = CommandSpec::new(
        "hdiutil",
        vec![
            "attach".into(),
            "-nobrowse".into(),
            "-readonly".into(),
            dmg_path.display().to_string(),
        ],
    );
    let output = run_command_capture(attach, reporter).await?;
    let mount_path = String::from_utf8_lossy(&output)
        .lines()
        .filter_map(|line| line.split('\t').next_back())
        .find(|value| value.starts_with("/Volumes/"))
        .map(PathBuf::from)
        .ok_or_else(|| "hdiutil did not report a mounted volume.".to_string())?;

    let result = async {
        let apps: Vec<PathBuf> = fs::read_dir(&mount_path)
            .map_err(|error| format!("Failed to inspect the mounted DMG: {error}"))?
            .filter_map(Result::ok)
            .map(|entry| entry.path())
            .filter(|path| path.extension().and_then(|value| value.to_str()) == Some("app"))
            .collect();
        if apps.len() != 1 {
            return Err("The DMG must contain exactly one application bundle.".into());
        }
        let source = fs::canonicalize(&apps[0])
            .map_err(|error| format!("Failed to validate the application bundle: {error}"))?;
        let mount = fs::canonicalize(&mount_path)
            .map_err(|error| format!("Failed to validate the mounted volume: {error}"))?;
        if !source.starts_with(&mount) {
            return Err("The DMG application points outside the mounted volume.".into());
        }
        let destination = Path::new("/Applications").join(
            source
                .file_name()
                .ok_or_else(|| "The application bundle name is invalid.".to_string())?,
        );
        let helper = std::env::current_exe()
            .map_err(|error| format!("Failed to locate the installer helper: {error}"))?;
        let apple_script = r#"
on run argv
  set helperPath to item 1 of argv
  set sourcePath to item 2 of argv
  set destinationPath to item 3 of argv
  do shell script quoted form of helperPath & " --pake-online-macos-install " & quoted form of sourcePath & " " & quoted form of destinationPath with administrator privileges
end run
"#
        .trim()
        .to_string();
        run_command(
            CommandSpec::new(
                "osascript",
                vec![
                    "-e".into(),
                    apple_script,
                    helper.display().to_string(),
                    source.display().to_string(),
                    destination.display().to_string(),
                ],
            ),
            reporter,
        )
        .await
        .map(|_| ())
    }
    .await;

    let detach = run_command(
        CommandSpec::new(
            "hdiutil",
            vec!["detach".into(), mount_path.display().to_string()],
        ),
        reporter,
    )
    .await;
    result?;
    detach.map(|_| ())
}

#[cfg(target_os = "macos")]
async fn run_command_capture(spec: CommandSpec, reporter: &Reporter) -> Result<Vec<u8>, String> {
    let mut child = Command::new(&spec.program)
        .args(&spec.args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| format!("Failed to launch {}: {error}", spec.program))?;
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "Failed to capture command output.".to_string())?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| "Failed to capture command errors.".to_string())?;
    let stdout_task = tokio::spawn(stream_reader(stdout, "stdout", reporter.clone()));
    let stderr_task = tokio::spawn(stream_reader(stderr, "stderr", reporter.clone()));
    let status = child
        .wait()
        .await
        .map_err(|error| format!("Command failed: {error}"))?;
    let output = stdout_task.await.unwrap_or_default();
    let _ = stderr_task.await;
    if status.success() {
        Ok(output)
    } else {
        Err(format!(
            "{} exited with code {}.",
            spec.program,
            status.code().unwrap_or(-1)
        ))
    }
}

#[cfg(target_os = "macos")]
pub fn maybe_run_macos_elevated_helper() -> Option<i32> {
    let mut arguments = std::env::args_os();
    let _executable = arguments.next();
    if arguments.next().as_deref() != Some(std::ffi::OsStr::new("--pake-online-macos-install")) {
        return None;
    }
    let source = arguments.next().map(PathBuf::from);
    let destination = arguments.next().map(PathBuf::from);
    if source.is_none() || destination.is_none() || arguments.next().is_some() {
        eprintln!("The macOS installer helper received invalid arguments.");
        return Some(2);
    }
    match replace_macos_application(&source.unwrap(), &destination.unwrap()) {
        Ok(()) => Some(0),
        Err(error) => {
            eprintln!("{error}");
            Some(1)
        }
    }
}

#[cfg(target_os = "macos")]
fn replace_macos_application(source: &Path, destination: &Path) -> Result<(), String> {
    use std::ffi::CString;
    use std::os::unix::ffi::OsStrExt;

    let source = fs::canonicalize(source)
        .map_err(|error| format!("Failed to validate the source application: {error}"))?;
    if !source.starts_with("/Volumes")
        || source.extension().and_then(|value| value.to_str()) != Some("app")
        || destination.parent() != Some(Path::new("/Applications"))
        || destination.extension().and_then(|value| value.to_str()) != Some("app")
    {
        return Err("The macOS installer helper rejected an unsafe application path.".into());
    }

    let file_name = destination
        .file_name()
        .ok_or_else(|| "The destination application name is invalid.".to_string())?;
    let staging = Path::new("/Applications").join(format!(
        ".pake-online-{}-{}",
        std::process::id(),
        file_name.to_string_lossy()
    ));
    if staging.exists() {
        fs::remove_dir_all(&staging)
            .map_err(|error| format!("Failed to clear the staging application: {error}"))?;
    }

    let copy = std::process::Command::new("/usr/bin/ditto")
        .arg(&source)
        .arg(&staging)
        .output()
        .map_err(|error| format!("Failed to stage the application: {error}"))?;
    print!("{}", String::from_utf8_lossy(&copy.stdout));
    eprint!("{}", String::from_utf8_lossy(&copy.stderr));
    if !copy.status.success() {
        let _ = fs::remove_dir_all(&staging);
        return Err(format!(
            "ditto exited with code {}.",
            copy.status.code().unwrap_or(-1)
        ));
    }

    let activation = if destination.exists() {
        let from = CString::new(destination.as_os_str().as_bytes())
            .map_err(|_| "The destination path contains a NUL byte.".to_string())?;
        let to = CString::new(staging.as_os_str().as_bytes())
            .map_err(|_| "The staging path contains a NUL byte.".to_string())?;
        const AT_FDCWD: i32 = -2;
        const RENAME_SWAP: u32 = 0x0000_0002;
        unsafe extern "C" {
            fn renameatx_np(
                from_fd: i32,
                from: *const std::os::raw::c_char,
                to_fd: i32,
                to: *const std::os::raw::c_char,
                flags: u32,
            ) -> i32;
        }
        // Both paths are on /Applications, so RENAME_SWAP activates the new
        // bundle atomically and leaves the previous bundle at `staging`.
        let result =
            unsafe { renameatx_np(AT_FDCWD, from.as_ptr(), AT_FDCWD, to.as_ptr(), RENAME_SWAP) };
        if result == 0 {
            Ok(())
        } else {
            Err(format!(
                "Failed to atomically replace the application: {}",
                std::io::Error::last_os_error()
            ))
        }
    } else {
        fs::rename(&staging, destination)
            .map_err(|error| format!("Failed to activate the application: {error}"))
    };

    if activation.is_err() {
        let _ = fs::remove_dir_all(&staging);
        return activation;
    }
    if staging.exists() {
        fs::remove_dir_all(&staging)
            .map_err(|error| format!("Failed to remove the previous application: {error}"))?;
    }
    println!("Installed application at {}", destination.display());
    Ok(())
}

#[cfg(target_os = "linux")]
async fn install_appimage(
    source: &Path,
    package_id: &str,
    application_name: &str,
    reporter: &Reporter,
) -> Result<(), String> {
    use std::os::unix::fs::PermissionsExt;

    let (destination, desktop_path) = platform::appimage_install_paths(package_id)?;
    tokio::fs::create_dir_all(destination.parent().unwrap())
        .await
        .map_err(|error| format!("Failed to create the AppImage directory: {error}"))?;
    tokio::fs::create_dir_all(desktop_path.parent().unwrap())
        .await
        .map_err(|error| format!("Failed to create the desktop entry directory: {error}"))?;
    tokio::fs::copy(source, &destination)
        .await
        .map_err(|error| format!("Failed to install the AppImage: {error}"))?;
    let mut permissions = tokio::fs::metadata(&destination)
        .await
        .map_err(|error| format!("Failed to inspect the AppImage: {error}"))?
        .permissions();
    permissions.set_mode(0o755);
    tokio::fs::set_permissions(&destination, permissions)
        .await
        .map_err(|error| format!("Failed to make the AppImage executable: {error}"))?;
    let desktop = format!(
        "[Desktop Entry]\nType=Application\nName={}\nExec={}\nTerminal=false\nCategories=Network;\n",
        desktop_entry_value(application_name),
        desktop_exec_path(&destination)
    );
    tokio::fs::write(&desktop_path, desktop)
        .await
        .map_err(|error| format!("Failed to create the desktop entry: {error}"))?;
    reporter.send(
        "stdout",
        format!("Installed AppImage to {}", destination.display()),
    );
    reporter.send(
        "stdout",
        format!("Created desktop entry at {}", desktop_path.display()),
    );
    Ok(())
}

#[cfg(any(target_os = "linux", test))]
fn desktop_entry_value(value: &str) -> String {
    value
        .replace('\\', "\\\\")
        .replace('\n', "\\n")
        .replace('\r', "")
}

#[cfg(any(target_os = "linux", test))]
fn desktop_exec_path(path: &Path) -> String {
    let value = path.display().to_string();
    format!(
        "\"{}\"",
        value
            .replace('\\', "\\\\")
            .replace('"', "\\\"")
            .replace('`', "\\`")
            .replace('$', "\\$")
    )
}

#[cfg(target_os = "linux")]
fn command_exists(command: &str) -> bool {
    std::env::var_os("PATH").is_some_and(|paths| {
        std::env::split_paths(&paths).any(|directory| directory.join(command).is_file())
    })
}

fn current_operating_system() -> &'static str {
    if cfg!(windows) {
        "windows"
    } else if cfg!(target_os = "macos") {
        "macos"
    } else if cfg!(target_os = "linux") {
        "linux"
    } else {
        "unsupported"
    }
}

fn short_sha(sha: &str) -> &str {
    sha.get(..12).unwrap_or(sha)
}

pub fn run() {
    tauri::Builder::default()
        .manage(InstallState::default())
        .invoke_handler(tauri::generate_handler![start_install])
        .run(tauri::generate_context!())
        .expect("failed to run the Pake online installer");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn preserves_real_installer_exit_codes() {
        assert_eq!(installer_exit_result(0, true), Ok(0));
        assert_eq!(
            installer_exit_result(1603, false),
            Err("The real installer exited with code 1603.".into())
        );
    }

    #[test]
    fn escapes_linux_desktop_values_and_paths() {
        assert_eq!(desktop_entry_value("Example\nName"), "Example\\nName");
        assert_eq!(
            desktop_exec_path(Path::new("/home/example user/$App.AppImage")),
            "\"/home/example user/\\$App.AppImage\""
        );
    }

    #[test]
    fn temporary_installer_directory_is_removed_on_drop() {
        let path;
        {
            let directory = tempfile::tempdir().unwrap();
            path = directory.path().to_path_buf();
            std::fs::write(path.join("installer.bin"), b"test").unwrap();
            assert!(path.exists());
        }
        assert!(!path.exists());
    }

    #[test]
    fn rejects_installer_size_and_sha256_mismatches() {
        let artifact = InstallerArtifact {
            name: "app.msi".into(),
            format: "msi".into(),
            size: 4,
            sha256: "a".repeat(64),
            download_url: "https://github.com/owner/repo/app.msi".into(),
            package_id: "app".into(),
            expanded_size: None,
            executable_name: None,
            executable_sha256: None,
        };
        assert!(verify_installer_metadata(4, &"a".repeat(64), &artifact).is_ok());
        assert!(verify_installer_metadata(3, &"a".repeat(64), &artifact).is_err());
        assert!(verify_installer_metadata(4, &"b".repeat(64), &artifact).is_err());
    }
}
