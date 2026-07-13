# FAQ

> Team division: [team-division.md](team-division.md)

## First build is very slow

The first `cargo tauri build` compiles all Tauri dependencies from source (10+ minutes). Subsequent builds reuse the cache in `crates/runtime/target/`.

## `cargo tauri` command not found

Install the Tauri CLI:

```bash
cargo install tauri-cli --version "^2.0"
```

WebPake will also print this hint if the CLI is missing during a build.

## Linux: blank window on Wayland

Some Wayland compositors have WebKit compositing issues. Try:

```bash
WEBKIT_DISABLE_COMPOSITING_MODE=1 webpake <url> --name <name> --dev
```

Or set the environment variable before launching the packaged app.

## OAuth login fails in packaged app

Google and some providers block embedded WebViews. WebPake's inject layer inlines auth popups for common providers (`accounts.google.com`, `appleid.apple.com`, `login.live.com`), but some sites still require a native browser. Use `--no-inline-auth` to disable inlining if it causes issues.

## Icon looks blurry

Provide a high-resolution PNG (512×512 or larger) via `--icon`. Auto-fetched favicons are upscaled to 512px.

## Windows: build tools required

Install [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) with the "Desktop development with C++" workload.

## macOS: code signing

For distribution outside your machine, you need an Apple Developer certificate. Local dev builds work without signing.

## External links open inside the app

By default `--open-external-links-in-browser` is `true` and the inject layer opens cross-origin links in the system browser. Set `--open-external-links-in-browser false` to keep links in-app.

## Multi-window not working

Enable `--multi-window` when packaging. The inject layer intercepts `target="_blank"` links and calls the `open_new_window` Tauri command.

## Who owns what?

See the full three-person division in [team-division.md](team-division.md).
