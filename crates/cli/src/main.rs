mod args;

use anyhow::Context;
use args::Cli;
use clap::Parser;
use tracing::info;
use tracing_subscriber::EnvFilter;
use webpake_packager::Pipeline;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env().add_directive("webpake=info".parse()?))
        .init();

    let cli = Cli::parse();
    let options = cli.into_build_options();

    info!(
        "packaging {} -> {}",
        options.app.name, options.app.url
    );

    if !options.config_only && !options.dev {
        println!("Generating config and icons...");
        println!("Note: first Tauri build may take 10+ minutes.");
    }

    let workspace_root = find_workspace_root().context("could not locate workspace root")?;
    let pipeline = Pipeline::from_workspace(workspace_root);
    let output = pipeline.run(&options).await?;

    if !options.config_only {
        println!("Build complete. Artifacts at: {}", output.display());
    } else {
        println!("Config generated. Runtime ready at: crates/runtime/");
    }

    Ok(())
}

fn find_workspace_root() -> Option<std::path::PathBuf> {
    let mut dir = std::env::current_dir().ok()?;
    loop {
        let cargo_toml = dir.join("Cargo.toml");
        if cargo_toml.exists() {
            if let Ok(content) = std::fs::read_to_string(&cargo_toml) {
                if content.contains("[workspace]") {
                    return Some(dir);
                }
            }
        }
        if !dir.pop() {
            break;
        }
    }
    None
}
