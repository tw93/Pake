use crate::app::config::PakeConfig;
use crate::util::get_data_dir;
use std::{path::PathBuf, str::FromStr, sync::Mutex};
use tauri::{
    webview::{NewWindowFeatures, NewWindowResponse},
    AppHandle, Config, Manager, Url, WebviewUrl, WebviewWindow, WebviewWindowBuilder,
};

#[cfg(target_os = "macos")]
use tauri::{Theme, TitleBarStyle};

#[cfg(target_os = "windows")]
fn build_proxy_browser_arg(url: &Url) -> Option<String> {
    let host = url.host_str()?;
    let scheme = url.scheme();
    let port = url.port().or_else(|| match scheme {
        "http" => Some(80),
        "socks5" => Some(1080),
        _ => None,
    })?;

    match scheme {
        "http" | "socks5" => Some(format!("--proxy-server={scheme}://{host}:{port}")),
        _ => None,
    }
}

pub struct MultiWindowState {
    pub pake_config: PakeConfig,
    pub tauri_config: Config,
    next_window_index: Mutex<u32>,
}

impl MultiWindowState {
    pub fn new(pake_config: PakeConfig, tauri_config: Config) -> Self {
        Self {
            pake_config,
            tauri_config,
            next_window_index: Mutex::new(0),
        }
    }

    fn next_window_label(&self) -> String {
        let mut index = self.next_window_index.lock().unwrap();
        *index += 1;
        format!("pake-{}", *index)
    }
}

pub fn set_window(app: &AppHandle, config: &PakeConfig, tauri_config: &Config) -> WebviewWindow {
    build_window_with_label(app, config, tauri_config, "pake").expect("Failed to build window")
}

pub fn open_additional_window(app: &AppHandle) -> tauri::Result<WebviewWindow> {
    let state = app.state::<MultiWindowState>();
    let label = state.next_window_label();
    build_window_with_label(app, &state.pake_config, &state.tauri_config, &label)
}

struct WindowBuildOptions<'a> {
    label: &'a str,
    url: WebviewUrl,
    visible: bool,
    new_window_features: Option<NewWindowFeatures>,
}

fn open_requested_window(
    app: &AppHandle,
    config: &PakeConfig,
    tauri_config: &Config,
    target_url: Url,
    features: NewWindowFeatures,
) -> tauri::Result<WebviewWindow> {
    let state = app.state::<MultiWindowState>();
    let label = state.next_window_label();
    let window = build_window(
        app,
        config,
        tauri_config,
        WindowBuildOptions {
            label: &label,
            url: WebviewUrl::External("about:blank".parse().unwrap()),
            visible: true,
            new_window_features: Some(features),
        },
    )?;

    let title = target_url.host_str().unwrap_or(target_url.as_str());
    let _ = window.set_title(title);
    let _ = window.set_focus();

    Ok(window)
}

pub fn open_additional_window_safe(app: &AppHandle) {
    #[cfg(target_os = "windows")]
    {
        let app_handle = app.clone();
        std::thread::spawn(move || {
            if let Ok(window) = open_additional_window(&app_handle) {
                let _ = window.show();
                let _ = window.set_focus();
            }
        });
    }

    #[cfg(not(target_os = "windows"))]
    {
        if let Ok(window) = open_additional_window(app) {
            let _ = window.show();
            let _ = window.set_focus();
        }
    }
}

fn build_window_with_label(
    app: &AppHandle,
    config: &PakeConfig,
    tauri_config: &Config,
    label: &str,
) -> tauri::Result<WebviewWindow> {
    let window_config = config
        .windows
        .first()
        .expect("At least one window configuration is required");
    let url = match window_config.url_type.as_str() {
        "web" => WebviewUrl::App(window_config.url.parse().unwrap()),
        "local" => WebviewUrl::App(PathBuf::from(&window_config.url)),
        _ => panic!("url type can only be web or local"),
    };

    build_window(
        app,
        config,
        tauri_config,
        WindowBuildOptions {
            label,
            url,
            visible: false,
            new_window_features: None,
        },
    )
}

fn build_window(
    app: &AppHandle,
    config: &PakeConfig,
    tauri_config: &Config,
    opts: WindowBuildOptions,
) -> tauri::Result<WebviewWindow> {
    let WindowBuildOptions {
        label,
        url,
        visible,
        new_window_features,
    } = opts;
    let package_name = tauri_config.clone().product_name.unwrap();
    let _data_dir = get_data_dir(app, package_name);

    let window_config = config
        .windows
        .first()
        .expect("At least one window configuration is required");

    let user_agent = config.user_agent.get();

    let config_script = format!(
        "window.pakeConfig = {}",
        serde_json::to_string(&window_config).unwrap()
    );

    // Platform-specific title: macOS prefers empty, others fallback to product name
    let effective_title = window_config.title.as_deref().unwrap_or_else(|| {
        if cfg!(target_os = "macos") {
            ""
        } else {
            tauri_config.product_name.as_deref().unwrap_or("")
        }
    });

    let mut window_builder = WebviewWindowBuilder::new(app, label, url)
        .title(effective_title)
        .visible(visible)
        .user_agent(user_agent)
        .resizable(window_config.resizable)
        .maximized(window_config.maximize);

    #[cfg(target_os = "windows")]
    {
        let scale_factor = app
            .primary_monitor()
            .ok()
            .flatten()
            .map(|m| m.scale_factor())
            .unwrap_or(1.0);
        let logical_width = window_config.width / scale_factor;
        let logical_height = window_config.height / scale_factor;
        window_builder = window_builder.inner_size(logical_width, logical_height);
    }

    #[cfg(not(target_os = "windows"))]
    {
        window_builder = window_builder.inner_size(window_config.width, window_config.height);
    }

    window_builder = window_builder
        .always_on_top(window_config.always_on_top)
        .incognito(window_config.incognito);

    #[cfg(any(target_os = "windows", target_os = "macos"))]
    {
        window_builder = window_builder.fullscreen(window_config.fullscreen);
    }

    if window_config.min_width > 0.0 || window_config.min_height > 0.0 {
        let min_w = if window_config.min_width > 0.0 {
            window_config.min_width
        } else {
            window_config.width
        };
        let min_h = if window_config.min_height > 0.0 {
            window_config.min_height
        } else {
            window_config.height
        };
        window_builder = window_builder.min_inner_size(min_w, min_h);
    }

    if !window_config.enable_drag_drop {
        window_builder = window_builder.disable_drag_drop_handler();
    }

    if window_config.new_window {
        let app_handle = app.clone();
        let popup_config = config.clone();
        let popup_tauri_config = tauri_config.clone();
        window_builder = window_builder.on_new_window(move |target_url, features| {
            match open_requested_window(
                &app_handle,
                &popup_config,
                &popup_tauri_config,
                target_url,
                features,
            ) {
                Ok(window) => NewWindowResponse::Create { window },
                Err(error) => {
                    eprintln!("[Pake] Failed to open requested window: {error}");
                    NewWindowResponse::Deny
                }
            }
        });
    }

    // Add initialization scripts
    window_builder = window_builder
        .initialization_script(&config_script)
        .initialization_script(include_str!("../inject/component.js"))
        .initialization_script(include_str!("../inject/event.js"))
        .initialization_script(include_str!("../inject/style.js"))
        .initialization_script(include_str!("../inject/theme_refresh.js"))
        .initialization_script(include_str!("../inject/auth.js"))
        .initialization_script(include_str!("../inject/custom.js"));

    #[cfg(target_os = "windows")]
    let mut windows_browser_args = String::from("--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection --disable-blink-features=AutomationControlled");

    #[cfg(target_os = "linux")]
    let mut linux_browser_args = String::from("--disable-blink-features=AutomationControlled");

    if window_config.ignore_certificate_errors {
        #[cfg(target_os = "windows")]
        {
            windows_browser_args.push_str(" --ignore-certificate-errors");
        }

        #[cfg(target_os = "linux")]
        {
            linux_browser_args.push_str(" --ignore-certificate-errors");
        }

        #[cfg(target_os = "macos")]
        {
            window_builder = window_builder.additional_browser_args("--ignore-certificate-errors");
        }
    }

    if window_config.enable_wasm {
        #[cfg(target_os = "windows")]
        {
            windows_browser_args.push_str(" --enable-features=SharedArrayBuffer");
            windows_browser_args.push_str(" --enable-unsafe-webgpu");
        }

        #[cfg(target_os = "linux")]
        {
            linux_browser_args.push_str(" --enable-features=SharedArrayBuffer");
            linux_browser_args.push_str(" --enable-unsafe-webgpu");
        }

        #[cfg(target_os = "macos")]
        {
            window_builder = window_builder
                .additional_browser_args("--enable-features=SharedArrayBuffer")
                .additional_browser_args("--enable-unsafe-webgpu");
        }
    }

    let mut parsed_proxy_url: Option<Url> = None;

    // Platform-specific configuration must be set before proxy on Windows/Linux
    #[cfg(target_os = "macos")]
    {
        let title_bar_style = if window_config.hide_title_bar {
            TitleBarStyle::Overlay
        } else {
            TitleBarStyle::Visible
        };
        window_builder = window_builder.title_bar_style(title_bar_style);

        // Default to following system theme (None), only force dark when explicitly set
        let theme = if window_config.dark_mode {
            Some(Theme::Dark)
        } else {
            None // Follow system theme
        };
        window_builder = window_builder.theme(theme);
    }

    // Windows and Linux: set data_directory before proxy_url
    #[cfg(not(target_os = "macos"))]
    {
        window_builder = window_builder.data_directory(_data_dir).theme(None);

        if !config.proxy_url.is_empty() {
            if let Ok(proxy_url) = Url::from_str(&config.proxy_url) {
                parsed_proxy_url = Some(proxy_url.clone());
                #[cfg(target_os = "windows")]
                {
                    if let Some(arg) = build_proxy_browser_arg(&proxy_url) {
                        windows_browser_args.push(' ');
                        windows_browser_args.push_str(&arg);
                    }
                }
            }
        }

        #[cfg(target_os = "windows")]
        {
            window_builder = window_builder.additional_browser_args(&windows_browser_args);
        }

        #[cfg(target_os = "linux")]
        {
            window_builder = window_builder.additional_browser_args(&linux_browser_args);
        }
    }

    // Set proxy after platform-specific configs (required for Windows/Linux)
    if parsed_proxy_url.is_none() && !config.proxy_url.is_empty() {
        if let Ok(proxy_url) = Url::from_str(&config.proxy_url) {
            parsed_proxy_url = Some(proxy_url);
        }
    }

    if let Some(proxy_url) = parsed_proxy_url {
        window_builder = window_builder.proxy_url(proxy_url);
        #[cfg(debug_assertions)]
        println!("Proxy configured: {}", config.proxy_url);
    }

    if let Some(features) = new_window_features {
        window_builder = window_builder.window_features(features).focused(true);
    }

    // Allow navigation to OAuth/authentication domains
    window_builder = window_builder.on_navigation(|url| {
        let url_str = url.as_str();

        // Always allow same-origin navigation
        if url_str.starts_with("http://localhost") || url_str.starts_with("http://127.0.0.1") {
            return true;
        }

        // Check for OAuth/authentication domains
        let auth_patterns = [
            "accounts.google.com",
            "login.microsoftonline.com",
            "github.com/login",
            "appleid.apple.com",
            "facebook.com",
            "twitter.com",
        ];

        let auth_paths = ["/oauth/", "/auth/", "/authorize", "/login"];

        // Allow if matches auth patterns
        for pattern in &auth_patterns {
            if url_str.contains(pattern) {
                #[cfg(debug_assertions)]
                println!("Allowing OAuth navigation to: {}", url_str);
                return true;
            }
        }

        for path in &auth_paths {
            if url_str.contains(path) {
                #[cfg(debug_assertions)]
                println!("Allowing auth path navigation to: {}", url_str);
                return true;
            }
        }

        // Allow all other navigation by default
        true
    });

    window_builder.build()
}
