//! Build pipeline for WebPake.
//!
//! Owned by Member B: CLI argument merging, icon processing, config file
//! generation, and `cargo tauri build` orchestration.

mod error;
mod icon;
mod pipeline;
mod tauri_config;

pub use error::*;
pub use icon::*;
pub use pipeline::*;
pub use tauri_config::*;
