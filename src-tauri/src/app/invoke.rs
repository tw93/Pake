use crate::app::navigation::{history_step, reload_window};
use crate::util::{
    check_file_or_append, get_download_dir, get_download_message_with_lang,
    sanitize_download_filename, show_toast, MessageType,
};
use std::str::FromStr;
use std::sync::atomic::{AtomicI64, Ordering};
use std::sync::OnceLock;
use tauri::http::Method;
use tauri::{command, AppHandle, Manager, Url, WebviewWindow};
use tauri_plugin_http::reqwest::header::{HeaderMap, HeaderValue, COOKIE, REFERER, USER_AGENT};
use tauri_plugin_http::reqwest::{Client, ClientBuilder, Request};
use tokio::io::AsyncWriteExt;

use tauri::Theme;

static BADGE_COUNT: AtomicI64 = AtomicI64::new(0);
const MAX_BADGE_COUNT: i64 = 99_999;
const MAX_BADGE_LABEL_CHARS: usize = 16;

fn normalize_badge_count(count: Option<i64>) -> Option<i64> {
    count.filter(|n| (1..=MAX_BADGE_COUNT).contains(n))
}

fn normalize_badge_label(label: Option<&str>) -> Result<Option<String>, String> {
    let Some(label) = label.map(str::trim).filter(|label| !label.is_empty()) else {
        return Ok(None);
    };

    if label.chars().count() > MAX_BADGE_LABEL_CHARS {
        return Err(format!(
            "Badge label must be {MAX_BADGE_LABEL_CHARS} characters or fewer"
        ));
    }

    Ok(Some(label.to_string()))
}

fn apply_badge(app: &AppHandle, count: Option<i64>) -> Result<(), String> {
    let label = normalize_badge_count(count).map(|n| n.to_string());
    apply_badge_label(app, label.as_deref())
}

#[cfg(target_os = "macos")]
fn apply_badge_label(app: &AppHandle, label: Option<&str>) -> Result<(), String> {
    use objc2::MainThreadMarker;
    use objc2_app_kit::NSApplication;
    use objc2_foundation::NSString;

    let label = label.map(str::to_owned);
    app.run_on_main_thread(move || {
        let Some(mtm) = MainThreadMarker::new() else {
            return;
        };
        let dock_tile = NSApplication::sharedApplication(mtm).dockTile();
        let ns_label = label.as_deref().map(NSString::from_str);
        dock_tile.setBadgeLabel(ns_label.as_deref());
    })
    .map_err(|e| format!("Failed to dispatch dock badge update: {e}"))
}

#[cfg(not(target_os = "macos"))]
fn apply_badge_label(app: &AppHandle, label: Option<&str>) -> Result<(), String> {
    let window = app
        .get_webview_window("pake")
        .ok_or("Main window not found")?;
    let count = label.and_then(|s| s.parse::<i64>().ok());
    window
        .set_badge_count(count)
        .map_err(|e| format!("Failed to set badge count: {e}"))
}

#[derive(serde::Deserialize)]
pub struct DownloadFileParams {
    url: String,
    filename: String,
    language: Option<String>,
    /// `navigator.userAgent` from the webview, so a download looks like the
    /// page's own request to CDNs that filter on User-Agent.
    user_agent: Option<String>,
    /// URL of the page that started the download; used to build a Referer
    /// header with browser-like strict-origin-when-cross-origin rules.
    page_url: Option<String>,
}

#[derive(serde::Deserialize)]
pub struct NotificationParams {
    title: String,
    body: String,
    icon: String,
}

/// Build a Cookie header from the webview session so authenticated downloads
/// match what the page itself would request. Best-effort: missing cookies
/// fall through to an anonymous request.
fn cookie_header_for_url(window: &WebviewWindow, url: &Url) -> Option<HeaderValue> {
    let cookies = window.cookies_for_url(url.clone()).ok()?;
    if cookies.is_empty() {
        return None;
    }
    let header = cookies
        .iter()
        .map(|cookie| format!("{}={}", cookie.name(), cookie.value()))
        .collect::<Vec<_>>()
        .join("; ");
    HeaderValue::from_str(&header).ok()
}

/// One client for all downloads: the TLS config and connection pool are built
/// once and keep-alive connections are reused across files instead of paying
/// for a fresh client per file.
static DOWNLOAD_CLIENT: OnceLock<Client> = OnceLock::new();

fn download_client() -> &'static Client {
    DOWNLOAD_CLIENT.get_or_init(|| {
        ClientBuilder::new()
            .build()
            .expect("failed to build the download HTTP client")
    })
}

/// Referer for a download, mirroring the browser default referrer policy
/// (strict-origin-when-cross-origin): the full page URL for same-origin
/// downloads, the bare origin cross-origin, and nothing on an https -> http
/// downgrade or from a non-http(s) page.
fn referer_header_for(page_url: &str, download_url: &Url) -> Option<HeaderValue> {
    let mut page = Url::from_str(page_url).ok()?;
    if !matches!(page.scheme(), "http" | "https") {
        return None;
    }
    let value = if page.origin() == download_url.origin() {
        page.set_fragment(None);
        page.into()
    } else if page.scheme() == "https" && download_url.scheme() == "http" {
        return None;
    } else {
        page.origin().ascii_serialization()
    };
    HeaderValue::from_str(&value).ok()
}

/// Assemble the headers a download would carry if the webview had fetched the
/// file itself: session cookies, the webview's User-Agent, and a Referer
/// derived from the page URL. Every piece is best-effort and skipped when it
/// cannot be represented as a valid header value.
fn build_download_headers(
    cookie: Option<HeaderValue>,
    user_agent: Option<&str>,
    page_url: Option<&str>,
    download_url: &Url,
) -> HeaderMap {
    let mut headers = HeaderMap::new();
    if let Some(cookie) = cookie {
        headers.insert(COOKIE, cookie);
    }
    if let Some(ua) = user_agent.and_then(|ua| HeaderValue::from_str(ua).ok()) {
        headers.insert(USER_AGENT, ua);
    }
    if let Some(referer) = page_url.and_then(|page| referer_header_for(page, download_url)) {
        headers.insert(REFERER, referer);
    }
    headers
}

#[command]
pub async fn download_file(
    window: WebviewWindow,
    app: AppHandle,
    params: DownloadFileParams,
) -> Result<(), String> {
    // Toast on the calling window (secondary windows included), not a hard-coded
    // main-window label. Tauri injects the invoker as `window`.
    show_toast(
        &window,
        &get_download_message_with_lang(MessageType::Start, params.language.clone()),
    );

    let download_dir = get_download_dir(&app).inspect_err(|_| {
        show_toast(
            &window,
            &get_download_message_with_lang(MessageType::DirectoryFailure, params.language.clone()),
        );
    })?;

    let output_path = download_dir.join(sanitize_download_filename(&params.filename));

    let path_str = output_path.to_str().ok_or("Invalid output path")?;

    let file_path = check_file_or_append(path_str);

    let url = Url::from_str(&params.url).map_err(|e| format!("Invalid URL: {}", e))?;

    let mut request = Request::new(Method::GET, url.clone());
    *request.headers_mut() = build_download_headers(
        cookie_header_for_url(&window, &url),
        params.user_agent.as_deref(),
        params.page_url.as_deref(),
        &url,
    );

    let response = download_client().execute(request).await;

    match response {
        Ok(mut res) => {
            // Transport success is not download success: 403/404 HTML error pages
            // must not be written as files or toasted as successful downloads.
            if !res.status().is_success() {
                show_toast(
                    &window,
                    &get_download_message_with_lang(MessageType::Failure, params.language),
                );
                return Err(format!("Download failed with HTTP status {}", res.status()));
            }

            let mut file = tokio::fs::File::create(&file_path).await.map_err(|e| {
                show_toast(
                    &window,
                    &get_download_message_with_lang(
                        MessageType::DirectoryFailure,
                        params.language.clone(),
                    ),
                );
                format!("Failed to create file: {e}")
            })?;

            while let Some(chunk) = res
                .chunk()
                .await
                .map_err(|e| format!("Failed to get chunk: {}", e))?
            {
                file.write_all(&chunk).await.map_err(|e| {
                    show_toast(
                        &window,
                        &get_download_message_with_lang(
                            MessageType::DirectoryFailure,
                            params.language.clone(),
                        ),
                    );
                    format!("Failed to write chunk: {e}")
                })?;
            }

            show_toast(
                &window,
                &get_download_message_with_lang(MessageType::Success, params.language.clone()),
            );
            Ok(())
        }
        Err(e) => {
            show_toast(
                &window,
                &get_download_message_with_lang(MessageType::Failure, params.language),
            );
            Err(e.to_string())
        }
    }
}

#[command]
pub fn send_notification(app: AppHandle, params: NotificationParams) -> Result<(), String> {
    use tauri_plugin_notification::NotificationExt;
    app.notification()
        .builder()
        .title(&params.title)
        .body(&params.body)
        .icon(&params.icon)
        .show()
        .map_err(|e| format!("Failed to show notification: {}", e))?;
    Ok(())
}

#[command]
pub fn set_dock_badge(app: AppHandle, count: Option<i64>) -> Result<(), String> {
    let normalized = normalize_badge_count(count);
    BADGE_COUNT.store(normalized.unwrap_or(0), Ordering::SeqCst);
    apply_badge(&app, normalized)
}

#[command]
pub fn increment_dock_badge(app: AppHandle) -> Result<(), String> {
    let current = BADGE_COUNT.load(Ordering::SeqCst);
    let next = current.saturating_add(1).clamp(1, MAX_BADGE_COUNT);
    BADGE_COUNT.store(next, Ordering::SeqCst);
    apply_badge(&app, Some(next))
}

#[command]
pub fn clear_dock_badge(app: AppHandle) -> Result<(), String> {
    BADGE_COUNT.store(0, Ordering::SeqCst);
    apply_badge(&app, None)
}

#[command]
pub fn set_dock_badge_label(app: AppHandle, label: Option<String>) -> Result<(), String> {
    BADGE_COUNT.store(0, Ordering::SeqCst);
    let label = normalize_badge_label(label.as_deref())?;
    apply_badge_label(&app, label.as_deref())
}

#[command]
pub async fn update_theme_mode(app: AppHandle, mode: String) {
    let theme = if mode == "dark" {
        Theme::Dark
    } else {
        Theme::Light
    };
    for window in app.webview_windows().values() {
        let _ = window.set_theme(Some(theme));
    }
}

// Apply native WebView zoom (WKWebView pageZoom / WebView2 ZoomFactor / WebKitGTK
// zoom level) instead of CSS hacks. CSS `transform: scale` and `html.style.zoom`
// break complex SPAs like ChatGPT (fixed positioning shifts, unrepainted layers);
// native zoom recalculates layout the same way a browser does for Cmd/Ctrl +/-.
#[command]
pub fn set_zoom(window: WebviewWindow, percent: f64) -> Result<(), String> {
    let factor = (percent / 100.0).clamp(0.3, 2.0);
    window
        .set_zoom(factor)
        .map_err(|e| format!("Failed to set zoom: {}", e))
}

/// Native navigation for injected shortcuts (Linux/Windows Ctrl+R / [ / ]).
/// Blank error pages have no JS context, so page `history` / `location` calls
/// are no-ops; these use the platform webview API instead.
#[command]
pub fn webview_navigate(window: WebviewWindow, action: String) -> Result<(), String> {
    match action.as_str() {
        "reload" => {
            reload_window(&window);
            Ok(())
        }
        "back" => {
            history_step(&window, true);
            Ok(())
        }
        "forward" => {
            history_step(&window, false);
            Ok(())
        }
        other => Err(format!(
            "Unknown webview_navigate action '{other}' (expected reload|back|forward)"
        )),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn headers(
        cookie: Option<&str>,
        user_agent: Option<&str>,
        page_url: Option<&str>,
        download_url: &str,
    ) -> HeaderMap {
        build_download_headers(
            cookie.map(|c| HeaderValue::from_str(c).unwrap()),
            user_agent,
            page_url,
            &Url::from_str(download_url).unwrap(),
        )
    }

    #[test]
    fn same_origin_referer_sends_full_page_url_without_fragment() {
        let h = headers(
            None,
            None,
            Some("https://example.com/articles/1#comments"),
            "https://example.com/files/a.zip",
        );
        assert_eq!(h.get(REFERER).unwrap(), "https://example.com/articles/1");
    }

    #[test]
    fn cross_origin_referer_sends_origin_only() {
        let h = headers(
            None,
            None,
            Some("https://example.com/articles/1"),
            "https://cdn.example.net/a.zip",
        );
        assert_eq!(h.get(REFERER).unwrap(), "https://example.com");
    }

    #[test]
    fn https_to_http_downgrade_sends_no_referer() {
        let h = headers(
            None,
            None,
            Some("https://example.com/a"),
            "http://example.com/a.zip",
        );
        assert!(h.get(REFERER).is_none());
    }

    #[test]
    fn non_http_page_sends_no_referer() {
        let h = headers(
            None,
            None,
            Some("blob:https://example.com/9c9b2c1e"),
            "https://example.com/a.zip",
        );
        assert!(h.get(REFERER).is_none());
    }

    #[test]
    fn user_agent_and_cookie_are_forwarded() {
        let h = headers(
            Some("session=abc"),
            Some("Mozilla/5.0 Pake/3.17"),
            Some("https://example.com/"),
            "https://example.com/a.zip",
        );
        assert_eq!(h.get(USER_AGENT).unwrap(), "Mozilla/5.0 Pake/3.17");
        assert_eq!(h.get(COOKIE).unwrap(), "session=abc");
    }

    #[test]
    fn missing_context_leaves_headers_empty() {
        let h = headers(None, None, None, "https://example.com/a.zip");
        assert!(h.is_empty());
    }
}
