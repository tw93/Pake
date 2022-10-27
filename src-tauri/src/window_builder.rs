use tauri_utils::config::WindowConfig;
use wry::application::window::WindowBuilder;

/**
 * --------------------------------------------------------
 * 获取 wry window_builder, 但各个平台的独立配置可以在这里写
 * --------------------------------------------------------
 */
#[cfg(target_os = "macos")]
pub fn get_windows_builder_with_platform_spec_setting(
    window_config: &WindowConfig,
) -> WindowBuilder {
    use wry::application::platform::macos::WindowBuilderExtMacOS;

    let window = WindowBuilder::new()
        .with_titlebar_transparent(window_config.transparent)
        .with_fullsize_content_view(true)
        .with_titlebar_buttons_hidden(false)
        .with_title_hidden(true);

    window
}

#[cfg(target_os = "windows")]
pub fn get_windows_builder(window_config: &WindowConfig) -> WindowBuilder {
    use wry::application::platform::windows::WindowBuilderExtWindows;

    let window = WindowBuilder::new().with_title("");

    window
}

#[cfg(target_os = "linux")]
pub fn get_windows_builder(window_config: &WindowConfig) -> WindowBuilder {
    let window = WindowBuilder::new();

    window
}
