# Member B - CLI & Packaging

**Status:** 🔲 In progress  
**Full guide:** [docs/team-division.md](../../docs/team-division.md#成员-b--cli--打包流水线--进行中)

## This Week (Required)

- [ ] End-to-end build on Windows: `webpake https://github.com --name GitHub` → `.msi`
- [ ] Build progress messages and friendly errors (missing `tauri-cli`, icon failures)
- [ ] Sync new CLI flags to `docs/cli-usage.md`

## Near-term

- [ ] Proper macOS `.icns` generation (replace PNG copy placeholder)
- [ ] `--config-file` merge logic tested and documented
- [ ] Build cache: reuse `crates/runtime/target/` between runs

## Optional

- [ ] `webpake list` — list packaged apps
- [ ] `webpake init` — generate config template

## Files

- `crates/cli/src/main.rs`
- `crates/cli/src/args.rs`
- `crates/packager/src/pipeline.rs`
- `crates/packager/src/icon.rs`
- `crates/packager/src/tauri_config.rs`

## Acceptance

```bash
cargo install --path crates/cli
webpake https://github.com --name GitHub
# → installable .msi/.exe, opens GitHub in WebView
```
