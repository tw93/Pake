use serde::{Deserialize, Serialize};

/// Keyboard shortcut configuration exposed to the runtime menu system.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ShortcutConfig {
    #[serde(default = "default_true")]
    pub navigation: bool,
    #[serde(default = "default_true")]
    pub zoom: bool,
    #[serde(default = "default_true")]
    pub refresh: bool,
    #[serde(default = "default_true")]
    pub copy_url: bool,
    #[serde(default = "default_true")]
    pub devtools: bool,
}

impl Default for ShortcutConfig {
    fn default() -> Self {
        Self {
            navigation: true,
            zoom: true,
            refresh: true,
            copy_url: true,
            devtools: true,
        }
    }
}

fn default_true() -> bool {
    true
}
