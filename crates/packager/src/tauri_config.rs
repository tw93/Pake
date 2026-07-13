use crate::error::{PackagerError, Result};
use serde_json::{json, Value};
use std::fs::File;
use std::io::BufWriter;
use std::path::Path;
use webpake_core::AppConfig;

const BOOTSTRAP_JS: &str = include_str!("../../runtime/inject/bootstrap.js");

/// Generate `tauri.conf.json` content from an `AppConfig`.
pub fn generate_tauri_config(config: &AppConfig, version: &str) -> Value {
    let init_script = build_initialization_script(config);

    json!({
        "$schema": "https://schema.tauri.app/config/2",
        "productName": config.display_title(),
        "version": version,
        "identifier": config.identifier(),
        "build": {
            "beforeDevCommand": "",
            "beforeBuildCommand": "",
            "frontendDist": "../assets"
        },
        "app": {
            "withGlobalTauri": true,
            "windows": [
                {
                    "label": "main",
                    "title": config.display_title(),
                    "width": config.width,
                    "height": config.height,
                    "minWidth": config.min_width,
                    "minHeight": config.min_height,
                    "resizable": true,
                    "fullscreen": false,
                    "maximized": config.maximize,
                    "decorations": !config.hide_title_bar,
                    "url": config.url,
                    "initializationScript": init_script,
                    "userAgent": config.user_agent,
                }
            ],
            "security": {
                "csp": null
            }
        },
        "bundle": {
            "active": true,
            "targets": "all",
            "icon": [
                "icons/32x32.png",
                "icons/128x128.png",
                "icons/128x128@2x.png",
                "icons/icon.icns",
                "icons/icon.ico"
            ]
        }
    })
}

fn build_initialization_script(config: &AppConfig) -> String {
    let inject_config = json!({
        "customCss": config.inject.custom_css,
        "blockAds": config.inject.block_ads,
        "clipboardBridge": config.inject.clipboard_bridge,
        "inlineAuthPopups": config.inject.inline_auth_popups,
        "multiWindow": config.multi_window,
        "openExternalLinksInBrowser": config.open_external_links_in_browser,
        "homeUrl": config.url,
    });

    format!(
        "window.__WEBPAKE__ = {inject_config};\n{BOOTSTRAP_JS}"
    )
}

pub fn write_tauri_config(path: &Path, config: &AppConfig, version: &str) -> Result<()> {
    let value = generate_tauri_config(config, version);
    let content = serde_json::to_string_pretty(&value)?;
    std::fs::write(path, content)?;
    Ok(())
}

pub fn write_pake_config(path: &Path, config: &AppConfig) -> Result<()> {
    webpake_core::save_config(path, config)?;
    Ok(())
}

pub fn write_platform_configs(runtime_dir: &Path, config: &AppConfig) -> Result<()> {
    let windows = json!({
        "app": {
            "windows": [{
                "decorations": !config.hide_title_bar
            }]
        },
        "bundle": {
            "windows": {
                "webviewInstallMode": {
                    "type": "downloadBootstrapper"
                }
            }
        }
    });
    std::fs::write(
        runtime_dir.join("tauri.windows.conf.json"),
        serde_json::to_string_pretty(&windows)?,
    )?;

    let macos = json!({
        "app": {
            "windows": [{
                "titleBarStyle": if config.hide_title_bar { "Overlay" } else { "Visible" },
                "hiddenTitle": config.hide_title_bar
            }]
        }
    });
    std::fs::write(
        runtime_dir.join("tauri.macos.conf.json"),
        serde_json::to_string_pretty(&macos)?,
    )?;

    let linux = json!({
        "app": {
            "windows": [{
                "decorations": !config.hide_title_bar
            }]
        },
        "bundle": {
            "linux": {
                "appimage": {
                    "bundleMediaFramework": false
                }
            }
        }
    });
    std::fs::write(
        runtime_dir.join("tauri.linux.conf.json"),
        serde_json::to_string_pretty(&linux)?,
    )?;

    Ok(())
}

/// Install PNG/ICO/ICNS icons into the Tauri icons directory.
pub fn install_icons(source_png: &Path, icons_dir: &Path) -> Result<()> {
    std::fs::create_dir_all(icons_dir)?;

    let img = image::open(source_png)
        .map_err(|e| PackagerError::IconProcess(e.to_string()))?;

    let sizes = [32u32, 128, 256];
    for size in sizes {
        let resized = img.resize_exact(size, size, image::imageops::FilterType::Lanczos3);
        let name = if size == 256 {
            "128x128@2x.png".to_string()
        } else if size == 128 {
            "128x128.png".to_string()
        } else {
            format!("{size}x{size}.png")
        };
        let path = icons_dir.join(&name);
        resized
            .save(&path)
            .map_err(|e| PackagerError::IconProcess(e.to_string()))?;
    }

    write_ico(&img, &icons_dir.join("icon.ico"))?;
    write_icns(&img, &icons_dir.join("icon.icns"))?;

    Ok(())
}

fn write_ico(img: &image::DynamicImage, path: &Path) -> Result<()> {
    let mut icon_dir = ico::IconDir::new(ico::ResourceType::Icon);

    for size in [32u32, 128, 256] {
        let resized = img.resize_exact(size, size, image::imageops::FilterType::Lanczos3);
        let rgba = resized.to_rgba8();
        let icon_image = ico::IconImage::from_rgba_data(size, size, rgba.into_raw());
        let entry = ico::IconDirEntry::encode(&icon_image)
            .map_err(|e| PackagerError::IconProcess(e.to_string()))?;
        icon_dir.add_entry(entry);
    }

    let file = std::fs::File::create(path).map_err(PackagerError::Io)?;
    icon_dir
        .write(BufWriter::new(file))
        .map_err(|e| PackagerError::IconProcess(e.to_string()))?;
    Ok(())
}

fn write_icns(img: &image::DynamicImage, path: &Path) -> Result<()> {
    use icns::PixelFormat;

    let mut family = icns::IconFamily::new();

    for size in [16u32, 32, 128, 256, 512] {
        let resized = img.resize_exact(size, size, image::imageops::FilterType::Lanczos3);
        let rgba = resized.to_rgba8();
        let icon = icns::Image::from_data(PixelFormat::RGBA, size, size, rgba.into_raw())
            .map_err(|e| PackagerError::IconProcess(e.to_string()))?;
        let icon_type = icns::IconType::from_pixel_size(size, size)
            .ok_or_else(|| PackagerError::IconProcess(format!("unsupported icns size: {size}")))?;
        family
            .add_icon_with_type(&icon, icon_type)
            .map_err(|e| PackagerError::IconProcess(e.to_string()))?;
    }

    let file = File::create(path).map_err(PackagerError::Io)?;
    family
        .write(file)
        .map_err(|e| PackagerError::IconProcess(e.to_string()))?;
    Ok(())
}
