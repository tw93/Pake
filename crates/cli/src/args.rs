use clap::Parser;
use std::path::PathBuf;
use webpake_core::{AppConfig, BuildOptions, InjectConfig};

/// Turn any webpage into a lightweight desktop app with one command.
#[derive(Debug, Parser)]
#[command(name = "webpake", version, about, long_about = None)]
pub struct Cli {
    /// Target website URL
    pub url: String,

    /// Application display name
    #[arg(short, long)]
    pub name: String,

    /// Custom window title
    #[arg(long)]
    pub title: Option<String>,

    /// Window width
    #[arg(long, default_value_t = 1200)]
    pub width: u32,

    /// Window height
    #[arg(long, default_value_t = 800)]
    pub height: u32,

    /// Minimum window width
    #[arg(long)]
    pub min_width: Option<u32>,

    /// Minimum window height
    #[arg(long)]
    pub min_height: Option<u32>,

    /// Custom icon path (.png, .ico, .icns)
    #[arg(long)]
    pub icon: Option<PathBuf>,

    /// Hide the title bar (frameless window)
    #[arg(long)]
    pub hide_title_bar: bool,

    /// Start maximized
    #[arg(long)]
    pub maximize: bool,

    /// Incognito mode (no persistent storage)
    #[arg(long)]
    pub incognito: bool,

    /// Allow multiple windows
    #[arg(long)]
    pub multi_window: bool,

    /// Block common ad selectors
    #[arg(long)]
    pub block_ads: bool,

    /// Custom CSS to inject
    #[arg(long)]
    pub custom_css: Option<String>,

    /// Load options from a JSON config file instead of CLI-only args.
    #[arg(long, value_name = "FILE")]
    pub config_file: Option<PathBuf>,

    /// Custom user agent string
    #[arg(long)]
    pub user_agent: Option<String>,

    /// Show system tray icon
    #[arg(long)]
    pub system_tray: bool,

    /// Open external links in the system browser (default: true)
    #[arg(long, default_value_t = true)]
    pub open_external_links_in_browser: bool,

    /// Disable clipboard bridge in inject layer
    #[arg(long)]
    pub no_clipboard_bridge: bool,

    /// Disable inline auth popups in inject layer
    #[arg(long)]
    pub no_inline_auth: bool,

    /// Target platform: macos, windows, linux
    #[arg(long)]
    pub target: Option<String>,

    /// Output directory for build artifacts
    #[arg(long)]
    pub output_dir: Option<PathBuf>,

    /// Only generate config files, do not build
    #[arg(long)]
    pub config_only: bool,

    /// Development mode (cargo tauri dev)
    #[arg(long)]
    pub dev: bool,
}

impl From<Cli> for BuildOptions {
    fn from(cli: Cli) -> Self {
        let mut app = AppConfig::new(cli.name, cli.url);
        app.title = cli.title;
        app.width = cli.width;
        app.height = cli.height;
        app.min_width = cli.min_width;
        app.min_height = cli.min_height;
        app.icon = cli.icon;
        app.hide_title_bar = cli.hide_title_bar;
        app.maximize = cli.maximize;
        app.incognito = cli.incognito;
        app.multi_window = cli.multi_window;
        app.user_agent = cli.user_agent;
        app.system_tray = cli.system_tray;
        app.open_external_links_in_browser = cli.open_external_links_in_browser;
        app.inject = InjectConfig {
            block_ads: cli.block_ads,
            custom_css: cli.custom_css,
            clipboard_bridge: !cli.no_clipboard_bridge,
            inline_auth_popups: !cli.no_inline_auth,
        };

        BuildOptions {
            app,
            target: cli.target,
            output_dir: cli.output_dir,
            config_only: cli.config_only,
            dev: cli.dev,
        }
    }
}

impl Cli {
    pub fn into_build_options(self) -> BuildOptions {
        let config_file = self.config_file.clone();
        let mut options: BuildOptions = self.into();
        if let Some(path) = config_file {
            if let Ok(file_config) = webpake_core::load_config(&path) {
                options.app = merge_config(options.app, file_config);
            }
        }
        options
    }
}

fn merge_config(cli_config: AppConfig, file_config: AppConfig) -> AppConfig {
    AppConfig {
        name: if cli_config.name.is_empty() {
            file_config.name
        } else {
            cli_config.name
        },
        url: if cli_config.url.is_empty() {
            file_config.url
        } else {
            cli_config.url
        },
        title: cli_config.title.or(file_config.title),
        width: cli_config.width,
        height: cli_config.height,
        min_width: cli_config.min_width.or(file_config.min_width),
        min_height: cli_config.min_height.or(file_config.min_height),
        icon: cli_config.icon.or(file_config.icon),
        hide_title_bar: cli_config.hide_title_bar || file_config.hide_title_bar,
        maximize: cli_config.maximize || file_config.maximize,
        incognito: cli_config.incognito || file_config.incognito,
        multi_window: cli_config.multi_window || file_config.multi_window,
        open_external_links_in_browser: cli_config.open_external_links_in_browser,
        user_agent: cli_config.user_agent.or(file_config.user_agent),
        system_tray: cli_config.system_tray || file_config.system_tray,
        inject: cli_config.inject,
        shortcuts: file_config.shortcuts,
    }
}
