# YouTube ad blocking for Pake on Windows

## Context

This fork adds an optional YouTube-specific ad blocker to Pake. It targets Windows 10 and 11, where Pake uses Microsoft Edge WebView2. The feature must remain isolated from other Pake-generated applications so upstream changes can be merged with limited conflicts.

The repository will remain a public GitHub fork of `tw93/Pake`. Development takes place on `codex/youtube-adblock` and keeps `upstream` pointed at the original repository.

## Goals

- Block YouTube pre-roll and mid-roll advertising when it can be identified safely.
- Hide YouTube advertising banners, overlays, and residual placeholders.
- Preserve sign-in, session persistence, navigation, playback controls, fullscreen, quality selection, comments, history, Shorts, live streams, and age-restricted content.
- Let the user disable blocking for the current session when playback fails.
- Keep all rules local, reviewable, and versioned with the application.
- Fail open: uncertain or failed filtering must allow playback rather than break the site.

## Non-goals

- SponsorBlock or skipping sponsorship segments embedded in videos.
- Video downloads, background playback, or premium-feature emulation.
- General-purpose blocking on sites other than YouTube.
- Remote rule updates, telemetry, a proxy service, or a companion server.
- Aggressive circumvention of YouTube anti-ad-block measures.
- A guarantee that every advertisement will be blocked after future YouTube changes.

## Selected approach

Use a hybrid of Windows-native request filtering and injected JavaScript/CSS:

1. A Rust module registers a WebView2 request hook before the first YouTube page loads.
2. A small local rule engine classifies known advertising requests.
3. Only high-confidence matches are cancelled.
4. An initialization script removes advertising UI and residual overlays from YouTube's dynamic DOM.

Script-only blocking was rejected because it reacts after the page loads, may still download advertisements, and is easier for site changes to break. A proxy or DNS solution was rejected because it complicates installation and cannot reliably distinguish advertisements from videos served through related infrastructure.

## Architecture

### Configuration

Add an `adblock` configuration object to the generated Pake configuration with conservative defaults:

```json
{
  "adblock": {
    "enabled": false,
    "profile": "youtube"
  }
}
```

The YouTube release preset enables the `youtube` profile. All other generated applications keep the feature disabled. Unknown profiles are treated as disabled.

The CLI/configuration plumbing follows Pake's existing option flow. If the public CLI receives a new option, the option definition, types, defaults, merge logic, generated `dist/cli.js`, tests, and CLI documentation must stay synchronized.

### Native request filter

Create a focused `src-tauri/src/adblock/` module with:

- A platform-neutral rule matcher that accepts a URL and resource context and returns `Allow` or `Block`.
- A YouTube ruleset containing explicit, high-confidence patterns.
- A Windows adapter that obtains the underlying WebView2 instance during window creation and registers request filters before navigation.
- No-op behavior on non-Windows targets so the fork remains buildable across Pake's supported platforms.

The adapter is attached from the existing WebView creation path in `src-tauri/src/app/window.rs`. Every Pake window, including additional windows, uses the same registration function, but registration exits immediately unless the configured profile is enabled and the URL belongs to an allowed YouTube origin.

Rules must not block broad Google or YouTube hostnames. They match narrowly defined request paths, parameters, or resource types. Matching errors and WebView2 hook failures are logged locally in debug builds and otherwise permit the request.

### Injected page cleanup

Add a self-contained initialization script under `src-tauri/src/inject/`. It activates only when the effective profile is `youtube` and the current origin is an approved YouTube origin.

The script:

- Installs CSS for known advertising containers and overlays.
- Uses a debounced `MutationObserver` because YouTube is a single-page application.
- Removes only selectors owned by the YouTube ruleset.
- Avoids patching credentials, cookies, account APIs, or unrelated playback APIs.
- Exposes a small internal enable/disable function used by the native session toggle.

Selector and URL rules remain separate from the integration code so routine YouTube changes normally require a small rules-only patch.

### Session toggle and recovery

When the YouTube profile is active, the Windows tray menu adds a checked `Block YouTube ads` item. Changing it disables or enables both filtering layers for the current application session and reloads the active YouTube page. The setting is intentionally not persisted in the MVP.

The injected layer detects only explicit, versioned anti-ad-block UI signatures and an ad-state playback stall where no media progress occurs for 15 seconds. Either condition disables blocking for the current session and performs one guarded reload. A session flag prevents reload loops. General network errors, buffering after playback has started, and ordinary paused media do not trigger automatic recovery.

The user can always disable the blocker from the tray and reload immediately. This remains the deterministic fallback when YouTube changes beyond the known recovery signatures.

## Data flow

1. Pake reads the generated configuration.
2. Window creation checks whether the YouTube profile is enabled.
3. On Windows, the WebView2 hook and initialization script are registered before navigation.
4. Each eligible request passes through the local matcher.
5. High-confidence advertising matches are cancelled; all other requests continue unchanged.
6. The injected script observes YouTube navigation and removes matching advertising UI.
7. A known anti-ad-block state can disable filtering once for the session and perform one guarded reload.
8. The tray toggle updates the session state used by both layers and reloads the page.

No browsing data, URLs, rules, or diagnostics leave the device.

## Error handling

- Invalid or missing configuration disables the feature.
- Unsupported platforms use a no-op native adapter.
- WebView2 registration failure permits all requests and leaves page cleanup available.
- Rule parsing or matching failures permit the affected request.
- JavaScript errors remain isolated inside the injected module and must not stop Pake's other initialization scripts.
- Known anti-ad-block recovery is limited to explicit signatures and one guarded reload per session.
- A manual session toggle provides recovery for false positives and unknown anti-ad-block behavior.

## Testing

### Automated tests

- Unit-test configuration defaults and profile validation.
- Unit-test URL/origin eligibility and every native allow/block rule.
- Include negative fixtures for ordinary video, audio, captions, thumbnails, comments, sign-in, and API traffic.
- Test that non-YouTube applications and non-Windows adapters remain inactive.
- Test script activation guards and selector cleanup with representative DOM fixtures.
- Test explicit anti-ad-block signatures, the 15-second ad-state stall threshold, and reload-loop prevention.
- Keep existing Pake unit, integration, Rust formatting, and CLI build checks passing.

### Windows integration tests

Manually test on Windows 10 and 11 with an updated WebView2 runtime:

- Signed-out and signed-in sessions.
- Videos with pre-roll and mid-roll ads, plus videos without ads.
- Banners, overlays, Shorts, live streams, and age-restricted content.
- Search, navigation, pause/resume, seek, fullscreen, quality changes, comments, and history.
- Additional windows if enabled by Pake configuration.
- Enable/disable recovery through the tray.
- Memory and startup comparison against the unmodified Pake YouTube build.

Because advertisement delivery varies by account, geography, and time, release verification records the tested scenarios but does not treat the absence of a delivered ad as proof that a rule works.

## Delivery

1. Create a public GitHub fork of `tw93/Pake` in the user's account.
2. Add that fork as `origin`, retaining the official repository as `upstream`.
3. Push `codex/youtube-adblock` to the fork.
4. Do not publish installers or create a release during the MVP unless requested separately.

## Constraints and risks

- Blocking advertisements may conflict with YouTube's terms or enforcement mechanisms. The fork documents this limitation and makes no guarantee of uninterrupted access.
- YouTube changes its application and delivery behavior frequently; rules require maintenance.
- WebView2-specific integration increases Windows maintenance and must remain behind conditional compilation.
- Pake is GPL-3.0-or-later; the public fork and distributed modifications must retain the applicable license and notices.
