use thiserror::Error;

#[derive(Debug, Error)]
pub enum PackagerError {
    #[error("config error: {0}")]
    Config(#[from] webpake_core::ConfigError),
    #[error("failed to fetch icon: {0}")]
    IconFetch(String),
    #[error("failed to process icon: {0}")]
    IconProcess(String),
    #[error("build command failed: {0}")]
    BuildFailed(String),
    #[error("runtime directory not found: {0}")]
    RuntimeNotFound(String),
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("json error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("{0}")]
    Other(String),
}

pub type Result<T> = std::result::Result<T, PackagerError>;
