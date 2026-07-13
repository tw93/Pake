use crate::error::{PackagerError, Result};
use crate::icon::resolve_icon;
use crate::tauri_config::{install_icons, write_pake_config, write_tauri_config, write_platform_configs};
use std::path::PathBuf;
use std::process::{Command, Stdio};
use tracing::info;
use webpake_core::{validate_config, BuildOptions};

/// Full packaging pipeline entry point.
pub struct Pipeline {
    pub workspace_root: PathBuf,
    pub runtime_dir: PathBuf,
    pub version: String,
}

impl Pipeline {
    pub fn from_workspace(workspace_root: impl Into<PathBuf>) -> Self {
        let workspace_root = workspace_root.into();
        let runtime_dir = workspace_root.join("crates/runtime");
        Self {
            workspace_root,
            runtime_dir,
            version: env!("CARGO_PKG_VERSION").to_string(),
        }
    }

    pub async fn run(&self, options: &BuildOptions) -> Result<PathBuf> {
        validate_config(&options.app)?;

        if !self.runtime_dir.exists() {
            return Err(PackagerError::RuntimeNotFound(
                self.runtime_dir.display().to_string(),
            ));
        }

        eprintln!("[1/4] Resolving icon...");
        let work_dir = self.runtime_dir.join(".webpake");
        std::fs::create_dir_all(&work_dir)?;

        let icon_path = resolve_icon(
            &options.app.url,
            options.app.icon.as_deref(),
            &work_dir,
        )
        .await?;

        let mut config = options.app.clone();
        config.icon = Some(icon_path.clone());

        eprintln!("[2/4] Writing config files...");
        let pake_path = self.runtime_dir.join("pake.json");
        let tauri_path = self.runtime_dir.join("tauri.conf.json");
        write_pake_config(&pake_path, &config)?;
        write_tauri_config(&tauri_path, &config, &self.version)?;
        write_platform_configs(&self.runtime_dir, &config)?;

        eprintln!("[3/4] Installing icons...");
        let icons_dir = self.runtime_dir.join("icons");
        install_icons(&icon_path, &icons_dir)?;

        info!("config written to {}", pake_path.display());
        eprintln!("       → {}", pake_path.display());

        if options.config_only {
            eprintln!("[4/4] Skipped build (--config-only).");
            return Ok(work_dir);
        }

        self.ensure_tauri_cli()?;

        eprintln!("[4/4] Running Tauri build (first run may take 10+ minutes)...");
        if options.dev {
            self.run_tauri_dev()?;
        } else {
            self.run_tauri_build(options.target.as_deref())?;
        }

        Ok(self.output_dir(options))
    }

    fn ensure_tauri_cli(&self) -> Result<()> {
        let check = Command::new("cargo")
            .args(["tauri", "--version"])
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status();

        if check.map(|s| s.success()).unwrap_or(false) {
            return Ok(());
        }

        Err(PackagerError::BuildFailed(
            "cargo tauri CLI not found. Install with: cargo install tauri-cli --version \"^2.0\""
                .into(),
        ))
    }

    fn run_tauri_dev(&self) -> Result<()> {
        info!("starting tauri dev mode");
        let mut child = Command::new("cargo")
            .args(["tauri", "dev"])
            .current_dir(&self.runtime_dir)
            .stdout(Stdio::inherit())
            .stderr(Stdio::inherit())
            .spawn()
            .map_err(PackagerError::Io)?;

        let status = child.wait().map_err(PackagerError::Io)?;
        if !status.success() {
            return Err(PackagerError::BuildFailed(
                "cargo tauri dev exited with failure".into(),
            ));
        }
        Ok(())
    }

    fn run_tauri_build(&self, target: Option<&str>) -> Result<()> {
        info!("starting tauri build");
        let mut args = vec!["tauri", "build"];
        if let Some(t) = target {
            args.push("--target");
            args.push(t);
        }

        let mut child = Command::new("cargo")
            .args(&args)
            .current_dir(&self.runtime_dir)
            .stdout(Stdio::inherit())
            .stderr(Stdio::inherit())
            .spawn()
            .map_err(PackagerError::Io)?;

        let status = child.wait().map_err(PackagerError::Io)?;
        if !status.success() {
            return Err(PackagerError::BuildFailed(
                "cargo tauri build exited with failure. Check Tauri prerequisites: https://v2.tauri.app/start/prerequisites/".into(),
            ));
        }
        Ok(())
    }

    fn output_dir(&self, options: &BuildOptions) -> PathBuf {
        options
            .output_dir
            .clone()
            .unwrap_or_else(|| self.runtime_dir.join("target/release/bundle"))
    }
}
