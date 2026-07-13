use thiserror::Error;

#[derive(Debug, Error)]
pub enum ConfigError {
    #[error("invalid URL: {0}")]
    InvalidUrl(String),
    #[error("name must not be empty")]
    EmptyName,
    #[error("width and height must be greater than zero")]
    InvalidDimensions,
    #[error("failed to read config: {0}")]
    Io(#[from] std::io::Error),
    #[error("failed to parse config: {0}")]
    Parse(#[from] serde_json::Error),
}

pub type Result<T> = std::result::Result<T, ConfigError>;
