use std::collections::HashMap;
use tauri_utils::config::WindowConfig;
use wry::application::{
    accelerator::{Accelerator, SysMods},
    keyboard::KeyCode,
    menu::{MenuBar as Menu, MenuId, MenuItem, MenuItemAttributes},
};

/**
 * --------------------------------------------------------
 * 配置各个系统的菜单, 因为各个系统的快捷键/菜单习惯不一样
 * --------------------------------------------------------
 */

#[derive(Debug, PartialEq, Eq, Hash)]
pub enum CustomeMenuKind {
    CLOSE,
}

pub struct CustomeMenuMap {
    map: HashMap<CustomeMenuKind, MenuId>,
}

impl CustomeMenuMap {
    pub fn is(&self, kind: CustomeMenuKind, menu_id: &MenuId) -> bool {
        let kind_menu = self.map.get(&kind);

        let is_eq = kind_menu.unwrap() == menu_id;

        is_eq
    }
}

#[cfg(target_os = "macos")]
pub fn get_menus_with_platform_spec(window_config: &WindowConfig) -> (Menu, CustomeMenuMap) {
    let mut menu_bar_menu = Menu::new();
    let mut first_menu = Menu::new();

    // --------------------------------------------------------
    // macOS 通用系统菜单
    // --------------------------------------------------------
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

    // --------------------------------------------------------
    // 添加自定义菜单 ⌘ + W , 事件处理在 eventloop 中, 将窗口 minimum
    // --------------------------------------------------------
    let close_item = first_menu.add_item(
        MenuItemAttributes::new("CloseWindow")
            .with_accelerators(&Accelerator::new(SysMods::Cmd, KeyCode::KeyW)),
    );

    // --------------------------------------------------------
    // Quit 添加到最后
    // --------------------------------------------------------
    first_menu.add_native_item(MenuItem::Quit);

    // --------------------------------------------------------
    // 组装菜单栏
    // --------------------------------------------------------
    menu_bar_menu.add_submenu(&window_config.title, true, first_menu);

    // --------------------------------------------------------
    // 组装自定义菜单的 map, 给外面用
    // --------------------------------------------------------
    let mut map = HashMap::new();

    map.insert(CustomeMenuKind::CLOSE, close_item.clone().id());

    let custome_menu_map = CustomeMenuMap { map };

    (menu_bar_menu, custome_menu_map)
}

#[cfg(target_os = "windows")]
pub fn get_menus_with_platform_spec(window_config: &WindowConfig) -> (Menu, CustomeMenuMap) {
    let mut menu_bar_menu = Menu::new();
    let mut first_menu = Menu::new();

    // --------------------------------------------------------
    // Windows 通用系统菜单
    // --------------------------------------------------------
    first_menu.add_native_item(MenuItem::Hide);
    first_menu.add_native_item(MenuItem::EnterFullScreen);
    first_menu.add_native_item(MenuItem::Minimize);
    first_menu.add_native_item(MenuItem::Separator);

    // --------------------------------------------------------
    // 添加自定义菜单 Ctrl + W , 事件处理在 eventloop 中, 将窗口 minimum
    // --------------------------------------------------------
    let close_item = first_menu.add_item(
        MenuItemAttributes::new("CloseWindow")
            .with_accelerators(&Accelerator::new(SysMods::Cmd, KeyCode::KeyW)),
    );

    // --------------------------------------------------------
    // Quit 添加到最后
    // --------------------------------------------------------
    first_menu.add_native_item(MenuItem::Quit);

    // --------------------------------------------------------
    // 组装菜单栏
    // --------------------------------------------------------
    menu_bar_menu.add_submenu(&window_config.title, true, first_menu);

    // --------------------------------------------------------
    // 组装自定义菜单的 map, 给外面用
    // --------------------------------------------------------
    let mut map = HashMap::new();

    map.insert(CustomeMenuKind::CLOSE, close_item.clone().id());

    let custome_menu_map = CustomeMenuMap { map };

    (menu_bar_menu, custome_menu_map)
}

#[cfg(target_os = "linux")]
pub fn get_menus_with_platform_spec(window_config: &WindowConfig) -> (Menu, CustomeMenuMap) {
    let mut menu_bar_menu = Menu::new();
    let mut first_menu = Menu::new();

    // --------------------------------------------------------
    // Windows 通用系统菜单
    // --------------------------------------------------------
    first_menu.add_native_item(MenuItem::Hide);
    first_menu.add_native_item(MenuItem::EnterFullScreen);
    first_menu.add_native_item(MenuItem::Minimize);
    first_menu.add_native_item(MenuItem::Separator);

    // --------------------------------------------------------
    // 添加自定义菜单 Ctrl + W , 事件处理在 eventloop 中, 将窗口 minimum
    // --------------------------------------------------------
    let close_item = first_menu.add_item(
        MenuItemAttributes::new("CloseWindow")
            .with_accelerators(&Accelerator::new(SysMods::Cmd, KeyCode::KeyW)),
    );

    // --------------------------------------------------------
    // Quit 添加到最后
    // --------------------------------------------------------
    first_menu.add_native_item(MenuItem::Quit);

    // --------------------------------------------------------
    // 组装菜单栏
    // --------------------------------------------------------
    menu_bar_menu.add_submenu(&window_config.title, true, first_menu);

    // --------------------------------------------------------
    // 组装自定义菜单的 map, 给外面用
    // --------------------------------------------------------
    let mut map = HashMap::new();

    map.insert(CustomeMenuKind::CLOSE, close_item.clone().id());

    let custome_menu_map = CustomeMenuMap { map };

    (menu_bar_menu, custome_menu_map)
}
