import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const rustRoot = path.join(process.cwd(), 'src-tauri', 'src');
const read = (relative: string) =>
  // A Windows checkout has CRLF line endings; the patterns below are written for LF.
  fs.readFileSync(path.join(rustRoot, relative), 'utf8').replace(/\r\n/g, '\n');

describe('a page whose web content process died on macOS', () => {
  it('is reloaded, within the same limit as on Windows and Linux', () => {
    // Tauri 2.12 reloads without a limit unless the app sets this hook, and
    // a second reload of its own would follow the one made here.
    const recovery = read('app/recovery.rs');
    const start = recovery.indexOf('pub fn on_web_process_terminated<');
    const body = recovery.slice(start, recovery.indexOf('\n}\n', start));
    const limited = body.indexOf('!reload_allowed()');
    const reloaded = body.indexOf('webview.reload()');
    expect(limited).toBeGreaterThan(-1);
    expect(reloaded).toBeGreaterThan(limited);
    expect(recovery).not.toContain('method_setImplementation');

    expect(read('lib.rs')).toMatch(
      /#\[cfg\(target_os = "macos"\)\]\s+let tauri_app = tauri_app\.on_web_content_process_terminate\(\|webview\| \{\s+app::recovery::on_web_process_terminated\(webview\);/,
    );
  });

  it('never asks Wry for the URL of a web view that has none', () => {
    // Wry unwraps WKWebView's URL, which is nil once the process has died:
    // quitting an app whose page had gone white aborted it.
    const window = read('app/window.rs');
    const start = window.indexOf('pub fn page_url(');
    const body = window.slice(start, window.indexOf('\n}\n', start));
    const asked = body.indexOf('objc2::msg_send![view, URL]');
    const refused = body.indexOf('return None;');
    const read_url = body.indexOf('window.url().ok()');
    expect(asked).toBeGreaterThan(-1);
    expect(refused).toBeGreaterThan(asked);
    expect(read_url).toBeGreaterThan(refused);

    // Every reader goes through it.
    expect(window.split('window.url().ok()').length - 1).toBe(1);
    for (const file of ['app/menu.rs', 'app/invoke.rs', 'lib.rs']) {
      expect(read(file), file).not.toContain('window.url()');
    }
  });
});
