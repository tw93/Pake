#!/usr/bin/env pwsh
# First-time project setup for Windows

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Write-Host "==> Generating default icons..."
cargo run -p webpake-packager --example generate_icons

Write-Host "==> Checking workspace..."
cargo check --workspace

Write-Host "==> Running tests..."
cargo test --workspace

Write-Host "==> Smoke test: config-only packaging..."
cargo run -p webpake-cli -- https://example.com --name Example --config-only

Write-Host ""
Write-Host "Setup complete! Next steps:"
Write-Host "  cargo install --path crates/cli"
Write-Host "  webpake https://github.com --name GitHub --config-only"
Write-Host "  cd crates/runtime && cargo tauri dev"
