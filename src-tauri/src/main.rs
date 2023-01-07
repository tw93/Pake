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
use wry::application::{
    accelerator::{Accelerator, SysMods},
    keyboard::KeyCode,
    menu::{MenuBar as Menu, MenuItem, MenuItemAttributes},
    platform::macos::WindowBuilderExtMacOS,
};

#[cfg(target_os = "windows")]
use wry::application::window::Icon;

#[cfg(any(target_os = "linux", target_os = "windows"))]
use wry::webview::WebContext;

fn main() -> wry::Result<()> {
    #[cfg(target_os = "macos")]
    let (menu_bar_menu, close_item) = {
        let mut menu_bar_menu = Menu::new();
        let mut first_menu = Menu::new();
        first_menu.add_native_item(MenuItem::Hide);
        first_menu.add_native_item(MenuItem::EnterFullScreen);
        first_menu.add_native_item(MenuItem::Minimize);
        first_menu.add_native_item(MenuItem::Separator);
        first_menu.add_native_item(MenuItem::Copy);
        first_menu.add_native_item(MenuItem::Cut);
        first_menu.add_native_item(MenuItem::Paste);
        first_menu.add_native_item(MenuItem::Undo);
        first_menu.add_native_item(MenuItem::Redo);
        first_menu.add_native_item(MenuItem::SelectAll);
        first_menu.add_native_item(MenuItem::Separator);
        let close_item = first_menu.add_item(
            MenuItemAttributes::new("CloseWindow")
                .with_accelerators(&Accelerator::new(SysMods::Cmd, KeyCode::KeyW)),
        );
        first_menu.add_native_item(MenuItem::Quit);
        menu_bar_menu.add_submenu("App", true, first_menu);
        (menu_bar_menu, close_item)
    };

    #[cfg(any(target_os = "linux", target_os = "windows"))]
    let (
        package_name,
        WindowConfig {
            url,
            width,
            height,
            resizable,
            fullscreen,
            ..
        },
    ) = {
        let (package_name, windows_config) = get_windows_config();
        (
            package_name
                .expect("can't get package name in config file")
                .to_lowercase(),
            windows_config.unwrap_or_default(),
        )
    };

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
    let window = {
        let icon_path = format!("png/{}_32.ico", package_name);
        // 假如没有设置，就使用默认的即可
        if !std::path::Path::new(&icon_path).exists() {
            icon_path = "png/icon_32.ico";
        }
        let icon = load_icon(std::path::Path::new(&icon_path));
        common_window
            .with_decorations(true)
            .with_window_icon(Some(icon))
            .build(&event_loop)
            .unwrap()
    };

    #[cfg(target_os = "linux")]
    let window = common_window.build(&event_loop).unwrap();

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

    #[cfg(target_os = "macos")]
    let webview = {
        let user_agent_string = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.1 Safari/605.1.15";
        WebViewBuilder::new(window)?
            .with_user_agent(user_agent_string)
            .with_url(&url.to_string())?
            .with_devtools(cfg!(feature = "devtools"))
            .with_initialization_script(include_str!("pake.js"))
            .with_ipc_handler(handler)
            .with_back_forward_navigation_gestures(true)
            .build()?
    };

    #[cfg(any(target_os = "linux", target_os = "windows"))]
    let webview = {
        let home_dir = match home::home_dir() {
            Some(path1) => path1,
            None => panic!("Error, can't found you home dir!!"),
        };
        #[cfg(target_os = "windows")]
        let data_dir = home_dir.join("AppData").join("Roaming").join(package_name);
        #[cfg(target_os = "linux")]
        let data_dir = home_dir.join(".config").join(package_name);
        if !data_dir.exists() {
            std::fs::create_dir(&data_dir)
                .unwrap_or_else(|_| panic!("can't create dir {}", data_dir.display()));
        }
        let mut web_content = WebContext::new(Some(data_dir));
        #[cfg(target_os = "windows")]
        let user_agent_string = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36";
        #[cfg(target_os = "linux")]
        let user_agent_string = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36";
        WebViewBuilder::new(window)?
            .with_user_agent(user_agent_string)
            .with_url(&url.to_string())?
            .with_devtools(cfg!(feature = "devtools"))
            .with_initialization_script(include_str!("pake.js"))
            .with_ipc_handler(handler)
            .with_web_context(&mut web_content)
            .build()?
    };
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
