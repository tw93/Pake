use serde::{Deserialize, Serialize};

/// JavaScript/CSS injection configuration (Member C owns implementation).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct InjectConfig {
    /// Inject custom CSS into every page.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub custom_css: Option<String>,
    /// Block common ad selectors.
    #[serde(default)]
    pub block_ads: bool,
    /// Bridge clipboard shortcuts on Linux/Windows.
    #[serde(default = "default_true")]
    pub clipboard_bridge: bool,
    /// Keep OAuth popups in the same window when possible.
    #[serde(default = "default_true")]
    pub inline_auth_popups: bool,
}

impl Default for InjectConfig {
    fn default() -> Self {
        Self {
            custom_css: None,
            block_ads: false,
            clipboard_bridge: true,
            inline_auth_popups: true,
        }
    }
}

fn default_true() -> bool {
    true
}
