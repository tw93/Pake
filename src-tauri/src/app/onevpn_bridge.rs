use crate::app::config::OneVpnConfig;
use std::io;

pub fn start_onevpn_bridge(_config: &OneVpnConfig) -> io::Result<String> {
    Err(io::Error::new(
        io::ErrorKind::Unsupported,
        "upstream bridge implementation is not enabled in this build",
    ))
}
