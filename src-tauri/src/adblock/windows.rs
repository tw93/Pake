use super::{
    rules::{classify, Decision},
    state::AdblockSession,
};
use tauri::WebviewWindow;
use webview2_com::{
    take_pwstr,
    Microsoft::Web::WebView2::Win32::{
        ICoreWebView2WebResourceRequestedEventArgs, COREWEBVIEW2_WEB_RESOURCE_CONTEXT_ALL,
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
    webview.AddWebResourceRequestedFilter(&filter, COREWEBVIEW2_WEB_RESOURCE_CONTEXT_ALL)?;

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
            let response = environment.CreateWebResourceResponse(None, 204, &status, &headers)?;
            args.SetResponse(&response)
        },
    ));

    let mut token = 0;
    webview.add_WebResourceRequested(&handler, &mut token)?;
    Ok(())
}
