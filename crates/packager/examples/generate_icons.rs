//! Generate default placeholder icons for the runtime crate.
//!
//! Run: cargo run -p webpake-packager --example generate_icons

use std::path::PathBuf;
use webpake_packager::{install_icons, PackagerError};

fn main() -> Result<(), PackagerError> {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let runtime_dir = manifest_dir.parent().unwrap().join("runtime");
    let work_dir = runtime_dir.join(".webpake");
    let icon_path = work_dir.join("icon.png");

    std::fs::create_dir_all(&work_dir)?;

    let img = image::RgbaImage::from_fn(512, 512, |x, y| {
        let r = ((x as f32 / 512.0) * 255.0) as u8;
        let g = ((y as f32 / 512.0) * 255.0) as u8;
        image::Rgba([r, g, 180, 255])
    });
    img.save(&icon_path)
        .map_err(|e| PackagerError::IconProcess(e.to_string()))?;

    let icons_dir = runtime_dir.join("icons");
    install_icons(&icon_path, &icons_dir)?;

    println!("Default icons generated at {}", icons_dir.display());
    Ok(())
}
