use crate::error::{PackagerError, Result};
use image::ImageFormat;
use std::path::{Path, PathBuf};
use tracing::{info, warn};

/// Resolve an icon path: use provided path, or auto-fetch from the target URL.
pub async fn resolve_icon(
    target_url: &str,
    explicit_icon: Option<&Path>,
    work_dir: &Path,
) -> Result<PathBuf> {
    if let Some(icon) = explicit_icon {
        if icon.exists() {
            return Ok(icon.to_path_buf());
        }
        return Err(PackagerError::IconFetch(format!(
            "icon file not found: {}",
            icon.display()
        )));
    }

    info!("fetching favicon from {target_url}");
    match fetch_favicon(target_url).await {
        Ok(bytes) => {
            let png_path = work_dir.join("icon.png");
            std::fs::create_dir_all(work_dir)?;
            save_icon_png(&bytes, &png_path)?;
            Ok(png_path)
        }
        Err(e) => {
            warn!("favicon fetch failed ({e}), using default icon");
            let default = work_dir.join("icon.png");
            std::fs::create_dir_all(work_dir)?;
            write_default_icon(&default)?;
            Ok(default)
        }
    }
}

async fn fetch_favicon(target_url: &str) -> Result<Vec<u8>> {
    let parsed = url::Url::parse(target_url)
        .map_err(|e| PackagerError::IconFetch(e.to_string()))?;
    let origin = format!(
        "{}://{}",
        parsed.scheme(),
        parsed.host_str().unwrap_or("localhost")
    );

    let client = reqwest::Client::builder()
        .user_agent("WebPake/0.1 (+https://github.com/qiuxh016/Pake)")
        .build()
        .map_err(|e| PackagerError::IconFetch(e.to_string()))?;

    let candidates = [
        format!("{origin}/favicon.ico"),
        format!("{origin}/favicon.png"),
        format!("https://www.google.com/s2/favicons?domain={origin}&sz=128"),
    ];

    for candidate in candidates {
        if let Ok(response) = client.get(&candidate).send().await {
            if response.status().is_success() {
                if let Ok(bytes) = response.bytes().await {
                    if !bytes.is_empty() {
                        return Ok(bytes.to_vec());
                    }
                }
            }
        }
    }

    Err(PackagerError::IconFetch(
        "no favicon found at common paths".into(),
    ))
}

fn save_icon_png(bytes: &[u8], output: &Path) -> Result<()> {
    let img = image::load_from_memory(bytes)
        .map_err(|e| PackagerError::IconProcess(e.to_string()))?;
    let resized = img.resize_exact(512, 512, image::imageops::FilterType::Lanczos3);
    resized
        .save_with_format(output, ImageFormat::Png)
        .map_err(|e| PackagerError::IconProcess(e.to_string()))?;
    Ok(())
}

fn write_default_icon(output: &Path) -> Result<()> {
    let img = image::RgbaImage::from_fn(512, 512, |x, y| {
        let r = ((x as f32 / 512.0) * 255.0) as u8;
        let g = ((y as f32 / 512.0) * 255.0) as u8;
        image::Rgba([r, g, 180, 255])
    });
    img.save_with_format(output, ImageFormat::Png)
        .map_err(|e| PackagerError::IconProcess(e.to_string()))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_icon_is_written() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("icon.png");
        write_default_icon(&path).unwrap();
        assert!(path.exists());
    }
}
