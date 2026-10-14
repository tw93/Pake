// Run on a Windows desktop with node tests/integration/windows-native-download.mjs.
use super::*;
use std::{
    io::{Read, Write},
    net::TcpListener,
    sync::{
        atomic::{AtomicBool, AtomicUsize},
        Arc, Mutex,
    },
    time::{Duration, Instant},
};
use webview2_com::{
    BytesReceivedChangedEventHandler, DownloadStartingEventHandler,
    Microsoft::Web::WebView2::Win32::{
        ICoreWebView2_4, ICoreWebView2_9, COREWEBVIEW2_DOWNLOAD_STATE,
        COREWEBVIEW2_DOWNLOAD_STATE_COMPLETED,
    },
    StateChangedEventHandler,
};
use windows_core::{Interface, BOOL};

#[test]
#[ignore = "requires an interactive Windows desktop and WebView2 Runtime"]
#[allow(deprecated)]
fn native_windows_download() {
    let root = std::env::temp_dir().join(format!("pake-native-download-{}", std::process::id()));
    let downloads = root.join("downloads");
    std::fs::create_dir_all(&downloads).unwrap();
    std::fs::write(downloads.join("server.pdf"), b"existing-file").unwrap();
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    listener.set_nonblocking(true).unwrap();
    let origin = format!("http://{}", listener.local_addr().unwrap());
    let stopping = Arc::new(AtomicBool::new(false));
    let stop_server = stopping.clone();
    let requests = Arc::new(Mutex::new(Vec::new()));
    let received_requests = requests.clone();
    let server = std::thread::spawn(move || {
        let mut handlers = Vec::new();
        while !stop_server.load(Ordering::Relaxed) {
            let Ok((mut stream, _)) = listener.accept() else {
                std::thread::sleep(Duration::from_millis(10));
                continue;
            };
            let requests = received_requests.clone();
            handlers.push(std::thread::spawn(move || {
                stream.set_read_timeout(Some(Duration::from_secs(3))).unwrap();
                let mut buffer = [0; 8192];
                let size = stream.read(&mut buffer).unwrap_or(0);
                let request = String::from_utf8_lossy(&buffer[..size]).to_string();
                let path = request.split_whitespace().nth(1).unwrap_or("/");
                if path.starts_with("/file") || path.starts_with("/attachment") {
                    requests.lock().unwrap().push(request.clone());
                    let filename = if path.starts_with("/attachment") { "attachment.bin" } else { "server.pdf" };
                    let header = format!("HTTP/1.1 200 OK\r\nContent-Type: application/octet-stream\r\nContent-Disposition: attachment; filename={filename}\r\nContent-Length: 1048576\r\nConnection: close\r\n\r\n");
                    if stream.write_all(header.as_bytes()).is_err() { return; }
                    for _ in 0..32 {
                        if stream.write_all(&[b'N'; 32768]).is_err() { return; }
                        std::thread::sleep(Duration::from_millis(80));
                    }
                } else {
                    let script = if path.starts_with("/blob") {
                        "const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob(['native-blob-proof'],{type:'text/plain'})); a.download='blob.txt'; document.body.append(a); a.click();"
                    } else {
                        "const a=document.createElement('a'); a.href='/file'; a.download='report.pdf'; document.body.append(a); a.click();"
                    };
                    let body = format!("<!doctype html><meta charset=utf-8><title>Native download probe</title><body>Native download probe<script>setTimeout(()=>{{{script}}},1200)</script></body>");
                    let header = format!("HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nSet-Cookie: probe=native; HttpOnly; Path=/\r\nContent-Length: {}\r\nConnection: close\r\n\r\n", body.len());
                    let _ = stream.write_all(header.as_bytes());
                    let _ = stream.write_all(body.as_bytes());
                }
            }));
        }
        for handler in handlers {
            handler.join().unwrap();
        }
    });
    let mut context = tauri::generate_context!();
    context.config_mut().identifier = format!("com.pake.download-probe-{}", std::process::id());
    context.config_mut().product_name = Some(format!("PakeDownloadProbe-{}", std::process::id()));
    let mut config: PakeConfig = serde_json::from_str(include_str!("../../pake.json")).unwrap();
    config.download_dir = downloads.to_string_lossy().into_owned();
    config.windows[0].url_type = "web".into();
    config.windows[0].url = origin.clone();
    config.windows[0].incognito = false;
    let tauri_config = context.config().clone();
    let mut app = tauri::Builder::default()
        .any_thread()
        .manage(MultiWindowState::new(config.clone(), tauri_config.clone()))
        .build(context)
        .unwrap();
    app.run_iteration(|_, _| {});
    let starts = Arc::new(AtomicUsize::new(0));
    let completions = Arc::new(AtomicUsize::new(0));
    let progress = Arc::new(AtomicUsize::new(0));
    let panel_open = Arc::new(AtomicBool::new(false));
    let valid_args = Arc::new(AtomicBool::new(true));
    let mut windows = Vec::new();
    for (label, route) in [
        ("pake", "/"),
        ("pake-1", "/blob"),
        ("pake-2", "/attachment"),
    ] {
        let target = format!("{origin}{route}");
        let window = build_window(
            app.handle(),
            &config,
            &tauri_config,
            WindowBuildOptions {
                label,
                url: WebviewUrl::App(PathBuf::from(target)),
                visible: false,
                new_window_features: None,
            },
        )
        .unwrap();
        reveal_built_window(&window);
        let starts = starts.clone();
        let completions = completions.clone();
        let progress = progress.clone();
        let valid_args = valid_args.clone();
        let expected_dir = downloads.clone();
        window
            .with_webview(move |webview| unsafe {
                let core = webview.controller().CoreWebView2().unwrap();
                let mut token = 0;
                core.cast::<ICoreWebView2_4>()
                    .unwrap()
                    .add_DownloadStarting(
                        &DownloadStartingEventHandler::create(Box::new(move |_, args| {
                            let args = args.unwrap();
                            let mut handled = BOOL::default();
                            let mut cancelled = BOOL::default();
                            args.Handled(&mut handled)?;
                            args.Cancel(&mut cancelled)?;
                            let mut path = windows_core::PWSTR::null();
                            args.ResultFilePath(&mut path)?;
                            let path = PathBuf::from(webview2_com::take_pwstr(path));
                            if handled.as_bool()
                                || cancelled.as_bool()
                                || path.parent() != Some(expected_dir.as_path())
                            {
                                valid_args.store(false, Ordering::Relaxed);
                            }
                            starts.fetch_add(1, Ordering::Relaxed);
                            let operation = args.DownloadOperation()?;
                            let progress = progress.clone();
                            operation.add_BytesReceivedChanged(
                                &BytesReceivedChangedEventHandler::create(Box::new(move |_, _| {
                                    progress.fetch_add(1, Ordering::Relaxed);
                                    Ok(())
                                })),
                                &mut 0,
                            )?;
                            let completions = completions.clone();
                            operation.add_StateChanged(
                                &StateChangedEventHandler::create(Box::new(move |operation, _| {
                                    let mut state = COREWEBVIEW2_DOWNLOAD_STATE::default();
                                    operation.unwrap().State(&mut state)?;
                                    if state == COREWEBVIEW2_DOWNLOAD_STATE_COMPLETED {
                                        completions.fetch_add(1, Ordering::Relaxed);
                                    }
                                    Ok(())
                                })),
                                &mut 0,
                            )?;
                            Ok(())
                        })),
                        &mut token,
                    )
                    .unwrap();
            })
            .unwrap();
        windows.push(window);
    }
    let deadline = Instant::now() + Duration::from_secs(35);
    while Instant::now() < deadline && completions.load(Ordering::Relaxed) < 3 {
        app.run_iteration(|_, _| {});
        for window in &windows {
            let open = panel_open.clone();
            window
                .with_webview(move |webview| unsafe {
                    let core = webview.controller().CoreWebView2().unwrap();
                    let mut visible = BOOL::default();
                    core.cast::<ICoreWebView2_9>()
                        .unwrap()
                        .IsDefaultDownloadDialogOpen(&mut visible)
                        .unwrap();
                    if visible.as_bool() {
                        open.store(true, Ordering::Relaxed);
                    }
                })
                .unwrap();
        }
        std::thread::sleep(Duration::from_millis(40));
    }
    for window in &windows {
        window.destroy().unwrap();
    }
    app.cleanup_before_exit();
    stopping.store(true, Ordering::Relaxed);
    server.join().unwrap();
    eprintln!("Native WebView2: starts={}, completed={}, progress_events={}, default_panel_open={}, destinations_valid={}; artifacts={}",
        starts.load(Ordering::Relaxed), completions.load(Ordering::Relaxed), progress.load(Ordering::Relaxed), panel_open.load(Ordering::Relaxed), valid_args.load(Ordering::Relaxed), root.display());
    assert_eq!(starts.load(Ordering::Relaxed), 3);
    assert_eq!(completions.load(Ordering::Relaxed), 3);
    assert!(progress.load(Ordering::Relaxed) > 0);
    assert!(panel_open.load(Ordering::Relaxed));
    assert!(valid_args.load(Ordering::Relaxed));
    assert_eq!(
        std::fs::read(downloads.join("server.pdf")).unwrap(),
        b"existing-file"
    );
    assert_eq!(
        std::fs::read(downloads.join("server-1.pdf")).unwrap(),
        vec![b'N'; 1048576]
    );
    assert_eq!(
        std::fs::read(downloads.join("attachment.bin")).unwrap(),
        vec![b'N'; 1048576]
    );
    assert_eq!(
        std::fs::read(downloads.join("blob.txt")).unwrap(),
        b"native-blob-proof"
    );
    let requests = requests.lock().unwrap();
    let file = requests
        .iter()
        .find(|request| request.starts_with("GET /file "))
        .unwrap()
        .to_lowercase();
    assert!(file.contains("cookie: probe=native"));
    assert!(file.contains(&format!("referer: {origin}/")));
}
