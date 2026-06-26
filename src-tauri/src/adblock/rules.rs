use tauri::Url;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Decision {
    Allow,
    Block,
}

pub fn is_youtube_origin(raw_url: &str) -> bool {
    let Ok(url) = Url::parse(raw_url) else {
        return false;
    };
    matches!(url.host_str(), Some("www.youtube.com" | "m.youtube.com"))
}

pub fn classify(raw_url: &str) -> Decision {
    let Ok(url) = Url::parse(raw_url) else {
        return Decision::Allow;
    };
    let host = url.host_str().unwrap_or_default();
    let path = url.path();

    let youtube_ad_path = matches!(host, "www.youtube.com" | "m.youtube.com")
        && (path.starts_with("/pagead/")
            || path == "/api/stats/ads"
            || path == "/ptracking"
            || path == "/get_midroll_info");
    let doubleclick_ad_path = host == "googleads.g.doubleclick.net" && path.starts_with("/pagead/");

    if youtube_ad_path || doubleclick_ad_path {
        Decision::Block
    } else {
        Decision::Allow
    }
}

#[cfg(test)]
mod tests {
    use super::{classify, is_youtube_origin, Decision};

    #[test]
    fn accepts_supported_youtube_origins() {
        assert!(is_youtube_origin("https://www.youtube.com/watch?v=abc"));
        assert!(is_youtube_origin("https://m.youtube.com/shorts/abc"));
        assert!(!is_youtube_origin("https://youtube.example.com/watch"));
    }

    #[test]
    fn blocks_only_explicit_ad_endpoints() {
        for url in [
            "https://www.youtube.com/pagead/paralleladview?ai=1",
            "https://www.youtube.com/api/stats/ads?ver=2",
            "https://www.youtube.com/ptracking?video_id=abc",
            "https://googleads.g.doubleclick.net/pagead/id",
        ] {
            assert_eq!(classify(url), Decision::Block, "{url}");
        }
    }

    #[test]
    fn allows_video_and_account_traffic() {
        for url in [
            "https://rr1---sn.example.googlevideo.com/videoplayback?id=abc",
            "https://www.youtube.com/youtubei/v1/player",
            "https://www.youtube.com/youtubei/v1/account/account_menu",
            "https://i.ytimg.com/vi/abc/hqdefault.jpg",
            "https://accounts.google.com/o/oauth2/auth",
        ] {
            assert_eq!(classify(url), Decision::Allow, "{url}");
        }
    }
}
