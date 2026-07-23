use std::time::Duration;

use reqwest::{Client, Response, Url};

const CHINA_TRACE_URL: &str = "https://www.cloudflare.com/cdn-cgi/trace";
const GITHUB_PROXY_PREFIX: &str = "https://v4.gh-proxy.org/";

pub fn country_from_cloudflare_trace(trace: &str) -> Option<&str> {
    trace
        .lines()
        .filter_map(|line| line.split_once('='))
        .find_map(|(key, value)| (key == "loc").then_some(value.trim()))
        .filter(|country| country.len() == 2)
}

pub fn github_proxy_url(original: &str) -> Result<String, String> {
    let url = Url::parse(original).map_err(|error| format!("Invalid download URL: {error}"))?;
    if url.scheme() != "https" || url.host_str() != Some("github.com") {
        return Err("Only HTTPS github.com downloads can use the acceleration proxy.".into());
    }
    Ok(format!("{GITHUB_PROXY_PREFIX}{original}"))
}

pub async fn is_mainland_china(client: &Client) -> bool {
    let request = client.get(CHINA_TRACE_URL).timeout(Duration::from_secs(4));
    let Ok(response) = request.send().await else {
        return false;
    };
    if !response.status().is_success() {
        return false;
    }
    let Ok(trace) = response.text().await else {
        return false;
    };
    country_from_cloudflare_trace(&trace) == Some("CN")
}

pub async fn download_response(
    client: &Client,
    original_url: &str,
    use_china_proxy: bool,
) -> Result<(Response, bool), String> {
    if use_china_proxy {
        let proxy_url = github_proxy_url(original_url)?;
        match client.get(&proxy_url).send().await {
            Ok(response) if response.status().is_success() => {
                return Ok((response, true));
            }
            _ => {}
        }
    }

    let response = client
        .get(original_url)
        .send()
        .await
        .map_err(|error| format!("Download request failed: {error}"))?;
    if !response.status().is_success() {
        return Err(format!(
            "Download failed with HTTP status {}.",
            response.status()
        ));
    }
    Ok((response, false))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_cloudflare_country_without_guessing_from_locale() {
        assert_eq!(
            country_from_cloudflare_trace("fl=1\nip=192.0.2.1\nloc=CN\ntls=TLSv1.3"),
            Some("CN")
        );
        assert_eq!(country_from_cloudflare_trace("loc=US"), Some("US"));
        assert_eq!(country_from_cloudflare_trace("ip=192.0.2.1"), None);
    }

    #[test]
    fn rewrites_only_verified_github_https_downloads() {
        let source = "https://github.com/yumingyuan2/Pake/releases/download/tag/app.msi";
        assert_eq!(
            github_proxy_url(source).unwrap(),
            format!("https://v4.gh-proxy.org/{source}")
        );
        assert!(github_proxy_url("http://github.com/owner/repo/app").is_err());
        assert!(github_proxy_url("https://example.com/app").is_err());
    }
}
