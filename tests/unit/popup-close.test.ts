import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const rustRoot = path.join(process.cwd(), 'src-tauri', 'src');
const read = (relative: string) =>
  // A Windows checkout has CRLF line endings; the patterns below are written for LF.
  fs.readFileSync(path.join(rustRoot, relative), 'utf8').replace(/\r\n/g, '\n');

const buildWindow = () => {
  const window = read('app/window.rs');
  const start = window.indexOf('fn build_window(');
  return window.slice(start, window.indexOf('\n}\n', start));
};

describe('a popup its page closes', () => {
  it('closes on macOS, where WKWebView only tells its UI delegate', () => {
    expect(read('app/mod.rs')).toMatch(
      /#\[cfg\(target_os = "macos"\)\]\npub mod popup_close;/,
    );
    expect(buildWindow()).toMatch(
      /#\[cfg\(target_os = "macos"\)\]\s+if page_popup \{[\s\S]+?crate::app::popup_close::install\(&popup_app, &popup_label, &webview\);/,
    );

    const close = read('app/popup_close.rs');
    expect(close).toContain('c"webViewDidClose:"');
    expect(close).toContain('if class.instance_method(selector).is_none() {');
    // WebKit caches which methods a delegate answers when it is set.
    const added = close.indexOf('class_addMethod(');
    const reset = close.indexOf('msg_send![view, setUIDelegate: none]');
    const restored = close.indexOf(
      'msg_send![view, setUIDelegate: &*delegate]',
    );
    expect(added).toBeGreaterThan(-1);
    expect(reset).toBeGreaterThan(added);
    expect(restored).toBeGreaterThan(reset);
  });

  it('leaves the main window and Cmd+N windows open on macOS', () => {
    const close = read('app/popup_close.rs');
    // WebKit sends webViewDidClose: for any page that calls window.close();
    // only a webview marked as a popup has a label to close.
    const marked = close.indexOf('objc2::ffi::objc_getAssociatedObject(');
    const unmarked = close.indexOf('None => return,');
    const closed = close.indexOf('if let Err(error) = window.close() {');
    expect(marked).toBeGreaterThan(-1);
    expect(unmarked).toBeGreaterThan(marked);
    expect(closed).toBeGreaterThan(unmarked);
  });

  it('hides the popup at once and closes it after its page load has settled', () => {
    const close = read('app/popup_close.rs');
    // Destroying the web view under an IPC answer aborts the app: WebKit
    // raises on a stopped request and the release profile cannot catch it.
    const hidden = close.indexOf('if let Err(error) = window.hide() {');
    const waited = close.indexOf('tokio::time::sleep(CLOSE_GRACE).await;');
    const closed = close.indexOf('if let Err(error) = window.close() {');
    expect(hidden).toBeGreaterThan(-1);
    expect(waited).toBeGreaterThan(hidden);
    expect(closed).toBeGreaterThan(waited);
    expect(buildWindow()).toMatch(
      /#\[cfg\(any\(target_os = "macos", target_os = "windows"\)\)\]\s+let page_popup = new_window_features\.is_some\(\);/,
    );
  });

  it('closes the window on Windows, where Wry destroys only the web view', () => {
    // The popup had answered its opener and stayed on screen, empty.
    expect(buildWindow()).toMatch(
      /#\[cfg\(target_os = "windows"\)\]\s+if page_popup \{[\s\S]+?core\.add_WindowCloseRequested\([\s\S]+?if let Err\(error\) = popup\.close\(\)/,
    );
  });

  it('keeps page-opened popups out of the saved window sizes', () => {
    const window = read('app/window.rs');
    expect(window).toContain(
      'pub const POPUP_WINDOW_LABEL_PREFIX: &str = "pake-popup-";',
    );
    const start = window.indexOf('fn open_requested_window(');
    expect(window.slice(start, window.indexOf('\n}\n', start))).toContain(
      'let label = state.next_popup_label();',
    );
    // A Cmd+N window that later takes a popup's label would open at the
    // popup's size, and a sign-in popup would ignore the size its page asked for.
    expect(read('lib.rs')).toContain(
      '.with_filter(|label| !label.starts_with(app::window::POPUP_WINDOW_LABEL_PREFIX))',
    );
  });

  it('takes its page title, since a popup that starts blank has none', () => {
    expect(buildWindow()).toMatch(
      /window_features\(features\)\.focused\(true\);[\s\S]{0,260}window_builder\.on_document_title_changed\(/,
    );
    const window = read('app/window.rs');
    const start = window.indexOf('fn open_requested_window(');
    const body = window.slice(start, window.indexOf('\n}\n', start));
    expect(body).toContain('if let Some(host) = target_url.host_str() {');
    expect(body).not.toContain('target_url.as_str()');
  });
});
