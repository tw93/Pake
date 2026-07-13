use crate::config::AppConfig;
use crate::error::{ConfigError, Result};
use url::Url;

pub fn validate_config(config: &AppConfig) -> Result<()> {
    if config.name.trim().is_empty() {
        return Err(ConfigError::EmptyName);
    }

    Url::parse(&config.url).map_err(|_| ConfigError::InvalidUrl(config.url.clone()))?;

    if config.width == 0 || config.height == 0 {
        return Err(ConfigError::InvalidDimensions);
    }

    if let Some(min_w) = config.min_width {
        if min_w > config.width {
            return Err(ConfigError::InvalidDimensions);
        }
    }

    if let Some(min_h) = config.min_height {
        if min_h > config.height {
            return Err(ConfigError::InvalidDimensions);
        }
    }

    Ok(())
}

pub fn load_config(path: &std::path::Path) -> Result<AppConfig> {
    let content = std::fs::read_to_string(path)?;
    let config: AppConfig = serde_json::from_str(&content)?;
    validate_config(&config)?;
    Ok(config)
}

pub fn save_config(path: &std::path::Path, config: &AppConfig) -> Result<()> {
    validate_config(config)?;
    let content = serde_json::to_string_pretty(config)?;
    std::fs::write(path, content)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::AppConfig;

    #[test]
    fn rejects_empty_name() {
        let config = AppConfig::new("", "https://example.com");
        assert!(validate_config(&config).is_err());
    }

    #[test]
    fn accepts_valid_config() {
        let config = AppConfig::new("Example", "https://example.com");
        assert!(validate_config(&config).is_ok());
    }
}
