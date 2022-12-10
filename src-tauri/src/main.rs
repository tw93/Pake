// at the top of main.rs - that will prevent the console from showing
#![windows_subsystem = "windows"]
extern crate image;
use tauri_utils::config::{Config, WindowConfig};
use wry::{
    application::{
        event::{Event, StartCause, WindowEvent},
        event_loop::{ControlFlow, EventLoop},
        menu::MenuType,
        window::{Fullscreen, Window, WindowBuilder},
    },
    webview::WebViewBuilder,
};


#[cfg(target_os = "macos")]
use wry::{
    application::{
        accelerator::{Accelerator, SysMods},
        keyboard::KeyCode,
        menu::{MenuBar as Menu, MenuItem, MenuItemAttributes},
        platform::macos::WindowBuilderExtMacOS,
    },
};

#[cfg(target_os = "windows")]
use wry::window::Icon;

#[cfg(target_os = "linux")]
use wry::webview::WebContext;



fn main() -> wry::Result<()> {
    #[cfg(target_os = "macos")]
    let mut menu_bar_menu = Menu::new();
    #[cfg(target_os = "macos")]
    let mut first_menu = Menu::new();
    #[cfg(target_os = "macos")]
    first_menu.add_native_item(MenuItem::Hide);
    #[cfg(target_os = "macos")]
    first_menu.add_native_item(MenuItem::EnterFullScreen);
    #[cfg(target_os = "macos")]
    first_menu.add_native_item(MenuItem::Minimize);
    #[cfg(target_os = "macos")]
    first_menu.add_native_item(MenuItem::Separator);
    #[cfg(target_os = "macos")]
    first_menu.add_native_item(MenuItem::Copy);
    #[cfg(target_os = "macos")]
    first_menu.add_native_item(MenuItem::Cut);
    #[cfg(target_os = "macos")]
    first_menu.add_native_item(MenuItem::Paste);
    #[cfg(target_os = "macos")]
    first_menu.add_native_item(MenuItem::Undo);
    #[cfg(target_os = "macos")]
    first_menu.add_native_item(MenuItem::Redo);
    #[cfg(target_os = "macos")]
    first_menu.add_native_item(MenuItem::SelectAll);
    #[cfg(target_os = "macos")]
    first_menu.add_native_item(MenuItem::Separator);

    #[cfg(target_os = "macos")]
    let close_item = first_menu.add_item(
        MenuItemAttributes::new("CloseWindow")
            .with_accelerators(&Accelerator::new(SysMods::Cmd, KeyCode::KeyW)),
    );

    #[cfg(target_os = "macos")]
    first_menu.add_native_item(MenuItem::Quit);

    #[cfg(target_os = "macos")]
    menu_bar_menu.add_submenu("App", true, first_menu);
    #[cfg(any(target_os = "linux", target_os = "windows"))]
    let (package_name, windows_config) = get_windows_config();
    #[cfg(any(target_os = "linux", target_os = "windows"))]
    let package_name = package_name
        .expect("can't get package name in config file")
        .to_lowercase();

    #[cfg(any(target_os = "linux", target_os = "windows"))]
    let WindowConfig {
        url,
        width,
        height,
        resizable,
        fullscreen,
        ..
    } = windows_config.unwrap_or_default();

    #[cfg(target_os = "macos")]
    let WindowConfig {
        url,
        width,
        height,
        resizable,
        transparent,
        fullscreen,
        ..
    } = get_windows_config().1.unwrap_or_default();
    let event_loop = EventLoop::new();

    let common_window = WindowBuilder::new()
        .with_title("")
        .with_resizable(resizable)
        .with_fullscreen(if fullscreen {
            Some(Fullscreen::Borderless(None))
        } else {
            None
        })
        .with_inner_size(wry::application::dpi::LogicalSize::new(width, height));
    #[cfg(target_os = "windows")]
    let icon_path = format!("png/{}_32.ico", package_name);
    #[cfg(target_os = "windows")]
    let icon = load_icon(std::path::Path::new(&icon_path));
    #[cfg(target_os = "windows")]
    let window = common_window
        .with_decorations(true)
        .with_window_icon(Some(icon))
        .build(&event_loop)
        .unwrap();

    #[cfg(target_os = "linux")]
    let window = common_window
        .build(&event_loop)
        .unwrap();

    #[cfg(target_os = "macos")]
    let window = common_window
        .with_fullsize_content_view(true)
        .with_titlebar_buttons_hidden(false)
        .with_titlebar_transparent(transparent)
        .with_title_hidden(true)
        .with_menu(menu_bar_menu)
        .build(&event_loop)
        .unwrap();

    let handler = move |window: &Window, req: String| {
        if req == "drag_window" {
            let _ = window.drag_window();
        } else if req == "fullscreen" {
            if window.fullscreen().is_some() {
                window.set_fullscreen(None);
            } else {
                window.set_fullscreen(Some(Fullscreen::Borderless(None)));
            }
        } else if req.starts_with("open_browser") {
            let href = req.replace("open_browser:", "");
            webbrowser::open(&href).expect("no browser");
        }
    };

    // 用于欺骗部分页面对于浏览器的强检测

    // #[cfg(target_os = "macos")]
    // let user_agent_string = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.1 Safari/605.1.15";

    #[cfg(target_os = "macos")]
    let webview = WebViewBuilder::new(window)?
        // .with_user_agent(user_agent_string)
        .with_url(&url.to_string())?
        .with_devtools(cfg!(feature = "devtools"))
        .with_initialization_script(include_str!("pake.js"))
        .with_ipc_handler(handler)
        .with_back_forward_navigation_gestures(true)
        .build()?;

    #[cfg(target_os = "windows")]
    let webview = WebViewBuilder::new(window)?
        // .with_user_agent(user_agent_string)
        // .with_accept_first_mouse(true)
        .with_url(&url.to_string())?
        .with_devtools(cfg!(feature = "devtools"))
        .with_initialization_script(include_str!("pake.js"))
        .with_ipc_handler(handler)
        .build()?;
    // 自定义cookie文件夹，仅用于Linux
    // Custom Cookie folder, only for Linux
    #[cfg(target_os = "linux")]
    let user = std::env::var_os("USER");
    #[cfg(target_os = "linux")]
    let config_path = match user {
        Some(v) => format!(
            "/home/{}/.config/{}",
            v.into_string().unwrap(),
            package_name,
        ),
        None => panic!("can't found any user")
    };
    #[cfg(target_os = "linux")]
    let data_path = std::path::PathBuf::from(&config_path);
    #[cfg(target_os = "linux")]
    if !std::path::Path::new(&data_path).exists() {
        std::fs::create_dir(&data_path)
            .unwrap_or_else(|_| panic!("can't create dir {}", &config_path));
    }
    #[cfg(target_os = "linux")]
    let mut web_content = WebContext::new(Some(data_path));
    #[cfg(target_os = "linux")]
    let webview = WebViewBuilder::new(window)?
        // .with_user_agent(user_agent_string)
        .with_url(&url.to_string())?
        .with_devtools(cfg!(feature = "devtools"))
        .with_initialization_script(include_str!("pake.js"))
        .with_ipc_handler(handler)
        .with_web_context(&mut web_content)
        .build()?;

    #[cfg(feature = "devtools")]
    {
        webview.open_devtools();
    }

    event_loop.run(move |event, _, control_flow| {
        *control_flow = ControlFlow::Wait;

        match event {
            Event::NewEvents(StartCause::Init) => println!("Wry has started!"),
            Event::WindowEvent {
                event: WindowEvent::CloseRequested,
                ..
            } => *control_flow = ControlFlow::Exit,
            Event::MenuEvent {
                menu_id,
                origin: MenuType::MenuBar,
                ..
            } => {
                #[cfg(target_os = "macos")]
                if menu_id == close_item.clone().id() {
                    webview.window().set_minimized(true);
                }
                println!("Clicked on {:?}", menu_id);
                println!("Clicked on {:?}", webview.window().is_visible());
            }
            _ => (),
        }
    });
}

fn get_windows_config() -> (Option<String>, Option<WindowConfig>) {
    let config_file = include_str!("../tauri.conf.json");
    let config: Config = serde_json::from_str(config_file).expect("failed to parse windows config");
    (
        config.package.product_name.clone(),
        config.tauri.windows.first().cloned(),
    )
}

#[cfg(target_os = "windows")]
fn load_icon(path: &std::path::Path) -> Icon {
    let (icon_rgba, icon_width, icon_height) = {
        // alternatively, you can embed the icon in the binary through `include_bytes!` macro and use `image::load_from_memory`
        let image = image::open(path)
            .expect("Failed to open icon path")
            .into_rgba8();
        let (width, height) = image.dimensions();
        let rgba = image.into_raw();
        (rgba, width, height)
    };
    Icon::from_rgba(icon_rgba, icon_width, icon_height).expect("Failed to open icon")
}
