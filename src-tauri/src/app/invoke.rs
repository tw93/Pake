use crate::app::navigation::{history_step, reload_window};
use crate::app::notification::{self, NotificationOutcome, NotificationParams};
use crate::util::{
    check_file_or_append, get_download_dir, get_download_message_with_lang,
    sanitize_download_filename, show_toast, MessageType,
};
use std::str::FromStr;
use std::sync::atomic::{AtomicI64, Ordering};
use std::sync::OnceLock;
use tauri::http::Method;
use tauri::{command, AppHandle, Manager, Url, WebviewWindow};
use tauri_plugin_http::reqwest::header::{
    HeaderMap, HeaderValue, COOKIE, LOCATION, REFERER, USER_AGENT,
};
use tauri_plugin_http::reqwest::{redirect::Policy, Client, ClientBuilder, Request, Response};
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

/// Build a Cookie header from the webview session so authenticated downloads
/// match what the page itself would request. Best-effort: missing cookies
/// fall through to an anonymous request.
fn cookie_header_for_url(window: &WebviewWindow, url: &Url) -> Option<HeaderValue> {
    // Wry 0.54 compares Cookie.domain to Url.domain, which is None for IPs
    // on macOS. Read this window's store only for that broken branch.
    #[cfg(target_os = "macos")]
    let cookies = if url.host_str().is_some_and(|host| {
        host.trim_matches(['[', ']'])
            .parse::<std::net::IpAddr>()
            .is_ok()
    }) {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .ok()?
            .as_secs();
        let mut cookies = window.cookies().ok()?;
        cookies.retain(|cookie| cookie_matches_ip_url(cookie, url, now));
        cookies.sort_by_key(|cookie| std::cmp::Reverse(cookie.path().unwrap_or("/").len()));
        cookies
    } else {
        window.cookies_for_url(url.clone()).ok()?
    };
    #[cfg(not(target_os = "macos"))]
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

#[cfg(target_os = "macos")]
fn cookie_matches_ip_url(cookie: &tauri::webview::Cookie<'_>, url: &Url, now: u64) -> bool {
    use std::net::IpAddr;
    let target = url
        .host_str()
        .and_then(|host| host.trim_matches(['[', ']']).parse::<IpAddr>().ok());
    let domain = cookie
        .domain()
        .and_then(|domain| domain.trim_matches(['[', ']']).parse::<IpAddr>().ok());
    if target.is_none()
        || target != domain
        || (cookie.secure() == Some(true) && url.scheme() != "https")
    {
        return false;
    }
    if cookie
        .expires_datetime()
        .is_some_and(|expiry| expiry.unix_timestamp() <= 0 || expiry.unix_timestamp() as u64 <= now)
    {
        return false;
    }
    let path = cookie
        .path()
        .filter(|path| path.starts_with('/'))
        .unwrap_or("/");
    url.path() == path
        || (url.path().starts_with(path)
            && (path.ends_with('/') || url.path().as_bytes().get(path.len()) == Some(&b'/')))
}

/// One client for all downloads: the TLS config and connection pool are built
/// once and keep-alive connections are reused across files instead of paying
/// for a fresh client per file.
static DOWNLOAD_CLIENT: OnceLock<Result<Client, String>> = OnceLock::new();

fn download_client() -> Result<&'static Client, String> {
    DOWNLOAD_CLIENT
        .get_or_init(|| {
            ClientBuilder::new()
                .redirect(Policy::none())
                .referer(false)
                .build()
                .map_err(|e| format!("Failed to build download HTTP client: {e}"))
        })
        .as_ref()
        .map_err(Clone::clone)
}

/// Referer for a download, mirroring the browser default referrer policy
/// (strict-origin-when-cross-origin): the full page URL for same-origin
/// downloads, the bare origin cross-origin, and nothing on an https -> http
/// downgrade or from a non-http(s) page.
fn referer_header_for(page_url: &str, download_url: &Url) -> Option<HeaderValue> {
    let mut page = Url::from_str(page_url).ok()?;
    if !matches!(page.scheme(), "http" | "https")
        || !matches!(download_url.scheme(), "http" | "https")
    {
        return None;
    }
    let _ = page.set_username("");
    let _ = page.set_password(None);
    page.set_fragment(None);
    let value = if page.origin() == download_url.origin() {
        page.into()
    } else if page.scheme() == "https" && download_url.scheme() == "http" {
        return None;
    } else {
        format!("{}/", page.origin().ascii_serialization())
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

/// IPC context must belong to the webview that actually made the request.
fn trusted_page_url(requested: Option<&str>, actual: Option<&Url>) -> Option<String> {
    let actual = actual?;
    let page = Url::parse(requested?).ok()?;
    if !matches!(actual.scheme(), "http" | "https") || page.origin() != actual.origin() {
        return None;
    }
    Some(page.into())
}

/// Recompute session headers on every hop. Referrer information can only
/// narrow, and the shared connection pool must never share window cookies.
async fn download_response(
    client: &Client,
    mut url: Url,
    user_agent: Option<&str>,
    page_url: Option<&str>,
    mut cookie_for_url: impl FnMut(&Url) -> Option<HeaderValue>,
) -> Result<Response, String> {
    let mut referrer = page_url.map(str::to_owned);
    let mut redirects = 0;
    loop {
        if !matches!(url.scheme(), "http" | "https") {
            return Err("Downloads require an HTTP(S) URL".into());
        }
        let mut request = Request::new(Method::GET, url.clone());
        *request.headers_mut() =
            build_download_headers(cookie_for_url(&url), user_agent, referrer.as_deref(), &url);
        referrer = request
            .headers()
            .get(REFERER)
            .and_then(|h| h.to_str().ok())
            .map(str::to_owned);
        let response = client.execute(request).await.map_err(|e| e.to_string())?;
        if !matches!(response.status().as_u16(), 301 | 302 | 303 | 307 | 308) {
            return Ok(response);
        }
        let Some(location) = response.headers().get(LOCATION) else {
            return Ok(response);
        };
        if redirects == 10 {
            return Err("Download exceeded 10 redirects".into());
        }
        let location = location
            .to_str()
            .map_err(|e| format!("Invalid download redirect: {e}"))?;
        url = url
            .join(location)
            .map_err(|e| format!("Invalid download redirect: {e}"))?;
        redirects += 1;
    }
}

/// Reserve the destination with `create_new`, so two downloads that resolve the
/// same free name at the same time cannot write into one file.
async fn create_unique_file(path: &str) -> std::io::Result<(tokio::fs::File, String)> {
    let mut candidate = check_file_or_append(path);
    for _ in 0..100 {
        match tokio::fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&candidate)
            .await
        {
            Ok(file) => return Ok((file, candidate)),
            Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => {
                candidate = check_file_or_append(&candidate);
            }
            Err(error) => return Err(error),
        }
    }
    Err(std::io::Error::new(
        std::io::ErrorKind::AlreadyExists,
        "no free download filename",
    ))
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

    let url = Url::from_str(&params.url).map_err(|e| format!("Invalid URL: {}", e))?;
    let page_url = trusted_page_url(params.page_url.as_deref(), window.url().ok().as_ref());

    let response = match download_client() {
        Ok(client) => {
            download_response(
                client,
                url,
                params.user_agent.as_deref(),
                page_url.as_deref(),
                |target| cookie_header_for_url(&window, target),
            )
            .await
        }
        Err(error) => Err(error),
    };

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

            let (mut file, file_path) = create_unique_file(path_str).await.map_err(|e| {
                show_toast(
                    &window,
                    &get_download_message_with_lang(
                        MessageType::DirectoryFailure,
                        params.language.clone(),
                    ),
                );
                format!("Failed to create file: {e}")
            })?;

            // The error flags disk failures, which get the directory toast.
            let written: Result<(), (bool, String)> = async {
                while let Some(chunk) = res
                    .chunk()
                    .await
                    .map_err(|e| (false, format!("Failed to get chunk: {e}")))?
                {
                    file.write_all(&chunk)
                        .await
                        .map_err(|e| (true, format!("Failed to write chunk: {e}")))?;
                }
                file.flush()
                    .await
                    .map_err(|e| (true, format!("Failed to finish writing file: {e}")))
            }
            .await;

            if let Err((disk_failure, error)) = written {
                // A truncated file under the final name looks like a finished
                // download, so remove it before reporting the failure.
                drop(file);
                if let Err(remove_error) = tokio::fs::remove_file(&file_path).await {
                    eprintln!(
                        "[Pake] Failed to remove partial download {file_path}: {remove_error}"
                    );
                }
                if disk_failure {
                    show_toast(
                        &window,
                        &get_download_message_with_lang(
                            MessageType::DirectoryFailure,
                            params.language.clone(),
                        ),
                    );
                }
                return Err(error);
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
pub fn send_notification(
    app: AppHandle,
    window: WebviewWindow,
    params: NotificationParams,
) -> Result<NotificationOutcome, String> {
    // Tauri injects the invoker as `window`, so a notification raised by a
    // secondary window routes its click back to that window rather than "pake".
    notification::send(&app, &window, &params)
}

#[command]
pub fn close_notification(app: AppHandle, window: WebviewWindow, id: String) -> Result<(), String> {
    notification::close(&app, &window, &id)
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

    #[test]
    fn concurrent_downloads_of_one_name_reserve_distinct_files() {
        let dir = std::env::temp_dir().join(format!("pake-unique-file-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let target = dir.join("report.pdf");
        std::fs::write(&target, b"existing").unwrap();
        let path = target.to_str().unwrap();
        let runtime = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap();

        let (first, second) = runtime
            .block_on(async { tokio::join!(create_unique_file(path), create_unique_file(path)) });
        let (_first_file, first) = first.unwrap();
        let (_second_file, second) = second.unwrap();

        assert_ne!(first, second);
        assert_ne!(first, path);
        assert_ne!(second, path);
        assert_eq!(std::fs::read(&target).unwrap(), b"existing");
        std::fs::remove_dir_all(&dir).unwrap();
    }

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
    fn same_origin_referer_never_contains_credentials() {
        let h = headers(
            None,
            None,
            Some("https://user:secret@example.com/account?token=1#private"),
            "https://example.com/file.zip",
        );
        assert_eq!(
            h.get(REFERER).unwrap(),
            "https://example.com/account?token=1"
        );
    }

    #[test]
    fn cross_origin_referer_sends_origin_only() {
        let h = headers(
            None,
            None,
            Some("https://example.com/articles/1"),
            "https://cdn.example.net/a.zip",
        );
        assert_eq!(h.get(REFERER).unwrap(), "https://example.com/");
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

    #[test]
    fn referrer_information_only_narrows_across_redirects() {
        let mut page = Some("https://example.com/account?token=fixture#private".to_string());
        for (target, expected) in [
            (
                "https://example.com/file",
                Some("https://example.com/account?token=fixture"),
            ),
            ("https://cdn.example.com/file", Some("https://example.com/")),
            ("https://example.com/file", Some("https://example.com/")),
            ("http://example.com/file", None),
            ("https://example.com/file", None),
        ] {
            let result = headers(None, None, page.as_deref(), target);
            page = result.get(REFERER).map(|h| h.to_str().unwrap().to_owned());
            assert_eq!(page.as_deref(), expected);
        }
    }

    #[test]
    fn ipc_page_context_cannot_spoof_another_origin() {
        let actual = Url::parse("https://app.example/current").unwrap();
        assert_eq!(
            trusted_page_url(Some("https://app.example/route#fragment"), Some(&actual)).as_deref(),
            Some("https://app.example/route#fragment")
        );
        for requested in [
            "https://victim.example/account",
            "https://app.example:8443/",
            "http://app.example/",
            "file:///tmp/fixture",
            "invalid",
        ] {
            assert!(trusted_page_url(Some(requested), Some(&actual)).is_none());
        }
        assert!(trusted_page_url(Some("https://victim.example/"), None).is_none());
        assert!(trusted_page_url(None, Some(&actual)).is_none());
        let local = Url::parse("tauri://localhost/index.html").unwrap();
        assert!(trusted_page_url(Some("https://victim.example/"), Some(&local)).is_none());
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn ip_cookie_selection_keeps_domain_path_secure_and_expiry_boundaries() {
        use tauri::webview::Cookie;
        let url = Url::parse("http://127.0.0.1:8123/app/file").unwrap();
        for (value, matches) in [
            (
                "session=fixture; Domain=127.0.0.1; Path=/app; HttpOnly",
                true,
            ),
            ("session=fixture; Domain=127.0.0.2; Path=/", false),
            ("session=fixture; Domain=example.com; Path=/", false),
            (
                "session=fixture; Domain=127.0.0.1; Path=/application",
                false,
            ),
            ("session=fixture; Domain=127.0.0.1; Path=/app/file", true),
            ("session=fixture; Domain=127.0.0.1; Path=/; Secure", false),
            (
                "session=fixture; Domain=127.0.0.1; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT",
                false,
            ),
        ] {
            assert_eq!(
                cookie_matches_ip_url(&Cookie::parse(value).unwrap(), &url, 10),
                matches,
                "{value}"
            );
        }
        let secure = Cookie::parse("session=fixture; Domain=127.0.0.1; Path=/; Secure").unwrap();
        assert!(cookie_matches_ip_url(
            &secure,
            &Url::parse("https://127.0.0.1/app").unwrap(),
            10
        ));
        let ipv6 = Cookie::parse("session=fixture; Domain=0:0:0:0:0:0:0:1; Path=/").unwrap();
        assert!(cookie_matches_ip_url(
            &ipv6,
            &Url::parse("http://[::1]/").unwrap(),
            10
        ));
        assert!(!cookie_matches_ip_url(
            &ipv6,
            &Url::parse("http://[::2]/").unwrap(),
            10
        ));
    }

    fn serve_downloads(
        responses: impl FnOnce(&Url) -> Vec<(u16, Option<String>)>,
    ) -> (Url, std::thread::JoinHandle<Vec<String>>) {
        use std::io::{BufRead, BufReader, Write};
        use std::net::TcpListener;
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let origin = Url::parse(&format!("http://{}/", listener.local_addr().unwrap())).unwrap();
        let responses = responses(&origin);
        let thread = std::thread::spawn(move || {
            let mut requests = Vec::new();
            for (status, location) in responses {
                let (mut stream, _) = listener.accept().unwrap();
                stream
                    .set_read_timeout(Some(std::time::Duration::from_secs(5)))
                    .unwrap();
                let mut reader = BufReader::new(stream.try_clone().unwrap());
                let mut request = String::new();
                loop {
                    let mut line = String::new();
                    assert!(reader.read_line(&mut line).unwrap() > 0);
                    if line == "\r\n" {
                        break;
                    }
                    request.push_str(&line);
                }
                requests.push(request.to_lowercase());
                let location = location
                    .map(|value| format!("Location: {value}\r\n"))
                    .unwrap_or_default();
                write!(stream, "HTTP/1.1 {status} Test\r\n{location}Content-Length: 7\r\nConnection: close\r\n\r\npayload").unwrap();
            }
            requests
        });
        (origin, thread)
    }

    #[test]
    fn redirects_recheck_cookies_and_never_restore_full_referrer() {
        let runtime = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap();
        let (origin, server) = serve_downloads(|origin| {
            let mut other = origin.join("hop").unwrap();
            other.set_host(Some("localhost")).unwrap();
            vec![
                (302, Some(other.into())),
                (307, Some(origin.join("final").unwrap().into())),
                (200, None),
            ]
        });
        let mut cookie_targets = Vec::new();
        let response = runtime
            .block_on(download_response(
                download_client().unwrap(),
                origin.join("start").unwrap(),
                Some("Pake-fixture"),
                Some(
                    origin
                        .join("account?token=fixture#fragment")
                        .unwrap()
                        .as_str(),
                ),
                |target| {
                    cookie_targets.push(target.clone());
                    Some(HeaderValue::from_static(
                        if target.host_str() == Some("localhost") {
                            "target=fixture"
                        } else {
                            "source=fixture"
                        },
                    ))
                },
            ))
            .unwrap();
        assert_eq!(runtime.block_on(response.text()).unwrap(), "payload");
        assert_eq!(cookie_targets.len(), 3);
        let requests = server.join().unwrap();
        assert!(requests[0].contains(&format!("referer: {}account?token=fixture\r\n", origin)));
        for request in &requests[1..] {
            assert!(request.contains(&format!("referer: {origin}\r\n")));
            assert!(!request.contains("token=fixture"));
        }
        assert!(requests[0].contains("cookie: source=fixture\r\n"));
        assert!(requests[1].contains("cookie: target=fixture\r\n"));
        assert!(!requests[1].contains("source=fixture"));
        assert!(requests[2].contains("cookie: source=fixture\r\n"));
        assert!(requests
            .iter()
            .all(|r| r.contains("user-agent: pake-fixture\r\n")));
    }

    #[test]
    fn redirects_keep_the_limit_relative_locations_and_statuses() {
        let runtime = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap();
        for status in [301, 302, 303, 307, 308] {
            let (origin, server) =
                serve_downloads(|_| vec![(status, Some("/final".into())), (200, None)]);
            let response = runtime
                .block_on(download_response(
                    download_client().unwrap(),
                    origin,
                    None,
                    None,
                    |_| None,
                ))
                .unwrap();
            assert_eq!(response.url().path(), "/final");
            assert_eq!(server.join().unwrap().len(), 2);
        }
        for count in [10, 11] {
            let (origin, server) = serve_downloads(|_| {
                let mut responses = vec![(302, Some("/loop".into())); count];
                if count == 10 {
                    responses.push((200, None));
                }
                responses
            });
            let result = runtime.block_on(download_response(
                download_client().unwrap(),
                origin,
                None,
                None,
                |_| None,
            ));
            assert_eq!(result.is_ok(), count == 10);
            if count == 11 {
                assert_eq!(result.unwrap_err(), "Download exceeded 10 redirects");
            }
            assert_eq!(server.join().unwrap().len(), 11);
        }
        for target in ["file:///tmp/fixture", "data:text/plain,fixture"] {
            let (origin, server) = serve_downloads(|_| vec![(302, Some(target.into()))]);
            let result = runtime.block_on(download_response(
                download_client().unwrap(),
                origin,
                None,
                None,
                |_| None,
            ));
            assert_eq!(result.unwrap_err(), "Downloads require an HTTP(S) URL");
            assert_eq!(server.join().unwrap().len(), 1);
        }
    }

    #[test]
    fn shared_client_does_not_reuse_another_windows_cookies() {
        let runtime = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap();
        let (origin, server) = serve_downloads(|_| vec![(200, None), (200, None)]);
        runtime
            .block_on(download_response(
                download_client().unwrap(),
                origin.clone(),
                None,
                None,
                |_| Some(HeaderValue::from_static("session=fixture")),
            ))
            .unwrap();
        runtime
            .block_on(download_response(
                download_client().unwrap(),
                origin,
                None,
                None,
                |_| None,
            ))
            .unwrap();
        let requests = server.join().unwrap();
        assert!(requests[0].contains("cookie: session=fixture\r\n"));
        assert!(!requests[1].contains("cookie:"));
    }
}
