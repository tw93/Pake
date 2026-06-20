# YouTube Ad Blocking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an opt-in, Windows-native YouTube ad-blocking profile to Pake, backed by WebView2 request filtering, injected page cleanup, conservative automatic recovery, and a session-only tray toggle.

**Architecture:** The CLI writes an `adblock` profile into `pake.json`. Rust owns shared session state and a pure URL matcher; a Windows adapter attaches to WebView2 and returns empty responses for high-confidence advertising requests. A guarded initialization script handles dynamic YouTube UI, in-player ad skipping, and recovery, while the tray and a Tauri command keep native and injected state synchronized.

**Tech Stack:** TypeScript 5, Commander, Vitest, Rust 2021, Tauri 2.10.2, Wry 0.54.2, WebView2 COM 0.38.2, vanilla browser JavaScript, GitHub Actions.

---

## File map

- Modify `bin/types.ts`: define the CLI and generated-config ad-block types.
- Modify `bin/defaults.ts`: keep blocking disabled unless explicitly selected.
- Modify `bin/helpers/cli-program.ts`: add the hidden `--adblock <profile>` option.
- Modify `bin/helpers/merge.ts`: serialize the selected profile into `pake.json`.
- Modify `src-tauri/pake.json`: add the default disabled configuration.
- Modify `dist/cli.js`: regenerate the shipped CLI after TypeScript changes.
- Create `tests/unit/adblock-config.test.ts`: cover CLI defaults, accepted profiles, and serialization.
- Modify `src-tauri/src/app/config.rs`: deserialize and validate the ad-block profile.
- Create `src-tauri/src/adblock/mod.rs`: expose state, rules, and the platform adapter.
- Create `src-tauri/src/adblock/state.rs`: own session enablement and one-shot recovery state.
- Create `src-tauri/src/adblock/rules.rs`: pure origin and request classification.
- Create `src-tauri/src/adblock/windows.rs`: attach the WebView2 request handler on Windows.
- Modify `src-tauri/src/lib.rs`: initialize shared state and register the recovery command.
- Modify `src-tauri/src/app/window.rs`: inject the page module and attach the native filter to every created window.
- Modify `src-tauri/src/app/invoke.rs`: expose native session disablement to the injected recovery code.
- Modify `src-tauri/src/app/setup.rs`: add the session-only tray checkbox.
- Create `src-tauri/src/inject/youtube_adblock.js`: clean YouTube UI, skip in-player ads, and recover once.
- Create `tests/unit/youtube-adblock.test.js`: run the injected module against a small fake DOM/timer harness.
- Modify `default_app_list.json`: select the YouTube profile for the YouTube preset.
- Modify `.github/workflows/release.yml`: pass the profile to the reusable app workflow.
- Modify `.github/workflows/single-app.yaml`: apply the profile only to the Windows build.
- Create `tests/unit/popular-app-adblock.test.ts`: ensure only the YouTube Windows build opts in.
- Modify `docs/cli-usage.md` and `docs/cli-usage_CN.md`: document the advanced option and limitations.

## Task 1: CLI option and generated configuration

**Files:**
- Create: `tests/unit/adblock-config.test.ts`
- Modify: `bin/types.ts`
- Modify: `bin/defaults.ts`
- Modify: `bin/helpers/cli-program.ts`
- Modify: `bin/helpers/merge.ts`
- Modify: `src-tauri/pake.json`
- Modify: `dist/cli.js`

- [ ] **Step 1: Write failing CLI and serialization tests**

Create `tests/unit/adblock-config.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { DEFAULT_PAKE_OPTIONS } from '../../bin/defaults';
import { getCliProgram } from '../../bin/helpers/cli-program';
import { buildAdblockConfig } from '../../bin/helpers/merge';

describe('ad-block configuration', () => {
  it('is disabled by default', () => {
    expect(DEFAULT_PAKE_OPTIONS.adblockProfile).toBe('none');
    expect(buildAdblockConfig(DEFAULT_PAKE_OPTIONS.adblockProfile)).toEqual({
      enabled: false,
      profile: 'none',
    });
  });

  it('registers a hidden profile option with explicit choices', () => {
    const option = getCliProgram().options.find(
      (candidate) => candidate.long === '--adblock',
    );

    expect(option?.hidden).toBe(true);
    expect(option?.defaultValue).toBe('none');
    expect(option?.argChoices).toEqual(['none', 'youtube']);
  });

  it('enables the YouTube profile', () => {
    expect(buildAdblockConfig('youtube')).toEqual({
      enabled: true,
      profile: 'youtube',
    });
  });
});
```

- [ ] **Step 2: Run the test and confirm the missing option fails**

Run:

```powershell
npx vitest run tests/unit/adblock-config.test.ts
```

Expected: FAIL because `adblockProfile` and `buildAdblockConfig` do not exist.

- [ ] **Step 3: Add the typed option and serializer**

Add to `bin/types.ts`:

```ts
export type AdblockProfile = 'none' | 'youtube';

export interface AdblockConfig {
  enabled: boolean;
  profile: AdblockProfile;
}
```

Add `adblockProfile: AdblockProfile` to `PakeCliOptions`, and add `adblock: AdblockConfig` to `PakeConfig`.

Add to `DEFAULT_PAKE_OPTIONS` in `bin/defaults.ts`:

```ts
adblockProfile: 'none',
```

Register the option in `bin/helpers/cli-program.ts`:

```ts
.addOption(
  new Option('--adblock <profile>', 'Enable a built-in ad-block profile')
    .choices(['none', 'youtube'])
    .default(DEFAULT.adblockProfile)
    .hideHelp(),
)
```

Import `AdblockConfig` and `AdblockProfile` in `bin/helpers/merge.ts`, then add:

```ts
export function buildAdblockConfig(profile: AdblockProfile): AdblockConfig {
  return {
    enabled: profile !== 'none',
    profile,
  };
}
```

Inside `injectCustomCode`, serialize the profile before returning:

```ts
tauriConf.pake.adblock = buildAdblockConfig(options.adblockProfile);
```

Add the disabled default to `src-tauri/pake.json`:

```json
"adblock": {
  "enabled": false,
  "profile": "none"
}
```

- [ ] **Step 4: Run the focused tests and rebuild the shipped CLI**

Run:

```powershell
npx vitest run tests/unit/adblock-config.test.ts tests/unit/cli-options.test.ts
pnpm run cli:build
```

Expected: both test files PASS and `dist/cli.js` is regenerated.

- [ ] **Step 5: Commit the configuration slice**

```powershell
git add bin/types.ts bin/defaults.ts bin/helpers/cli-program.ts bin/helpers/merge.ts src-tauri/pake.json tests/unit/adblock-config.test.ts dist/cli.js
git commit -m "feat: add YouTube adblock profile configuration"
```

## Task 2: Rust configuration and session state

**Files:**
- Modify: `src-tauri/src/app/config.rs`
- Create: `src-tauri/src/adblock/mod.rs`
- Create: `src-tauri/src/adblock/state.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Add failing Rust tests for defaults and one-shot recovery**

Append tests to `src-tauri/src/app/config.rs`:

```rust
#[cfg(test)]
mod adblock_config_tests {
    use super::*;

    #[test]
    fn missing_adblock_config_is_disabled() {
        let config: AdblockConfig = serde_json::from_str("{}").unwrap();
        assert!(!config.is_enabled_for("youtube"));
    }

    #[test]
    fn youtube_profile_requires_enabled_flag() {
        let config: AdblockConfig = serde_json::from_str(
            r#"{"enabled":true,"profile":"youtube"}"#,
        )
        .unwrap();
        assert!(config.is_enabled_for("youtube"));
        assert!(!config.is_enabled_for("other"));
    }
}
```

Create `src-tauri/src/adblock/state.rs` with its test first:

```rust
#[cfg(test)]
mod tests {
    use super::AdblockSession;

    #[test]
    fn recovery_can_only_trigger_once() {
        let state = AdblockSession::new(true);
        assert!(state.disable_for_recovery());
        assert!(!state.disable_for_recovery());
        assert!(!state.is_enabled());
    }
}
```

- [ ] **Step 2: Run Rust tests and confirm missing types fail**

Run:

```powershell
cargo test --manifest-path src-tauri/Cargo.toml adblock --lib
```

Expected: compilation FAIL because `AdblockConfig` and `AdblockSession` are undefined.

- [ ] **Step 3: Implement configuration validation and session state**

Add to `src-tauri/src/app/config.rs`:

```rust
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct AdblockConfig {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default)]
    pub profile: String,
}

impl AdblockConfig {
    pub fn is_enabled_for(&self, profile: &str) -> bool {
        self.enabled && self.profile == profile
    }
}
```

Add this field to `PakeConfig`:

```rust
#[serde(default)]
pub adblock: AdblockConfig,
```

Implement `src-tauri/src/adblock/state.rs`:

```rust
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
};

#[derive(Clone)]
pub struct AdblockSession {
    enabled: Arc<AtomicBool>,
    recovery_triggered: Arc<AtomicBool>,
}

impl AdblockSession {
    pub fn new(enabled: bool) -> Self {
        Self {
            enabled: Arc::new(AtomicBool::new(enabled)),
            recovery_triggered: Arc::new(AtomicBool::new(false)),
        }
    }

    pub fn is_enabled(&self) -> bool {
        self.enabled.load(Ordering::SeqCst)
    }

    pub fn set_enabled(&self, enabled: bool) {
        self.enabled.store(enabled, Ordering::SeqCst);
        if enabled {
            self.recovery_triggered.store(false, Ordering::SeqCst);
        }
    }

    pub fn disable_for_recovery(&self) -> bool {
        if self.recovery_triggered.swap(true, Ordering::SeqCst) {
            return false;
        }
        self.enabled.store(false, Ordering::SeqCst);
        true
    }
}
```

Create `src-tauri/src/adblock/mod.rs`:

```rust
pub mod rules;
pub mod state;

#[cfg(target_os = "windows")]
pub mod windows;
```

Declare `mod adblock;` in `src-tauri/src/lib.rs`. In `run_app`, before building windows, construct and manage one shared session:

```rust
let adblock_session = adblock::state::AdblockSession::new(
    pake_config.adblock.is_enabled_for("youtube"),
);
```

Inside `.setup`, before `set_window`, add:

```rust
app.manage(adblock_session.clone());
```

- [ ] **Step 4: Run formatting and focused Rust tests**

```powershell
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo test --manifest-path src-tauri/Cargo.toml adblock --lib
```

Expected: formatting check and all ad-block tests PASS.

- [ ] **Step 5: Commit the state model**

```powershell
git add src-tauri/src/app/config.rs src-tauri/src/adblock/mod.rs src-tauri/src/adblock/state.rs src-tauri/src/lib.rs
git commit -m "feat: add adblock runtime state"
```

## Task 3: Conservative YouTube request rules

**Files:**
- Create: `src-tauri/src/adblock/rules.rs`

- [ ] **Step 1: Write rule tests before the matcher**

Create `src-tauri/src/adblock/rules.rs` with tests first:

```rust
#[cfg(test)]
mod tests {
    use super::{classify, is_youtube_origin, Decision};

    #[test]
    fn accepts_supported_youtube_origins() {
        assert!(is_youtube_origin("https://www.youtube.com/watch?v=abc"));
        assert!(is_youtube_origin("https://m.youtube.com/shorts/abc"));
        assert!(!is_youtube_origin("https://youtube.example.com/watch"));
    }

    #[test]
    fn blocks_only_explicit_ad_endpoints() {
        for url in [
            "https://www.youtube.com/pagead/paralleladview?ai=1",
            "https://www.youtube.com/api/stats/ads?ver=2",
            "https://www.youtube.com/ptracking?video_id=abc",
            "https://googleads.g.doubleclick.net/pagead/id",
        ] {
            assert_eq!(classify(url), Decision::Block, "{url}");
        }
    }

    #[test]
    fn allows_video_and_account_traffic() {
        for url in [
            "https://rr1---sn.example.googlevideo.com/videoplayback?id=abc",
            "https://www.youtube.com/youtubei/v1/player",
            "https://www.youtube.com/youtubei/v1/account/account_menu",
            "https://i.ytimg.com/vi/abc/hqdefault.jpg",
            "https://accounts.google.com/o/oauth2/auth",
        ] {
            assert_eq!(classify(url), Decision::Allow, "{url}");
        }
    }
}
```

- [ ] **Step 2: Run the matcher tests and confirm missing functions fail**

```powershell
cargo test --manifest-path src-tauri/Cargo.toml adblock::rules --lib
```

Expected: compilation FAIL because the matcher API is undefined.

- [ ] **Step 3: Implement the pure matcher**

Add above the tests in `rules.rs`:

```rust
use tauri::Url;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Decision {
    Allow,
    Block,
}

pub fn is_youtube_origin(raw_url: &str) -> bool {
    let Ok(url) = Url::parse(raw_url) else {
        return false;
    };
    matches!(url.host_str(), Some("www.youtube.com" | "m.youtube.com"))
}

pub fn classify(raw_url: &str) -> Decision {
    let Ok(url) = Url::parse(raw_url) else {
        return Decision::Allow;
    };
    let host = url.host_str().unwrap_or_default();
    let path = url.path();

    let youtube_ad_path = matches!(host, "www.youtube.com" | "m.youtube.com")
        && (path.starts_with("/pagead/")
            || path == "/api/stats/ads"
            || path == "/ptracking"
            || path == "/get_midroll_info");
    let doubleclick_ad_path = host == "googleads.g.doubleclick.net"
        && path.starts_with("/pagead/");

    if youtube_ad_path || doubleclick_ad_path {
        Decision::Block
    } else {
        Decision::Allow
    }
}
```

- [ ] **Step 4: Run the focused tests**

```powershell
cargo test --manifest-path src-tauri/Cargo.toml adblock::rules --lib
```

Expected: all origin, block, and negative fixtures PASS.

- [ ] **Step 5: Commit the rule engine**

```powershell
git add src-tauri/src/adblock/rules.rs
git commit -m "feat: classify high-confidence YouTube ad requests"
```

## Task 4: Windows WebView2 request interception

**Files:**
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/Cargo.lock`
- Create: `src-tauri/src/adblock/windows.rs`
- Modify: `src-tauri/src/app/window.rs`

- [ ] **Step 1: Add the exact Windows dependencies used by Tauri 2.10.2**

Add to `src-tauri/Cargo.toml`:

```toml
[target.'cfg(target_os = "windows")'.dependencies]
webview2-com = "=0.38.2"
windows = { version = "=0.61.3", features = ["Win32_System_Com"] }
```

Run:

```powershell
cargo check --manifest-path src-tauri/Cargo.toml --lib
```

Expected: Cargo resolves the already-compatible WebView2 and Windows versions and updates `Cargo.lock` without introducing a second version of either crate.

- [ ] **Step 2: Implement the WebView2 adapter**

Create `src-tauri/src/adblock/windows.rs`:

```rust
use super::{rules::{classify, Decision}, state::AdblockSession};
use tauri::WebviewWindow;
use webview2_com::{
    take_pwstr,
    Microsoft::Web::WebView2::Win32::{
        ICoreWebView2WebResourceRequestedEventArgs,
        COREWEBVIEW2_WEB_RESOURCE_CONTEXT_ALL,
    },
    WebResourceRequestedEventHandler,
};
use windows::core::{HSTRING, PWSTR};

pub fn attach(window: &WebviewWindow, session: AdblockSession) -> tauri::Result<()> {
    window.with_webview(move |platform| unsafe {
        if let Err(error) = attach_inner(platform, session) {
            #[cfg(debug_assertions)]
            eprintln!("[Pake] Failed to attach YouTube ad filter: {error}");
        }
    })
}

unsafe fn attach_inner(
    platform: tauri::webview::PlatformWebview,
    session: AdblockSession,
) -> windows::core::Result<()> {
    let webview = platform.controller().CoreWebView2()?;
    let environment = platform.environment();
    let filter = HSTRING::from("https://*/*");
    webview.AddWebResourceRequestedFilter(
        &filter,
        COREWEBVIEW2_WEB_RESOURCE_CONTEXT_ALL,
    )?;

    let handler = WebResourceRequestedEventHandler::create(Box::new(
        move |_, args: Option<ICoreWebView2WebResourceRequestedEventArgs>| {
            let Some(args) = args else {
                return Ok(());
            };
            if !session.is_enabled() {
                return Ok(());
            }

            let request = args.Request()?;
            let mut raw_uri = PWSTR::null();
            request.Uri(&mut raw_uri)?;
            let uri = take_pwstr(raw_uri);
            if classify(&uri) != Decision::Block {
                return Ok(());
            }

            let status = HSTRING::from("No Content");
            let headers = HSTRING::from("Content-Length: 0\r\n");
            let response = environment.CreateWebResourceResponse(
                None,
                204,
                &status,
                &headers,
            )?;
            args.SetResponse(&response)
        },
    ));

    let mut token = 0;
    webview.add_WebResourceRequested(&handler, &mut token)?;
    Ok(())
}
```

If the compiler reports `take_pwstr` under the crate root rather than the glob import, retain the explicit `webview2_com::take_pwstr` path shown above; do not replace it with an unfreed `PWSTR::to_string()` conversion.

- [ ] **Step 3: Attach filtering after each window is built**

At the end of `build_window` in `src-tauri/src/app/window.rs`, replace the direct return with:

```rust
let window = window_builder.build()?;

#[cfg(target_os = "windows")]
if config.adblock.is_enabled_for("youtube") {
    let session = app.state::<crate::adblock::state::AdblockSession>().inner().clone();
    crate::adblock::windows::attach(&window, session)?;
}

Ok(window)
```

This path is shared by the primary and additional windows.

- [ ] **Step 4: Compile and run all Rust unit tests on Windows**

```powershell
cargo fmt --manifest-path src-tauri/Cargo.toml
cargo test --manifest-path src-tauri/Cargo.toml --lib
cargo check --manifest-path src-tauri/Cargo.toml --lib
```

Expected: all tests PASS and the Windows adapter compiles against WebView2 COM 0.38.2.

- [ ] **Step 5: Commit native interception**

```powershell
git add src-tauri/Cargo.toml src-tauri/Cargo.lock src-tauri/src/adblock/windows.rs src-tauri/src/app/window.rs
git commit -m "feat: filter YouTube ad requests in WebView2"
```

## Task 5: Injected YouTube cleanup and player handling

**Files:**
- Create: `src-tauri/src/inject/youtube_adblock.js`
- Create: `tests/unit/youtube-adblock.test.js`
- Modify: `src-tauri/src/app/window.rs`

- [ ] **Step 1: Write failing activation and selector tests**

Create `tests/unit/youtube-adblock.test.js` using Node's `vm` module, following the existing injection tests:

```js
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { describe, expect, it, vi } from "vitest";

const source = fs.readFileSync(
  path.join(process.cwd(), "src-tauri/src/inject/youtube_adblock.js"),
  "utf8",
);

function run({
  host = "www.youtube.com",
  enabled = true,
  querySelector = () => null,
} = {}) {
  const removed = [];
  const context = {
    window: {
      pakeConfig: { adblock: { enabled, profile: "youtube" } },
      location: { hostname: host },
      __TAURI__: { core: { invoke: vi.fn(() => Promise.resolve(true)) } },
    },
    document: {
      documentElement: { appendChild: vi.fn() },
      createElement: () => ({ id: "", textContent: "", remove: vi.fn() }),
      querySelectorAll: (selector) => [{ remove: () => removed.push(selector) }],
      querySelector,
    },
    MutationObserver: class { observe() {} },
    setInterval: vi.fn(),
    setTimeout: vi.fn((callback) => callback()),
    clearTimeout: vi.fn(),
    sessionStorage: { getItem: () => null, setItem: vi.fn() },
    console,
  };
  context.window.window = context.window;
  vm.runInNewContext(source, context);
  return { context, removed };
}

describe("YouTube ad-block injection", () => {
  it("does not activate outside YouTube", () => {
    const { context } = run({ host: "example.com" });
    expect(context.window.pakeAdblock).toBeUndefined();
  });

  it("does not activate when the profile is disabled", () => {
    const { context } = run({ enabled: false });
    expect(context.window.pakeAdblock).toBeUndefined();
  });

  it("exposes a session control and removes explicit ad containers", () => {
    const { context, removed } = run();
    expect(context.window.pakeAdblock.isEnabled()).toBe(true);
    expect(removed).toContain("ytd-display-ad-renderer");
    expect(removed).not.toContain("ytd-video-renderer");
  });
});
```

- [ ] **Step 2: Run the injected-module tests and confirm the file is missing**

```powershell
npx vitest run tests/unit/youtube-adblock.test.js
```

Expected: FAIL because `youtube_adblock.js` does not exist.

- [ ] **Step 3: Implement guarded page cleanup and player handling**

Create `src-tauri/src/inject/youtube_adblock.js`:

```js
(() => {
  const config = window.pakeConfig?.adblock;
  const supportedHosts = new Set(["www.youtube.com", "m.youtube.com"]);
  if (!config?.enabled || config.profile !== "youtube") return;
  if (!supportedHosts.has(window.location.hostname)) return;

  let enabled = true;
  const selectors = [
    "ytd-display-ad-renderer",
    "ytd-ad-slot-renderer",
    "ytd-promoted-sparkles-web-renderer",
    "ytd-in-feed-ad-layout-renderer",
    "#player-ads",
    "#masthead-ad",
    ".ytp-ad-overlay-container",
  ];
  const skipSelectors = [
    ".ytp-ad-skip-button",
    ".ytp-skip-ad-button",
    ".ytp-ad-skip-button-modern",
  ];

  const clean = () => {
    if (!enabled) return;
    for (const selector of selectors) {
      document.querySelectorAll(selector).forEach((node) => node.remove());
    }
    for (const selector of skipSelectors) {
      document.querySelectorAll(selector).forEach((button) => button.click?.());
    }

    const player = document.querySelector(".html5-video-player.ad-showing");
    const video = player?.querySelector("video");
    if (video && Number.isFinite(video.duration) && video.duration > 0) {
      video.muted = true;
      video.currentTime = video.duration;
    }
  };

  const style = document.createElement("style");
  style.id = "pake-youtube-adblock-style";
  style.textContent = `${selectors.join(",")} { display: none !important; }`;
  document.documentElement.appendChild(style);

  let timer;
  const scheduleClean = () => {
    clearTimeout(timer);
    timer = setTimeout(clean, 50);
  };
  new MutationObserver(scheduleClean).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  window.pakeAdblock = {
    isEnabled: () => enabled,
    setEnabled(nextEnabled) {
      enabled = Boolean(nextEnabled);
      style.textContent = enabled
        ? `${selectors.join(",")} { display: none !important; }`
        : "";
      if (enabled) clean();
    },
  };
  clean();
})();
```

Register it in `src-tauri/src/app/window.rs` after `config_script` and before the generic custom injection:

```rust
.initialization_script(include_str!("../inject/youtube_adblock.js"))
```

- [ ] **Step 4: Run injection tests and lint-compatible formatting**

```powershell
npx vitest run tests/unit/youtube-adblock.test.js tests/unit/event-link-guard.test.js
pnpm exec prettier --check src-tauri/src/inject/youtube_adblock.js tests/unit/youtube-adblock.test.js
```

Expected: tests PASS and Prettier reports both files formatted.

- [ ] **Step 5: Commit injected blocking**

```powershell
git add src-tauri/src/inject/youtube_adblock.js src-tauri/src/app/window.rs tests/unit/youtube-adblock.test.js
git commit -m "feat: clean YouTube ad UI and skip player ads"
```

## Task 6: Recovery command and tray session toggle

**Files:**
- Modify: `src-tauri/src/app/invoke.rs`
- Modify: `src-tauri/src/app/setup.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/src/inject/youtube_adblock.js`
- Modify: `tests/unit/youtube-adblock.test.js`

- [ ] **Step 1: Add failing recovery tests to the JavaScript harness**

The `run` helper already accepts a `querySelector` function from Task 5. Add:

```js
it("requests native recovery once for a known anti-block state", async () => {
  const { context } = run();
  context.window.pakeAdblock.recover("anti-adblock");
  context.window.pakeAdblock.recover("anti-adblock");
  await Promise.resolve();
  expect(context.window.__TAURI__.core.invoke).toHaveBeenCalledTimes(1);
  expect(context.window.__TAURI__.core.invoke).toHaveBeenCalledWith(
    "disable_adblock_for_session",
    { reason: "anti-adblock" },
  );
});

it("recovers only after 15 seconds without ad playback progress", () => {
  const video = { currentTime: 3, duration: 30, muted: false, paused: false };
  const player = { querySelector: () => video };
  const { context } = run({
    querySelector: (selector) =>
      selector === ".html5-video-player.ad-showing" ? player : null,
  });

  context.window.pakeAdblock.checkPlaybackStall(1_000);
  context.window.pakeAdblock.checkPlaybackStall(15_999);
  expect(context.window.__TAURI__.core.invoke).not.toHaveBeenCalled();

  context.window.pakeAdblock.checkPlaybackStall(16_000);
  expect(context.window.__TAURI__.core.invoke).toHaveBeenCalledWith(
    "disable_adblock_for_session",
    { reason: "ad-playback-stall" },
  );
});
```

- [ ] **Step 2: Add the native command with a focused Rust test**

In `src-tauri/src/app/invoke.rs`, add:

```rust
use crate::adblock::state::AdblockSession;
use tauri::State;

#[command]
pub fn disable_adblock_for_session(
    state: State<'_, AdblockSession>,
    reason: String,
) -> bool {
    #[cfg(debug_assertions)]
    eprintln!("[Pake] Disabling adblock for session: {reason}");
    state.disable_for_recovery()
}
```

Register `disable_adblock_for_session` in the `use app::invoke` list and `tauri::generate_handler!` list in `src-tauri/src/lib.rs`.

- [ ] **Step 3: Add one-shot automatic recovery to the injected module**

Extend `youtube_adblock.js` with:

```js
const recoveryKey = "pake-youtube-adblock-recovered";
const disabledKey = "pake-youtube-adblock-disabled";
let recoveryRequested = sessionStorage.getItem(recoveryKey) === "1";
enabled = sessionStorage.getItem(disabledKey) !== "1";

const recover = (reason) => {
  if (recoveryRequested) return;
  recoveryRequested = true;
  sessionStorage.setItem(recoveryKey, "1");
  sessionStorage.setItem(disabledKey, "1");
  window.__TAURI__?.core
    ?.invoke("disable_adblock_for_session", { reason })
    .then((disabled) => {
      if (disabled) window.location.reload();
    })
    .catch(() => {});
};
```

Update `window.pakeAdblock.setEnabled` so the state survives a same-session reload:

```js
setEnabled(nextEnabled) {
  enabled = Boolean(nextEnabled);
  if (enabled) {
    sessionStorage.removeItem(disabledKey);
    sessionStorage.removeItem(recoveryKey);
    recoveryRequested = false;
  } else {
    sessionStorage.setItem(disabledKey, "1");
  }
  style.textContent = enabled
    ? `${selectors.join(",")} { display: none !important; }`
    : "";
  if (enabled) clean();
},
```

Expose `recover` on `window.pakeAdblock`. During `clean`, use only the versioned signatures:

```js
const antiBlockSelectors = [
  "ytd-enforcement-message-view-model",
  "tp-yt-paper-dialog ytd-enforcement-message-view-model",
];
if (antiBlockSelectors.some((selector) => document.querySelector(selector))) {
  recover("anti-adblock");
  return;
}
```

Add a 1-second interval that starts a timestamp only while `.html5-video-player.ad-showing video` exists, is not paused, and its `currentTime` does not advance. After 15 consecutive seconds call `recover("ad-playback-stall")`. Reset the timestamp when progress resumes, the ad class disappears, or the video is paused.

Implement that interval with this explicit state machine:

```js
let stalledSince = null;
let lastAdTime = null;

const checkPlaybackStall = (now = Date.now()) => {
  const player = document.querySelector(".html5-video-player.ad-showing");
  const video = player?.querySelector("video");
  if (!video || video.paused) {
    stalledSince = null;
    lastAdTime = null;
    return;
  }

  if (lastAdTime === null || video.currentTime !== lastAdTime) {
    lastAdTime = video.currentTime;
    stalledSince = now;
    return;
  }

  if (stalledSince !== null && now - stalledSince >= 15_000) {
    recover("ad-playback-stall");
  }
};

setInterval(checkPlaybackStall, 1_000);
```

Expose `checkPlaybackStall` with `recover` on `window.pakeAdblock` so the timer logic is deterministic in unit tests.

- [ ] **Step 4: Add the checked tray item**

Change `set_system_tray` in `src-tauri/src/app/setup.rs` to accept `adblock_session: AdblockSession` and `show_adblock_toggle: bool`. Build this optional item:

```rust
let adblock_toggle = show_adblock_toggle
    .then(|| {
        tauri::menu::CheckMenuItemBuilder::with_id(
            "toggle_youtube_adblock",
            "Block YouTube ads",
        )
        .checked(adblock_session.is_enabled())
        .build(app)
    })
    .transpose()?;
```

Insert it before `quit` when present. In the menu handler add:

Build the menu with explicit branches so every item keeps a stable lifetime until `build` returns:

```rust
let menu = match (allow_multi_window, adblock_toggle.as_ref()) {
    (true, Some(toggle)) => MenuBuilder::new(app)
        .items(&[&new_window, &hide_app, &show_app, toggle, &quit])
        .build(app)?,
    (false, Some(toggle)) => MenuBuilder::new(app)
        .items(&[&hide_app, &show_app, toggle, &quit])
        .build(app)?,
    (true, None) => MenuBuilder::new(app)
        .items(&[&new_window, &hide_app, &show_app, &quit])
        .build(app)?,
    (false, None) => MenuBuilder::new(app)
        .items(&[&hide_app, &show_app, &quit])
        .build(app)?,
};
```

In the menu handler add:

```rust
"toggle_youtube_adblock" => {
    let enabled = !adblock_session.is_enabled();
    adblock_session.set_enabled(enabled);
    if let Some(window) = app.get_webview_window("pake") {
        let script = format!(
            "window.pakeAdblock?.setEnabled({enabled}); window.location.reload();"
        );
        let _ = window.eval(&script);
    }
}
```

Pass the cloned session and `pake_config.adblock.is_enabled_for("youtube")` from `src-tauri/src/lib.rs`.

- [ ] **Step 5: Verify recovery and tray compilation**

```powershell
npx vitest run tests/unit/youtube-adblock.test.js
cargo fmt --manifest-path src-tauri/Cargo.toml
cargo test --manifest-path src-tauri/Cargo.toml --lib
cargo check --manifest-path src-tauri/Cargo.toml --lib
```

Expected: JavaScript recovery invokes native disablement once; all Rust tests PASS; tray code compiles on Windows.

- [ ] **Step 6: Commit recovery and manual control**

```powershell
git add src-tauri/src/app/invoke.rs src-tauri/src/app/setup.rs src-tauri/src/lib.rs src-tauri/src/inject/youtube_adblock.js tests/unit/youtube-adblock.test.js
git commit -m "feat: add YouTube adblock recovery and tray toggle"
```

## Task 7: Enable the profile only for the Windows YouTube preset

**Files:**
- Modify: `default_app_list.json`
- Modify: `.github/workflows/release.yml`
- Modify: `.github/workflows/single-app.yaml`
- Create: `tests/unit/popular-app-adblock.test.ts`

- [ ] **Step 1: Write failing preset/workflow tests**

Create `tests/unit/popular-app-adblock.test.ts`:

```ts
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

const apps = JSON.parse(fs.readFileSync('default_app_list.json', 'utf8'));
const release = fs.readFileSync('.github/workflows/release.yml', 'utf8');
const singleApp = fs.readFileSync('.github/workflows/single-app.yaml', 'utf8');

describe('popular app ad-block profile', () => {
  it('selects YouTube and no other popular app', () => {
    expect(apps.find((app) => app.name === 'youtube').adblock).toBe('youtube');
    expect(
      apps.filter((app) => app.name !== 'youtube' && app.adblock),
    ).toEqual([]);
  });

  it('passes the profile and applies it only in the Windows command', () => {
    expect(release).toContain('adblock: ${{ matrix.config.adblock ||');
    expect(singleApp).toContain('adblock:');
    const windowsSection = singleApp.split('- name: Build for Windows')[1];
    expect(windowsSection).toContain('$args += "--adblock"');
    expect(windowsSection).toContain('$args += "--show-system-tray"');
    expect(singleApp.split('- name: Build for Windows')[0]).not.toContain(
      '--adblock',
    );
  });
});
```

- [ ] **Step 2: Run the workflow test and confirm it fails**

```powershell
npx vitest run tests/unit/popular-app-adblock.test.ts
```

Expected: FAIL because the preset and workflow input are absent.

- [ ] **Step 3: Thread the profile through the release workflow**

Add to the YouTube object in `default_app_list.json`:

```json
"adblock": "youtube"
```

In `.github/workflows/release.yml`, pass:

```yaml
adblock: ${{ matrix.config.adblock || '' }}
```

In both `workflow_dispatch.inputs` and `workflow_call.inputs` in `.github/workflows/single-app.yaml`, add an optional string input named `adblock`, defaulting to an empty string.

Only inside the `Build for Windows` PowerShell block, add:

```powershell
if ("${{ inputs.adblock }}" -ne "") {
  $args += "--adblock", "${{ inputs.adblock }}"
  $args += "--show-system-tray"
}
```

- [ ] **Step 4: Run workflow and release-flow tests**

```powershell
npx vitest run tests/unit/popular-app-adblock.test.ts
```

Expected: Vitest PASS, proving the preset and reusable workflow remain synchronized without invoking the expensive two-app release build.

- [ ] **Step 5: Commit preset wiring**

```powershell
git add default_app_list.json .github/workflows/release.yml .github/workflows/single-app.yaml tests/unit/popular-app-adblock.test.ts
git commit -m "build: enable adblock for Windows YouTube app"
```

## Task 8: Documentation and complete verification

**Files:**
- Modify: `docs/cli-usage.md`
- Modify: `docs/cli-usage_CN.md`

- [ ] **Step 1: Document the advanced option in both CLI references**

Add after the existing `[inject]` section in `docs/cli-usage.md`:

```markdown
#### [adblock]

Enable a built-in ad-block profile. The initial `youtube` profile combines conservative request filtering with page cleanup on Windows WebView2 builds.

```shell
pake https://www.youtube.com --name YouTube --show-system-tray --adblock youtube
```

The blocker may stop working when YouTube changes and may conflict with YouTube's terms or enforcement. Use the tray item **Block YouTube ads** to disable it for the current session if playback fails. SponsorBlock and embedded sponsorship skipping are not included.
```

Add the equivalent section to `docs/cli-usage_CN.md`, preserving its existing language and heading style.

- [ ] **Step 2: Run all fast validation**

```powershell
pnpm run cli:build
npx vitest run
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo test --manifest-path src-tauri/Cargo.toml --lib
cargo check --manifest-path src-tauri/Cargo.toml --lib
pnpm run format:check
git diff --check
```

Expected: every command exits 0, Vitest reports all tests passing, and Git reports no whitespace errors.

- [ ] **Step 3: Build and manually exercise the Windows app**

Run the development build:

```powershell
pnpm run cli:dev -- https://www.youtube.com --name YouTube --show-system-tray --adblock youtube
```

Verify:

- YouTube opens signed out, then signs in and persists the session.
- A normal video plays, seeks, changes quality, enters fullscreen, and shows comments.
- Shorts, live content, and an age-restricted video do not break.
- Delivered pre-roll/mid-roll ads are skipped or blocked; banners and overlays disappear.
- The tray checkbox disables blocking and reloads playback.
- A known anti-ad-block screen triggers no more than one recovery reload.
- Task Manager memory is recorded after five minutes on the same video for the modified and unmodified Pake builds.

- [ ] **Step 4: Produce the Windows installer**

```powershell
node dist/cli.js https://www.youtube.com --name YouTube --icon src-tauri/png/youtube_256.ico --show-system-tray --adblock youtube --targets x64
```

Expected: an x64 MSI is produced and launches successfully on Windows with WebView2 installed.

- [ ] **Step 5: Commit documentation and any regenerated artifacts**

```powershell
git add docs/cli-usage.md docs/cli-usage_CN.md dist/cli.js src-tauri/Cargo.lock
git commit -m "docs: explain YouTube adblock profile"
```

- [ ] **Step 6: Push the completed branch**

```powershell
git status --short --branch
git push origin codex/youtube-adblock
```

Expected: the working tree is clean and `origin/codex/youtube-adblock` advances to the final verified commit.
