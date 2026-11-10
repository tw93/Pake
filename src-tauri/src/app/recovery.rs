//! Getting back from a page that failed to load or a web process that died.
//!
//! WebKitGTK shows a bare engine message for a failed load and a dead grey view
//! after its web process exits; WebView2 has its own error page but leaves a
//! blank view after a renderer crash. Neither had a way back short of knowing
//! Ctrl+R. macOS is not covered: Tauri 2.10 exposes neither hook for WKWebView.

#[cfg(target_os = "linux")]
pub fn install(webview: &tauri::webview::PlatformWebview) {
    use webkit2gtk::{NetworkError, PluginError, PolicyError, WebViewExt};

    let gtk_webview = webview.inner();
    gtk_webview.connect_load_failed(|webview, _event, uri, error| {
        // A cancelled load, a load a download took over and a policy refusal are not failures.
        if error.kind::<NetworkError>() == Some(NetworkError::Cancelled)
            || error.is::<PolicyError>()
            || error.is::<PluginError>()
            || uri.starts_with("about:")
        {
            return false;
        }
        let host = tauri::Url::parse(uri)
            .ok()
            .and_then(|url| url.host_str().map(str::to_owned))
            .unwrap_or_default();
        let chinese = crate::util::UiLanguage::system() != crate::util::UiLanguage::English;
        // The failed address stays the page's own, so Try Again and Ctrl+R load it again.
        webview.load_alternate_html(&error_page(&host, chinese), uri, None);
        true
    });
    gtk_webview.connect_web_process_terminated(|webview, _reason| {
        webview.reload();
    });
}

#[cfg(target_os = "windows")]
pub fn install(webview: &tauri::webview::PlatformWebview) {
    use webview2_com::{
        Microsoft::Web::WebView2::Win32::{
            COREWEBVIEW2_PROCESS_FAILED_KIND,
            COREWEBVIEW2_PROCESS_FAILED_KIND_RENDER_PROCESS_EXITED,
        },
        ProcessFailedEventHandler,
    };

    let result = unsafe {
        (|| -> windows_core::Result<()> {
            let core = webview.controller().CoreWebView2()?;
            let mut token = 0;
            core.add_ProcessFailed(
                &ProcessFailedEventHandler::create(Box::new(|core, args| {
                    let (Some(core), Some(args)) = (core, args) else {
                        return Ok(());
                    };
                    let mut kind = COREWEBVIEW2_PROCESS_FAILED_KIND(0);
                    args.ProcessFailedKind(&mut kind)?;
                    // Only a dead renderer leaves a view that a reload brings back.
                    if kind == COREWEBVIEW2_PROCESS_FAILED_KIND_RENDER_PROCESS_EXITED {
                        core.Reload()?;
                    }
                    Ok(())
                })),
                &mut token,
            )
        })()
    };
    if let Err(error) = result {
        eprintln!("[Pake] Failed to watch for a WebView2 renderer crash: {error}");
    }
}

/// A self-contained page for a load that failed: what happened, the site, one way back.
#[cfg(any(target_os = "linux", test))]
pub(crate) fn error_page(host: &str, chinese: bool) -> String {
    let (title, hint, retry) = if chinese {
        ("无法打开此页面", "检查网络后再试一次", "重试")
    } else {
        (
            "Can't open this page",
            "Check your network, then try again.",
            "Try Again",
        )
    };
    let host = host
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;");
    format!(
        r#"<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{title}</title><style>
html,body{{height:100%;margin:0}}
body{{display:flex;align-items:center;justify-content:center;font:14px/1.5 system-ui,-apple-system,"Segoe UI","Noto Sans CJK SC",sans-serif;background:#fff;color:#1d1d1f}}
main{{text-align:center;padding:24px;max-width:420px}}
h1{{font-size:20px;font-weight:600;margin:0 0 6px}}
p{{margin:0;color:#6e6e73}}
.host{{margin-top:2px;word-break:break-all}}
button{{margin-top:20px;font:inherit;padding:7px 18px;border-radius:8px;border:0;background:#1d1d1f;color:#fff;cursor:pointer}}
@media (prefers-color-scheme:dark){{body{{background:#1c1c1e;color:#f5f5f7}}p{{color:#98989d}}button{{background:#f5f5f7;color:#1c1c1e}}}}
</style></head><body><main><h1>{title}</h1><p>{hint}</p><p class="host">{host}</p><button onclick="location.reload()">{retry}</button></main></body></html>"#
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_error_page_names_the_site_and_offers_one_way_back() {
        let page = error_page("example.com", false);
        assert!(page.contains("Can't open this page"));
        assert!(page.contains(r#"<p class="host">example.com</p>"#));
        assert_eq!(page.matches("<button").count(), 1);
        assert!(page.contains("location.reload()"));
        assert!(error_page("example.com", true).contains("无法打开此页面"));
    }

    #[test]
    fn a_host_cannot_inject_markup_into_the_error_page() {
        let page = error_page("<script>alert(1)</script>", false);
        assert!(!page.contains("<script>"));
        assert!(page.contains("&lt;script&gt;"));
    }
}
