use tauri_utils::config::{Config, WindowConfig};
use wry::application::{
    event::{Event, StartCause, WindowEvent},
    event_loop::{ControlFlow, EventLoop},
    menu::MenuType,
    window::Fullscreen,
};

mod menus_builder;
mod webview_builder;
mod window_builder;

fn main() -> wry::Result<()> {
    // --------------------------------------------------------
    // 获取 tauri.conf.json 配置
    // --------------------------------------------------------
    let window_config = get_windows_config().unwrap_or(WindowConfig::default());

    // --------------------------------------------------------
    // 创建 window
    // --------------------------------------------------------
    let event_loop = EventLoop::new();

    let (menu_bar_menu, custome_menu_map) =
        menus_builder::get_menus_with_platform_spec(&window_config);

    // 平台单独的配置在这个方法里, 公用的在下面
    let window_builder =
        window_builder::get_windows_builder_with_platform_spec_setting(&window_config);

    // 通用的配置在这里, 平台单独的配置在方法里
    let window = window_builder
        .with_resizable(window_config.resizable)
        .with_fullscreen(if window_config.fullscreen {
            Some(Fullscreen::Borderless(None))
        } else {
            None
        })
        .with_menu(menu_bar_menu)
        .with_inner_size(wry::application::dpi::LogicalSize::new(
            window_config.width,
            window_config.height,
        ))
        .build(&event_loop)
        .unwrap();

    // --------------------------------------------------------
    // 处理 webview
    // --------------------------------------------------------
    let webview = webview_builder::get_webview(&window_config, window);

    // webview.open_devtools();
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
                // --------------------------------------------------------
                // 处理 自定义菜单
                // --------------------------------------------------------
                if custome_menu_map.is(menus_builder::CustomeMenuKind::CLOSE, &menu_id) {
                    webview.window().set_minimized(true);
                }
                println!("Clicked on {:?}", menu_id);
            }
            _ => (),
        }
    });
}

/**
 * --------------------------------------------------------
 * 获取 tauri.config.json 配置
 * --------------------------------------------------------
 */
fn get_windows_config() -> Option<WindowConfig> {
    let config_file = include_str!("../tauri.conf.json");
    let config: Config = serde_json::from_str(config_file).expect("failed to parse windows config");

    config.tauri.windows.iter().next().cloned()
}
