#!/usr/bin/env bash
set -euo pipefail

echo "==> Generating default icons..."
cargo run -p webpake-packager --example generate_icons

echo "==> Checking workspace..."
cargo check --workspace

echo "==> Running tests..."
cargo test --workspace

echo "==> Smoke test: config-only packaging..."
cargo run -p webpake-cli -- https://example.com --name Example --config-only

echo ""
echo "Setup complete! Next steps:"
echo "  cargo install --path crates/cli"
echo "  webpake https://github.com --name GitHub --config-only"
echo "  cd crates/runtime && cargo tauri dev"
