fn main() -> wry::Result<()> {
    use wry::{
        application::{
            accelerator::{Accelerator, SysMods},
            event::{Event, StartCause, WindowEvent},
            event_loop::{ControlFlow, EventLoop},
            keyboard::KeyCode,
            menu::{MenuBar as Menu, MenuItem, MenuItemAttributes, MenuType},
            platform::macos::WindowBuilderExtMacOS,
            window::{Window, WindowBuilder},
        },
        webview::WebViewBuilder,
    };

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

    let script = r#"
  (function () {
    window.addEventListener('DOMContentLoaded', (event) => {
      const style = document.createElement('style');
      style.innerHTML = `
        .panel.give_me .nav_view {
          top: 154px !important;
        }

        .drawing-board .toolbar .toolbar-action,
        .c-swiper-container,
        .download_entry,
        .lang, .copyright {
          display: none !important;
        }

        .container-with-note #home, .container-with-note #switcher{
          top: 30px;
        }

        .geist-page nav.dashboard_nav__PRmJv {
          padding-top:10px;
        }

        .geist-page .submenu button{
          margin-top:24px;
        }

        #pack-top-dom:active {
          cursor: grabbing;
          cursor: -webkit-grabbing;
        }

        #pack-top-dom{
          position:fixed;
          background:transparent;
          top:0;
          width:100%;
          height:30px;
          cursor: move;
          cursor: grab;
          cursor: -webkit-grab;
        }
      `;
      document.head.append(style);
      const topDom = document.createElement("div");
      topDom.id = "pack-top-dom"
      document.body.appendChild(topDom);

      const domEl = document.getElementById('pack-top-dom');

      domEl.addEventListener('mousedown', (e) => {
        if (e.buttons === 1 && e.detail !== 2) {
          window.ipc.postMessage('drag_window');
        }
      })

      domEl.addEventListener('touchstart', (e) => {
          window.ipc.postMessage('drag_window');
      })
    });
  })();
  "#;

    let event_loop = EventLoop::new();
    let window = WindowBuilder::new()
        .with_title("WeRead")
        .with_resizable(true)
        .with_titlebar_transparent(true)
        .with_fullsize_content_view(true)
        .with_titlebar_buttons_hidden(false)
        .with_title_hidden(true)
        .with_menu(menu_bar_menu)
        .with_inner_size(wry::application::dpi::LogicalSize::new(1200.00, 728.00))
        .build(&event_loop)
        .unwrap();

    let handler = move |window: &Window, req: String| {
        if req == "drag_window" {
            println!("drag_window on");
            let _ = window.drag_window();
        }
    };

    let _webview = WebViewBuilder::new(window)?
        .with_url("https://weread.qq.com/")?
        // .with_devtools(true)
        .with_initialization_script(script)
        .with_ipc_handler(handler)
        .build()?;

    // _webview.open_devtools();
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
                if menu_id == close_item.clone().id() {
                    _webview.window().set_minimized(true);
                }
                println!("Clicked on {:?}", menu_id);
            }
            _ => (),
        }
    });
}
