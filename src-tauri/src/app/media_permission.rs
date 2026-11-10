//! Camera and microphone for pages on Linux.
//!
//! WebKitGTK refuses `getUserMedia` unless the embedder answers its
//! `permission-request` signal, and neither wry nor Pake did, so a call or
//! voice page never got a device. Linux has no system prompt for this as
//! macOS and WebView2 do, so Pake asks once per site and run.

use gtk::prelude::*;
use std::cell::RefCell;
use std::collections::HashMap;
use webkit2gtk::{
    DeviceInfoPermissionRequest, PermissionRequestExt, SettingsExt, UserMediaPermissionRequest,
    UserMediaPermissionRequestExt, WebViewExt,
};

thread_local! {
    /// The answers given in this run, by host and device kinds.
    static ANSWERS: RefCell<HashMap<String, bool>> = RefCell::new(HashMap::new());
}

pub fn install(webview: &tauri::webview::PlatformWebview) {
    let gtk_webview = webview.inner();
    if let Some(settings) = WebViewExt::settings(&gtk_webview) {
        settings.set_enable_media_stream(true);
        settings.set_enable_webrtc(true);
    }

    gtk_webview.connect_permission_request(|webview, request| {
        let host = webview
            .uri()
            .and_then(|uri| tauri::Url::parse(uri.as_str()).ok())
            .and_then(|url| url.host_str().map(str::to_owned))
            .unwrap_or_default();

        // Device labels in enumerateDevices follow what the site was already allowed.
        if request.is::<DeviceInfoPermissionRequest>() {
            if host_was_allowed(&host) {
                request.allow();
            } else {
                request.deny();
            }
            return true;
        }

        let Some(media) = request.downcast_ref::<UserMediaPermissionRequest>() else {
            return false;
        };
        let audio = media.is_for_audio_device();
        let video = media.is_for_video_device();
        let key = answer_key(&host, audio, video);
        if let Some(allowed) = ANSWERS.with(|answers| answers.borrow().get(&key).copied()) {
            answer(request, allowed);
            return true;
        }

        let parent = webview
            .toplevel()
            .and_then(|widget| widget.downcast::<gtk::Window>().ok());
        let (question, deny, allow) = prompt_text(
            &host,
            audio,
            video,
            crate::util::UiLanguage::system() != crate::util::UiLanguage::English,
        );
        let dialog = gtk::MessageDialog::new(
            parent.as_ref(),
            gtk::DialogFlags::MODAL | gtk::DialogFlags::DESTROY_WITH_PARENT,
            gtk::MessageType::Question,
            gtk::ButtonsType::None,
            &question,
        );
        dialog.add_button(deny, gtk::ResponseType::Reject);
        dialog.add_button(allow, gtk::ResponseType::Accept);
        let request = request.clone();
        // The request is answered once: destroying the dialog raises no second response, where
        // close() would send a delete-event and with it another one.
        let answered = std::cell::Cell::new(false);
        dialog.connect_response(move |dialog, response| {
            if answered.replace(true) {
                return;
            }
            // Closing the dialog without choosing is a refusal that is asked again next time.
            if matches!(
                response,
                gtk::ResponseType::Accept | gtk::ResponseType::Reject
            ) {
                let allowed = response == gtk::ResponseType::Accept;
                ANSWERS.with(|answers| answers.borrow_mut().insert(key.clone(), allowed));
                answer(&request, allowed);
            } else {
                request.deny();
            }
            unsafe { dialog.destroy() };
        });
        dialog.show();
        true
    });
}

fn answer(request: &webkit2gtk::PermissionRequest, allowed: bool) {
    if allowed {
        request.allow();
    } else {
        request.deny();
    }
}

fn host_was_allowed(host: &str) -> bool {
    let prefix = format!("{host}|");
    ANSWERS.with(|answers| {
        answers
            .borrow()
            .iter()
            .any(|(key, allowed)| *allowed && key.starts_with(&prefix))
    })
}

pub(crate) fn answer_key(host: &str, audio: bool, video: bool) -> String {
    format!("{host}|{}{}", u8::from(audio), u8::from(video))
}

/// The question and its two buttons, refusal first.
pub(crate) fn prompt_text(
    host: &str,
    audio: bool,
    video: bool,
    chinese: bool,
) -> (String, &'static str, &'static str) {
    if chinese {
        let devices = match (audio, video) {
            (true, true) => "摄像头和麦克风",
            (false, true) => "摄像头",
            _ => "麦克风",
        };
        (format!("{host} 想使用{devices}"), "不允许", "允许")
    } else {
        let devices = match (audio, video) {
            (true, true) => "camera and microphone",
            (false, true) => "camera",
            _ => "microphone",
        };
        (
            format!("{host} wants to use your {devices}"),
            "Don't Allow",
            "Allow",
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_prompt_names_the_site_and_only_the_devices_asked_for() {
        assert_eq!(
            prompt_text("meet.google.com", true, true, false).0,
            "meet.google.com wants to use your camera and microphone"
        );
        assert_eq!(
            prompt_text("chatgpt.com", true, false, false).0,
            "chatgpt.com wants to use your microphone"
        );
        assert_eq!(
            prompt_text("meet.google.com", false, true, true),
            ("meet.google.com 想使用摄像头".to_string(), "不允许", "允许")
        );
    }

    #[test]
    fn an_answer_is_kept_per_site_and_device_kinds() {
        assert_ne!(
            answer_key("a.example", true, false),
            answer_key("a.example", true, true)
        );
        assert_ne!(
            answer_key("a.example", true, true),
            answer_key("b.example", true, true)
        );
    }
}
