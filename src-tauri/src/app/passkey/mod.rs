//! Passkeys for pages in a macOS app, kept in the Mac's Secure Enclave behind Touch ID.
//!
//! WKWebView runs WebAuthn only for a site the app lists under `webcredentials`
//! or in an app Apple grants its browser entitlement, and a Pake app has
//! neither: `navigator.credentials.create` and `get` fail at once with
//! `NotAllowedError`. So the runtime answers them itself, as Chrome's own
//! Touch ID authenticator does beside iCloud Keychain: `passkey.js` hands the
//! page's request to a script message handler, which takes the page's origin
//! from WebKit, never from the page, makes or uses a P-256 key in the Secure
//! Enclave that only Touch ID or the login password unlocks, and writes the
//! authenticator data and `none` attestation itself.
//!
//! The passkeys stay on this Mac and in this app, outside iCloud Keychain, so a
//! passkey kept on an iPhone is not offered. Each is a record in the app's data
//! folder whose key only this Mac's enclave can use.
//!
//! This file holds what does not touch the system, so it is tested everywhere;
//! `macos.rs` holds the enclave, the prompts and the handler.

#![cfg_attr(not(target_os = "macos"), allow(dead_code))]

#[cfg(target_os = "macos")]
mod macos;
#[cfg(target_os = "macos")]
pub use macos::install;

use base64::engine::general_purpose::{STANDARD, URL_SAFE_NO_PAD};
use base64::Engine;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::util::UiLanguage;

/// The name the page script posts to.
pub const HANDLER_NAME: &str = "pakePasskey";
/// The store inside the app's data folder.
pub const STORE_FILE: &str = "passkeys.json";
/// ES256, the one algorithm the Secure Enclave signs with.
const ES256: i64 = -7;
/// User presence and user verification: Touch ID or the login password ran.
const FLAGS_UP_UV: u8 = 0x05;
/// Attested credential data follows the counter.
const FLAG_AT: u8 = 0x40;
/// A user handle is at most 64 bytes.
const MAX_USER_HANDLE: usize = 64;
/// The DER prefix of a P-256 SubjectPublicKeyInfo, before the 65-byte point.
const P256_SPKI_PREFIX: [u8; 26] = [
    0x30, 0x59, 0x30, 0x13, 0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01, 0x06, 0x08, 0x2a,
    0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07, 0x03, 0x42, 0x00,
];

/// The DOMException a request ends with, as the page script raises it.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Failure {
    NotAllowed,
    Security,
    InvalidState,
    NotSupported,
    Type,
}

impl Failure {
    pub fn name(self) -> &'static str {
        match self {
            Failure::NotAllowed => "NotAllowedError",
            Failure::Security => "SecurityError",
            Failure::InvalidState => "InvalidStateError",
            Failure::NotSupported => "NotSupportedError",
            Failure::Type => "TypeError",
        }
    }
}

pub fn failure_reply(failure: Failure, message: &str) -> String {
    serde_json::json!({ "error": failure.name(), "message": message }).to_string()
}

pub fn b64url(bytes: &[u8]) -> String {
    URL_SAFE_NO_PAD.encode(bytes)
}

pub fn from_b64url(text: &str) -> Option<Vec<u8>> {
    URL_SAFE_NO_PAD.decode(text.trim_end_matches('=')).ok()
}

fn sha256(bytes: &[u8]) -> [u8; 32] {
    Sha256::digest(bytes).into()
}

/// The page's origin as WebKit reports it for the calling frame.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Origin {
    pub scheme: String,
    pub host: String,
    /// 0 for the scheme's default port.
    pub port: u16,
}

impl Origin {
    pub fn serialized(&self) -> String {
        if self.port == 0 {
            format!("{}://{}", self.scheme, self.host)
        } else {
            format!("{}://{}:{}", self.scheme, self.host, self.port)
        }
    }

    /// A secure context, as WebAuthn requires: https, or http on this machine.
    fn is_secure(&self) -> bool {
        match self.scheme.as_str() {
            "https" => !self.host.is_empty(),
            "http" => {
                matches!(self.host.as_str(), "localhost" | "127.0.0.1" | "[::1]")
                    || self.host.ends_with(".localhost")
            }
            _ => false,
        }
    }
}

/// The relying party a request may use: the origin's host, or a parent of it
/// that is still a registrable domain, so `accounts.google.com` may ask for
/// `google.com` and nobody may ask for `co.uk` or `github.io`.
pub fn resolve_rp_id(origin: &Origin, requested: Option<&str>) -> Result<String, Failure> {
    if !origin.is_secure() {
        return Err(Failure::Security);
    }
    let host = origin.host.to_ascii_lowercase();
    let Some(requested) = requested else {
        return Ok(host);
    };
    // An empty id is not a domain, as a browser reads it, not a missing one.
    if requested.is_empty() {
        return Err(Failure::Security);
    }
    let requested = requested.to_ascii_lowercase();
    if requested == host {
        return Ok(requested);
    }
    let is_parent = host
        .strip_suffix(&requested)
        .is_some_and(|rest| rest.ends_with('.'));
    if is_parent && psl::domain_str(&requested).is_some() {
        Ok(requested)
    } else {
        Err(Failure::Security)
    }
}

/// The CBOR shapes WebAuthn's authenticator data and attestation use.
enum Cbor {
    Uint(u64),
    /// A negative integer, by its value.
    Nint(i64),
    Bytes(Vec<u8>),
    Text(&'static str),
    Map(Vec<(Cbor, Cbor)>),
}

fn cbor_head(out: &mut Vec<u8>, major: u8, value: u64) {
    let major = major << 5;
    match value {
        0..=23 => out.push(major | value as u8),
        24..=0xff => out.extend([major | 24, value as u8]),
        0x100..=0xffff => {
            out.push(major | 25);
            out.extend((value as u16).to_be_bytes());
        }
        0x1_0000..=0xffff_ffff => {
            out.push(major | 26);
            out.extend((value as u32).to_be_bytes());
        }
        _ => {
            out.push(major | 27);
            out.extend(value.to_be_bytes());
        }
    }
}

fn cbor(value: &Cbor, out: &mut Vec<u8>) {
    match value {
        Cbor::Uint(value) => cbor_head(out, 0, *value),
        Cbor::Nint(value) => cbor_head(out, 1, (-1 - value) as u64),
        Cbor::Bytes(bytes) => {
            cbor_head(out, 2, bytes.len() as u64);
            out.extend(bytes);
        }
        Cbor::Text(text) => {
            cbor_head(out, 3, text.len() as u64);
            out.extend(text.as_bytes());
        }
        Cbor::Map(entries) => {
            cbor_head(out, 5, entries.len() as u64);
            for (key, value) in entries {
                cbor(key, out);
                cbor(value, out);
            }
        }
    }
}

fn encode(value: Cbor) -> Vec<u8> {
    let mut out = Vec::new();
    cbor(&value, &mut out);
    out
}

/// The COSE form of a P-256 public key given as `04 || x || y`, keys in CTAP2's canonical order.
fn cose_key(point: &[u8]) -> Option<Vec<u8>> {
    if point.len() != 65 || point[0] != 0x04 {
        return None;
    }
    Some(encode(Cbor::Map(vec![
        (Cbor::Uint(1), Cbor::Uint(2)),
        (Cbor::Uint(3), Cbor::Nint(ES256)),
        (Cbor::Nint(-1), Cbor::Uint(1)),
        (Cbor::Nint(-2), Cbor::Bytes(point[1..33].to_vec())),
        (Cbor::Nint(-3), Cbor::Bytes(point[33..].to_vec())),
    ])))
}

/// Authenticator data for a sign-in: the relying party's hash, the flags and a
/// zero counter, which tells the site this authenticator keeps none.
pub fn assertion_auth_data(rp_id: &str) -> Vec<u8> {
    let mut data = sha256(rp_id.as_bytes()).to_vec();
    data.push(FLAGS_UP_UV);
    data.extend([0, 0, 0, 0]);
    data
}

/// Authenticator data for a new passkey: as a sign-in's, then a zero AAGUID,
/// the credential id and its public key.
fn attested_auth_data(rp_id: &str, credential_id: &[u8], point: &[u8]) -> Option<Vec<u8>> {
    let key = cose_key(point)?;
    let mut data = sha256(rp_id.as_bytes()).to_vec();
    data.push(FLAGS_UP_UV | FLAG_AT);
    data.extend([0, 0, 0, 0]);
    data.extend([0; 16]);
    data.extend((credential_id.len() as u16).to_be_bytes());
    data.extend(credential_id);
    data.extend(key);
    Some(data)
}

#[derive(Serialize)]
struct ClientData<'a> {
    #[serde(rename = "type")]
    kind: &'a str,
    challenge: &'a str,
    origin: &'a str,
    #[serde(rename = "crossOrigin")]
    cross_origin: bool,
}

/// One message from `passkey.js`: the page's request and the id it was sent under,
/// which a later `cancel` names when the page aborts it or its timeout passes.
#[derive(Debug, Deserialize)]
pub struct Envelope {
    #[serde(default)]
    pub id: u64,
    #[serde(flatten)]
    pub request: Request,
}

/// What the page asked, as `passkey.js` posts it: WebAuthn's options with every buffer in base64url.
#[derive(Debug, Deserialize)]
#[serde(tag = "kind", rename_all = "lowercase")]
pub enum Request {
    Available,
    Cancel,
    Create {
        #[serde(rename = "publicKey")]
        options: CreateOptions,
    },
    Get {
        #[serde(rename = "publicKey")]
        options: GetOptions,
    },
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateOptions {
    challenge: String,
    #[serde(default)]
    rp: RelyingParty,
    user: User,
    #[serde(default)]
    pub_key_cred_params: Vec<Parameter>,
    #[serde(default)]
    exclude_credentials: Vec<Descriptor>,
    #[serde(default)]
    authenticator_selection: Option<Selection>,
    #[serde(default)]
    extensions: Option<serde_json::Value>,
}

#[derive(Debug, Default, Deserialize)]
struct RelyingParty {
    #[serde(default)]
    id: Option<String>,
}

/// Whether a window gets passkeys. A private window keeps nothing between
/// runs, and one that accepts any certificate cannot tell the site from a
/// stand-in on the network, which would then get a Touch ID signature for
/// the real origin; a browser refuses WebAuthn on a certificate error too.
pub fn enabled(incognito: bool, ignores_certificate_errors: bool) -> bool {
    !incognito && !ignores_certificate_errors
}

impl CreateOptions {
    /// The rpId the site asked for, before it is checked.
    pub fn rp_id(&self) -> Option<&str> {
        self.rp.id.as_deref()
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct User {
    id: String,
    #[serde(default)]
    name: String,
    #[serde(default)]
    display_name: String,
}

#[derive(Debug, Deserialize)]
struct Parameter {
    #[serde(rename = "type", default)]
    kind: String,
    alg: i64,
}

#[derive(Debug, Deserialize)]
struct Descriptor {
    id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Selection {
    #[serde(default)]
    authenticator_attachment: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GetOptions {
    challenge: String,
    #[serde(default)]
    rp_id: Option<String>,
    #[serde(default)]
    allow_credentials: Vec<Descriptor>,
}

/// One passkey in the app's store. `key` is the enclave's token for the
/// private key, useless on any other Mac.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Passkey {
    pub id: String,
    pub rp_id: String,
    pub user_handle: String,
    pub user_name: String,
    pub display_name: String,
    pub key: String,
    pub created: u64,
}

impl Passkey {
    /// What the account picker shows for it.
    pub fn label(&self) -> String {
        match (self.user_name.is_empty(), self.display_name.is_empty()) {
            (false, _) => self.user_name.clone(),
            (true, false) => self.display_name.clone(),
            (true, true) => self.rp_id.clone(),
        }
    }

    pub fn key_token(&self) -> Option<Vec<u8>> {
        STANDARD.decode(&self.key).ok()
    }
}

#[derive(Debug, Default, Serialize, Deserialize)]
pub struct Store {
    #[serde(default)]
    pub passkeys: Vec<Passkey>,
}

impl Store {
    pub fn parse(text: &str) -> Option<Self> {
        serde_json::from_str(text).ok()
    }

    pub fn to_json(&self) -> String {
        serde_json::to_string_pretty(self).unwrap_or_default()
    }

    /// A site makes one passkey per account here: a new one for the same
    /// account replaces the old, as in a browser.
    pub fn upsert(&mut self, passkey: Passkey) {
        self.passkeys
            .retain(|old| !(old.rp_id == passkey.rp_id && old.user_handle == passkey.user_handle));
        self.passkeys.push(passkey);
    }
}

/// A checked request to make a passkey, waiting for the enclave.
#[derive(Debug)]
pub struct CreatePlan {
    pub rp_id: String,
    pub client_data: Vec<u8>,
    user_handle: String,
    user_name: String,
    display_name: String,
    cred_props: bool,
}

/// A checked request to sign in, with the passkeys it may use, newest first.
#[derive(Debug)]
pub struct GetPlan {
    pub rp_id: String,
    pub client_data: Vec<u8>,
    pub candidates: Vec<Passkey>,
}

fn client_data(kind: &str, challenge: &str, origin: &Origin) -> Result<Vec<u8>, Failure> {
    // Re-encoded, so the JSON carries exactly the challenge's canonical form.
    let challenge = from_b64url(challenge)
        .filter(|bytes| !bytes.is_empty())
        .ok_or(Failure::Type)?;
    let origin = origin.serialized();
    serde_json::to_vec(&ClientData {
        kind,
        challenge: &b64url(&challenge),
        origin: &origin,
        cross_origin: false,
    })
    .map_err(|_| Failure::NotAllowed)
}

pub fn plan_create(
    origin: &Origin,
    options: CreateOptions,
    store: &Store,
) -> Result<CreatePlan, Failure> {
    let rp_id = resolve_rp_id(origin, options.rp.id.as_deref())?;
    let handle = from_b64url(&options.user.id).ok_or(Failure::Type)?;
    if handle.is_empty() || handle.len() > MAX_USER_HANDLE {
        return Err(Failure::Type);
    }
    // An empty list means the browser's defaults, which start with ES256.
    let es256 = options.pub_key_cred_params.is_empty()
        || options
            .pub_key_cred_params
            .iter()
            .any(|param| param.alg == ES256 && param.kind == "public-key");
    if !es256 {
        return Err(Failure::NotSupported);
    }
    // A security key or a phone was asked for, which this authenticator is not.
    if options
        .authenticator_selection
        .as_ref()
        .and_then(|selection| selection.authenticator_attachment.as_deref())
        == Some("cross-platform")
    {
        return Err(Failure::NotAllowed);
    }
    let excluded = options.exclude_credentials.iter().any(|excluded| {
        store
            .passkeys
            .iter()
            .any(|passkey| passkey.rp_id == rp_id && passkey.id == excluded.id)
    });
    if excluded {
        return Err(Failure::InvalidState);
    }
    let cred_props = options
        .extensions
        .as_ref()
        .and_then(|extensions| extensions.get("credProps"))
        .and_then(serde_json::Value::as_bool)
        .unwrap_or(false);
    Ok(CreatePlan {
        client_data: client_data("webauthn.create", &options.challenge, origin)?,
        rp_id,
        user_handle: b64url(&handle),
        user_name: options.user.name,
        display_name: options.user.display_name,
        cred_props,
    })
}

/// The passkey to store and the page's answer, once the enclave made the key
/// (`point` is its public key as `04 || x || y`) and the user approved.
pub fn finish_create(
    plan: &CreatePlan,
    credential_id: &[u8],
    point: &[u8],
    key_token: &[u8],
    created: u64,
) -> Option<(Passkey, String)> {
    let auth_data = attested_auth_data(&plan.rp_id, credential_id, point)?;
    let attestation = encode(Cbor::Map(vec![
        (Cbor::Text("fmt"), Cbor::Text("none")),
        (Cbor::Text("attStmt"), Cbor::Map(Vec::new())),
        (Cbor::Text("authData"), Cbor::Bytes(auth_data.clone())),
    ]));
    let mut spki = P256_SPKI_PREFIX.to_vec();
    spki.extend(point);
    let id = b64url(credential_id);
    let extensions = if plan.cred_props {
        serde_json::json!({ "credProps": { "rk": true } })
    } else {
        serde_json::json!({})
    };
    let reply = serde_json::json!({
        "id": id,
        "authenticatorAttachment": "platform",
        "clientExtensionResults": extensions,
        "response": {
            "clientDataJSON": b64url(&plan.client_data),
            "attestationObject": b64url(&attestation),
            "authenticatorData": b64url(&auth_data),
            "publicKey": b64url(&spki),
            "publicKeyAlgorithm": ES256,
            "transports": ["internal"],
        },
    });
    let passkey = Passkey {
        id,
        rp_id: plan.rp_id.clone(),
        user_handle: plan.user_handle.clone(),
        user_name: plan.user_name.clone(),
        display_name: plan.display_name.clone(),
        key: STANDARD.encode(key_token),
        created,
    };
    Some((passkey, reply.to_string()))
}

pub fn plan_get(origin: &Origin, options: GetOptions, store: &Store) -> Result<GetPlan, Failure> {
    let rp_id = resolve_rp_id(origin, options.rp_id.as_deref())?;
    let mut candidates: Vec<Passkey> = store
        .passkeys
        .iter()
        .filter(|passkey| passkey.rp_id == rp_id)
        .filter(|passkey| {
            options.allow_credentials.is_empty()
                || options
                    .allow_credentials
                    .iter()
                    .any(|allowed| allowed.id == passkey.id)
        })
        .cloned()
        .collect();
    candidates.sort_by_key(|passkey| std::cmp::Reverse(passkey.created));
    Ok(GetPlan {
        client_data: client_data("webauthn.get", &options.challenge, origin)?,
        rp_id,
        candidates,
    })
}

/// What the enclave signs for a sign-in.
pub fn assertion_message(plan: &GetPlan) -> Vec<u8> {
    let mut message = assertion_auth_data(&plan.rp_id);
    message.extend(sha256(&plan.client_data));
    message
}

/// The page's answer for a sign-in with `passkey`, given the enclave's DER signature.
pub fn finish_get(plan: &GetPlan, passkey: &Passkey, signature: &[u8]) -> String {
    serde_json::json!({
        "id": passkey.id,
        "authenticatorAttachment": "platform",
        "clientExtensionResults": {},
        "response": {
            "clientDataJSON": b64url(&plan.client_data),
            "authenticatorData": b64url(&assertion_auth_data(&plan.rp_id)),
            "signature": b64url(signature),
            "userHandle": passkey.user_handle,
        },
    })
    .to_string()
}

/// The picker's line for each candidate. Two accounts that read the same get
/// the day they were saved after the name, through `date`, so they can be told apart.
pub fn picker_labels(candidates: &[Passkey], date: impl Fn(u64) -> String) -> Vec<String> {
    let labels: Vec<String> = candidates.iter().map(Passkey::label).collect();
    labels
        .iter()
        .zip(candidates)
        .map(|(label, passkey)| {
            if labels.iter().filter(|other| *other == label).count() > 1 {
                format!("{label} · {}", date(passkey.created))
            } else {
                label.clone()
            }
        })
        .collect()
}

/// The words after the app's name in the Touch ID prompt, which macOS writes
/// as "<App> is trying to <reason>."
pub fn prompt_reason(creating: bool, rp_id: &str, language: UiLanguage) -> String {
    match (language, creating) {
        (UiLanguage::English, true) => format!("save a passkey for {rp_id}"),
        (UiLanguage::English, false) => format!("sign in to {rp_id}"),
        (UiLanguage::SimplifiedChinese, true) => format!("为 {rp_id} 存储通行密钥"),
        (UiLanguage::SimplifiedChinese, false) => format!("登录 {rp_id}"),
        (UiLanguage::TraditionalChinese, true) => format!("為 {rp_id} 儲存通行密鑰"),
        (UiLanguage::TraditionalChinese, false) => format!("登入 {rp_id}"),
    }
}

/// The account picker's title and its two buttons.
pub fn picker_text(rp_id: &str, language: UiLanguage) -> (String, &'static str, &'static str) {
    match language {
        UiLanguage::English => (format!("Sign In to {rp_id}"), "Continue", "Cancel"),
        UiLanguage::SimplifiedChinese => (format!("登录 {rp_id}"), "继续", "取消"),
        UiLanguage::TraditionalChinese => (format!("登入 {rp_id}"), "繼續", "取消"),
    }
}

/// The notice for a site asking for a second passkey for an account this app
/// already keeps one for: its title and its button.
pub fn existing_text(rp_id: &str, language: UiLanguage) -> (String, &'static str) {
    match language {
        UiLanguage::English => (format!("This App Already Has a Passkey for {rp_id}"), "OK"),
        UiLanguage::SimplifiedChinese => (format!("这个应用里已经有 {rp_id} 的通行密钥"), "好"),
        UiLanguage::TraditionalChinese => {
            (format!("這個應用程式裡已經有 {rp_id} 的通行密鑰"), "好")
        }
    }
}

/// The notice for a sign-in this app has no passkey for: its title, its line and its button.
pub fn missing_text(rp_id: &str, language: UiLanguage) -> (String, &'static str, &'static str) {
    match language {
        UiLanguage::English => (
            format!("No Passkey for {rp_id}"),
            "Passkeys in iCloud Keychain can't be used in this app. Sign in another way, then add a passkey in the site's settings.",
            "OK",
        ),
        UiLanguage::SimplifiedChinese => (
            format!("这个应用里没有 {rp_id} 的通行密钥"),
            "iCloud 钥匙串里的通行密钥在这里用不了，可以先用其他方式登录，再到网站设置里添加通行密钥。",
            "好",
        ),
        UiLanguage::TraditionalChinese => (
            format!("這個應用程式裡沒有 {rp_id} 的通行密鑰"),
            "iCloud 鑰匙圈裡的通行密鑰在這裡無法使用，可以先用其他方式登入，再到網站設定裡加入通行密鑰。",
            "好",
        ),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn https(host: &str) -> Origin {
        Origin {
            scheme: "https".into(),
            host: host.into(),
            port: 0,
        }
    }

    fn point() -> Vec<u8> {
        let mut point = vec![0x04];
        point.extend(1..=64u8);
        point
    }

    #[test]
    fn rp_id_is_the_host_or_a_registrable_parent() {
        let origin = https("accounts.google.com");
        assert_eq!(resolve_rp_id(&origin, None).unwrap(), "accounts.google.com");
        assert_eq!(resolve_rp_id(&origin, Some("")), Err(Failure::Security));
        assert_eq!(
            resolve_rp_id(&origin, Some("Google.com")).unwrap(),
            "google.com"
        );
        assert_eq!(resolve_rp_id(&origin, Some("com")), Err(Failure::Security));
        assert_eq!(
            resolve_rp_id(&origin, Some("ogle.com")),
            Err(Failure::Security)
        );
        assert_eq!(
            resolve_rp_id(&origin, Some("example.com")),
            Err(Failure::Security)
        );
        assert_eq!(
            resolve_rp_id(&https("a.github.io"), Some("github.io")),
            Err(Failure::Security)
        );
        assert_eq!(
            resolve_rp_id(&https("shop.example.co.uk"), Some("example.co.uk")).unwrap(),
            "example.co.uk"
        );
        assert_eq!(
            resolve_rp_id(&https("example.co.uk"), Some("co.uk")),
            Err(Failure::Security)
        );
    }

    #[test]
    fn only_a_secure_context_may_ask() {
        let http = |host: &str| Origin {
            scheme: "http".into(),
            host: host.into(),
            port: 8080,
        };
        assert_eq!(
            resolve_rp_id(&http("example.com"), None),
            Err(Failure::Security)
        );
        assert_eq!(
            resolve_rp_id(&http("localhost"), None).unwrap(),
            "localhost"
        );
        assert_eq!(
            resolve_rp_id(&http("app.localhost"), None).unwrap(),
            "app.localhost"
        );
        let file = Origin {
            scheme: "file".into(),
            host: String::new(),
            port: 0,
        };
        assert_eq!(resolve_rp_id(&file, None), Err(Failure::Security));
        assert_eq!(http("localhost").serialized(), "http://localhost:8080");
        assert_eq!(https("x.com").serialized(), "https://x.com");
    }

    #[test]
    fn cbor_writes_the_lengths_its_heads_announce() {
        let mut out = Vec::new();
        cbor_head(&mut out, 2, 23);
        cbor_head(&mut out, 2, 24);
        cbor_head(&mut out, 2, 300);
        cbor_head(&mut out, 1, 6);
        assert_eq!(out, [0x57, 0x58, 24, 0x59, 0x01, 0x2c, 0x26]);
        // -7 is major type 1 with value 6.
        assert_eq!(encode(Cbor::Nint(-7)), [0x26]);
    }

    #[test]
    fn cose_key_is_canonical_es256() {
        let key = cose_key(&point()).unwrap();
        assert_eq!(
            &key[..9],
            &[0xa5, 0x01, 0x02, 0x03, 0x26, 0x20, 0x01, 0x21, 0x58]
        );
        assert_eq!(key.len(), 1 + 2 + 2 + 2 + (2 + 1 + 32) * 2);
        assert!(cose_key(&point()[1..]).is_none());
    }

    fn create_request(json: serde_json::Value) -> CreateOptions {
        match serde_json::from_value::<Request>(json).unwrap() {
            Request::Create { options } => options,
            other => panic!("{other:?}"),
        }
    }

    fn sample_create() -> serde_json::Value {
        serde_json::json!({
            "kind": "create",
            "publicKey": {
                "challenge": b64url(b"challenge-bytes"),
                "rp": { "name": "Example" },
                "user": { "id": b64url(b"user-1"), "name": "me@example.com", "displayName": "Me" },
                "pubKeyCredParams": [{ "type": "public-key", "alg": -8 }, { "type": "public-key", "alg": -7 }],
                "extensions": { "credProps": true },
            }
        })
    }

    #[test]
    fn a_new_passkey_answers_with_none_attestation() {
        let plan = plan_create(
            &https("example.com"),
            create_request(sample_create()),
            &Store::default(),
        )
        .unwrap();
        assert_eq!(plan.rp_id, "example.com");
        let client: serde_json::Value = serde_json::from_slice(&plan.client_data).unwrap();
        assert_eq!(client["type"], "webauthn.create");
        assert_eq!(client["origin"], "https://example.com");
        assert_eq!(client["challenge"], b64url(b"challenge-bytes"));
        assert_eq!(client["crossOrigin"], false);

        let (passkey, reply) = finish_create(&plan, &[9; 16], &point(), b"token", 7).unwrap();
        assert_eq!(passkey.user_handle, b64url(b"user-1"));
        assert_eq!(passkey.key_token().unwrap(), b"token");
        let reply: serde_json::Value = serde_json::from_str(&reply).unwrap();
        assert_eq!(reply["id"], b64url(&[9; 16]));
        assert_eq!(reply["clientExtensionResults"]["credProps"]["rk"], true);
        let auth = from_b64url(reply["response"]["authenticatorData"].as_str().unwrap()).unwrap();
        assert_eq!(&auth[..32], &sha256(b"example.com"));
        assert_eq!(auth[32], 0x45);
        assert_eq!(&auth[53..55], &[0, 16]);
        let attestation =
            from_b64url(reply["response"]["attestationObject"].as_str().unwrap()).unwrap();
        // {"fmt": "none", "attStmt": {}, "authData": ...}
        assert_eq!(&attestation[..19], b"\xa3\x63fmt\x64none\x67attStmt\xa0");
        let spki = from_b64url(reply["response"]["publicKey"].as_str().unwrap()).unwrap();
        assert_eq!(spki.len(), 91);
    }

    #[test]
    fn a_create_the_enclave_cannot_answer_is_refused() {
        let mut request = sample_create();
        request["publicKey"]["pubKeyCredParams"] =
            serde_json::json!([{ "type": "public-key", "alg": -257 }]);
        assert_eq!(
            plan_create(
                &https("example.com"),
                create_request(request),
                &Store::default()
            )
            .unwrap_err(),
            Failure::NotSupported
        );
        let mut request = sample_create();
        request["publicKey"]["authenticatorSelection"] =
            serde_json::json!({ "authenticatorAttachment": "cross-platform" });
        assert_eq!(
            plan_create(
                &https("example.com"),
                create_request(request),
                &Store::default()
            )
            .unwrap_err(),
            Failure::NotAllowed
        );
        let mut request = sample_create();
        request["publicKey"]["user"]["id"] = serde_json::json!(b64url(&[1; 65]));
        assert_eq!(
            plan_create(
                &https("example.com"),
                create_request(request),
                &Store::default()
            )
            .unwrap_err(),
            Failure::Type
        );
    }

    fn stored(id: &str, rp_id: &str, user: &str, created: u64) -> Passkey {
        Passkey {
            id: id.into(),
            rp_id: rp_id.into(),
            user_handle: b64url(user.as_bytes()),
            user_name: user.into(),
            display_name: String::new(),
            key: STANDARD.encode(b"token"),
            created,
        }
    }

    #[test]
    fn an_excluded_passkey_already_here_stops_a_create() {
        let store = Store {
            passkeys: vec![stored("abc", "example.com", "me", 1)],
        };
        let mut request = sample_create();
        request["publicKey"]["excludeCredentials"] =
            serde_json::json!([{ "type": "public-key", "id": "abc" }]);
        assert_eq!(
            plan_create(&https("example.com"), create_request(request), &store).unwrap_err(),
            Failure::InvalidState
        );
    }

    #[test]
    fn a_new_passkey_replaces_the_same_accounts_old_one() {
        let mut store = Store::default();
        store.upsert(stored("a", "example.com", "me", 1));
        store.upsert(stored("b", "example.com", "you", 2));
        store.upsert(stored("c", "example.com", "me", 3));
        store.upsert(stored("d", "other.com", "me", 4));
        let ids: Vec<_> = store
            .passkeys
            .iter()
            .map(|passkey| passkey.id.as_str())
            .collect();
        assert_eq!(ids, ["b", "c", "d"]);
        let again = Store::parse(&store.to_json()).unwrap();
        assert_eq!(again.passkeys, store.passkeys);
    }

    fn get_request(json: serde_json::Value) -> GetOptions {
        match serde_json::from_value::<Request>(json).unwrap() {
            Request::Get { options } => options,
            other => panic!("{other:?}"),
        }
    }

    #[test]
    fn a_sign_in_offers_the_sites_passkeys_newest_first() {
        let store = Store {
            passkeys: vec![
                stored("old", "google.com", "a", 1),
                stored("new", "google.com", "b", 5),
                stored("x", "x.com", "c", 9),
            ],
        };
        let request = serde_json::json!({
            "kind": "get",
            "publicKey": { "challenge": b64url(b"c"), "rpId": "google.com" }
        });
        let plan = plan_get(&https("accounts.google.com"), get_request(request), &store).unwrap();
        let ids: Vec<_> = plan
            .candidates
            .iter()
            .map(|passkey| passkey.id.as_str())
            .collect();
        assert_eq!(ids, ["new", "old"]);

        let request = serde_json::json!({
            "kind": "get",
            "publicKey": {
                "challenge": b64url(b"c"),
                "rpId": "google.com",
                "allowCredentials": [{ "type": "public-key", "id": "old" }],
            }
        });
        let plan = plan_get(&https("accounts.google.com"), get_request(request), &store).unwrap();
        assert_eq!(plan.candidates.len(), 1);
        let message = assertion_message(&plan);
        assert_eq!(message.len(), 37 + 32);
        assert_eq!(message[32], FLAGS_UP_UV);
        let reply: serde_json::Value =
            serde_json::from_str(&finish_get(&plan, &plan.candidates[0], b"sig")).unwrap();
        assert_eq!(reply["response"]["userHandle"], b64url(b"a"));
        assert_eq!(reply["response"]["signature"], b64url(b"sig"));
        let client: serde_json::Value = serde_json::from_slice(
            &from_b64url(reply["response"]["clientDataJSON"].as_str().unwrap()).unwrap(),
        )
        .unwrap();
        assert_eq!(client["type"], "webauthn.get");
        assert_eq!(client["origin"], "https://accounts.google.com");
    }

    #[test]
    fn only_accounts_that_read_the_same_carry_a_date() {
        let candidates = [
            stored("a", "x.com", "me", 1),
            stored("b", "x.com", "you", 2),
            stored("c", "x.com", "me", 3),
        ];
        let labels = picker_labels(&candidates, |created| format!("day {created}"));
        assert_eq!(labels, ["me · day 1", "you", "me · day 3"]);
    }

    #[test]
    fn a_message_carries_its_id_beside_the_request() {
        let envelope: Envelope =
            serde_json::from_value(serde_json::json!({ "kind": "cancel", "id": 7 })).unwrap();
        assert_eq!(envelope.id, 7);
        assert!(matches!(envelope.request, Request::Cancel));
        let envelope: Envelope = serde_json::from_value(serde_json::json!({
            "kind": "get", "id": 8, "publicKey": { "challenge": "AQ" }
        }))
        .unwrap();
        assert!(matches!(envelope.request, Request::Get { .. }));
    }

    #[test]
    fn a_challenge_must_be_base64url() {
        let request = serde_json::json!({
            "kind": "get",
            "publicKey": { "challenge": "not base64!" }
        });
        assert_eq!(
            plan_get(&https("x.com"), get_request(request), &Store::default()).unwrap_err(),
            Failure::Type
        );
    }

    #[test]
    fn prompts_are_written_in_every_language() {
        for language in [
            UiLanguage::English,
            UiLanguage::SimplifiedChinese,
            UiLanguage::TraditionalChinese,
        ] {
            assert!(prompt_reason(true, "x.com", language).contains("x.com"));
            assert!(prompt_reason(false, "x.com", language).contains("x.com"));
            let (title, accept, cancel) = picker_text("x.com", language);
            assert!(title.contains("x.com") && accept != cancel);
            let (title, line, button) = missing_text("x.com", language);
            assert!(title.contains("x.com") && !line.is_empty() && !button.is_empty());
            let (title, button) = existing_text("x.com", language);
            assert!(title.contains("x.com") && !button.is_empty());
        }
    }

    #[test]
    fn leaves_out_private_windows_and_ones_that_accept_any_certificate() {
        assert!(enabled(false, false));
        assert!(!enabled(true, false));
        assert!(!enabled(false, true));
    }
}
