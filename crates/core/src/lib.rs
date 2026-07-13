//! Shared configuration contract for the WebPake workspace.
//!
//! Member A (runtime), Member B (CLI/packager), and Member C (inject/platform)
//! must coordinate changes to these types.

mod config;
mod error;
mod inject;
mod shortcut;
mod validate;

pub use config::*;
pub use error::*;
pub use inject::*;
pub use shortcut::*;
pub use validate::*;
