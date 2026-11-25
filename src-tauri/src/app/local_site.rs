//! Serves a runtime app's own pages from `pake-runtime/site`.
//!
//! A CLI build bakes a local page into the binary's assets. A prebuilt runtime
//! template cannot, so a builder copies the user's files into the `site`
//! folder and the runtime swaps Tauri's assets for this reader. The pages keep
//! the origin a CLI-built local app has (`tauri://localhost`, or
//! `http://tauri.localhost` on Windows), so everything Pake does for local
//! pages applies unchanged.

use std::borrow::Cow;
use std::path::{Component, Path, PathBuf};

use tauri::utils::assets::{AssetKey, AssetsIter, CspHash};
use tauri::{Assets, Runtime};

/// `raw` as a path of plain names, or None when it is empty, absolute, or
/// steps out with `..`. Asset keys arrive percent-decoded, so a request for
/// `/%2e%2e/secret` reaches this as `../secret`.
/// The entry page as the path a `WebviewUrl::App` joins onto the app's origin.
/// That join reads `#` as the start of a fragment and `?` as a query, so
/// `chart #1.html` would open `chart `; escaped here, they reach the asset
/// key decoded, as a space does.
pub fn entry_path(file: &str) -> PathBuf {
    PathBuf::from(
        file.replace('%', "%25")
            .replace('#', "%23")
            .replace('?', "%3F"),
    )
}

pub fn relative_path(raw: &str) -> Option<PathBuf> {
    let mut path = PathBuf::new();
    for component in Path::new(raw.trim_start_matches(['/', '\\'])).components() {
        match component {
            Component::Normal(name) => path.push(name),
            Component::CurDir => {}
            Component::ParentDir | Component::RootDir | Component::Prefix(_) => return None,
        }
    }
    (!path.as_os_str().is_empty()).then_some(path)
}

pub struct LocalSite {
    root: PathBuf,
}

impl LocalSite {
    pub fn new(root: PathBuf) -> Self {
        let root = root.canonicalize().unwrap_or(root);
        Self { root }
    }

    /// The file a key names, only when it resolves inside the site folder:
    /// a symbolic link that points out of it is refused like `..`.
    fn resolve(&self, key: &str) -> Option<PathBuf> {
        let file = self.root.join(relative_path(key)?).canonicalize().ok()?;
        (file.starts_with(&self.root) && file.is_file()).then_some(file)
    }
}

impl<R: Runtime> Assets<R> for LocalSite {
    fn get(&self, key: &AssetKey) -> Option<Cow<'_, [u8]>> {
        std::fs::read(self.resolve(key.as_ref())?)
            .ok()
            .map(Cow::Owned)
    }

    fn iter(&self) -> Box<AssetsIter<'_>> {
        Box::new(std::iter::empty())
    }

    // The app ships with no CSP (`csp: null`), so there are no hashes to add.
    fn csp_hashes(&self, _html_path: &AssetKey) -> Box<dyn Iterator<Item = CspHash<'_>> + '_> {
        Box::new(std::iter::empty())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn site() -> (PathBuf, LocalSite) {
        let base = std::env::temp_dir().join(format!(
            "pake-local-site-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let root = base.join("site");
        fs::create_dir_all(root.join("assets")).unwrap();
        fs::write(root.join("index.html"), "<h1>hi</h1>").unwrap();
        fs::write(root.join("assets/app.js"), "1").unwrap();
        fs::write(base.join("secret.txt"), "no").unwrap();
        let site = LocalSite::new(root);
        (base, site)
    }

    fn read(site: &LocalSite, key: &str) -> Option<Vec<u8>> {
        <LocalSite as Assets<tauri::Wry>>::get(site, &AssetKey::from(key)).map(Cow::into_owned)
    }

    #[test]
    fn serves_files_inside_the_site_folder() {
        let (base, site) = site();
        assert_eq!(
            read(&site, "index.html").as_deref(),
            Some(&b"<h1>hi</h1>"[..])
        );
        assert_eq!(read(&site, "/assets/app.js").as_deref(), Some(&b"1"[..]));
        assert_eq!(read(&site, "./assets/app.js").as_deref(), Some(&b"1"[..]));
        // Missing files and folders are None, so Tauri's own fallbacks apply.
        assert!(read(&site, "missing.html").is_none());
        assert!(read(&site, "assets").is_none());
        fs::remove_dir_all(base).unwrap();
    }

    #[test]
    fn refuses_paths_that_leave_the_site_folder() {
        let (base, site) = site();
        assert!(read(&site, "../secret.txt").is_none());
        assert!(read(&site, "assets/../../secret.txt").is_none());
        assert!(site
            .resolve(&base.join("secret.txt").to_string_lossy())
            .is_none());
        #[cfg(unix)]
        {
            std::os::unix::fs::symlink(base.join("secret.txt"), base.join("site/link.txt"))
                .unwrap();
            assert!(read(&site, "link.txt").is_none());
        }
        fs::remove_dir_all(base).unwrap();
    }

    #[test]
    fn entry_path_escapes_what_a_url_join_would_cut() {
        assert_eq!(entry_path("index.html"), PathBuf::from("index.html"));
        assert_eq!(entry_path("a b/c.html"), PathBuf::from("a b/c.html"));
        assert_eq!(
            entry_path("chart #1?.html"),
            PathBuf::from("chart %231%3F.html")
        );
        assert_eq!(entry_path("100%.html"), PathBuf::from("100%25.html"));
        // The whole name stays in the path, each escape decoding back to its character.
        let joined = tauri::Url::parse("tauri://localhost/")
            .unwrap()
            .join(entry_path("chart #1 100%.html").to_str().unwrap())
            .unwrap();
        assert_eq!(joined.fragment(), None);
        assert_eq!(joined.path(), "/chart%20%231%20100%25.html");
    }

    #[test]
    fn relative_path_accepts_only_plain_names() {
        assert_eq!(
            relative_path("index.html"),
            Some(PathBuf::from("index.html"))
        );
        assert_eq!(
            relative_path("/tools/a b.html"),
            Some(PathBuf::from("tools/a b.html"))
        );
        for raw in ["", "/", "..", "../x.html", "a/../../x.html"] {
            assert_eq!(relative_path(raw), None, "{raw:?}");
        }
    }
}
