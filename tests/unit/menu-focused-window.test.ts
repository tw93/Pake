import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('macOS menu window targeting', () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), 'src-tauri/src/app/menu.rs'),
    'utf8',
  );
  const handler = source.slice(source.indexOf('pub fn handle_menu_click'));

  it('routes window commands through the focused webview helper', () => {
    expect(source).toContain('fn focused_webview_window');
    expect(source).toContain('window.is_focused()');
    expect(handler).not.toContain('get_webview_window("pake")');
    expect(handler).toContain('focused_webview_window(app_handle)');
  });

  it('uses native reload and history so error pages stay operable', () => {
    // Blank WebView error shells have no JS context; eval-based navigation
    // is a no-op exactly when the user is stuck (#1328 class).
    expect(handler).toContain('reload_window(&window)');
    expect(handler).not.toContain('window.location.reload()');
    expect(handler).toContain('history_step(&window, true)');
    expect(handler).toContain('history_step(&window, false)');
    expect(handler).not.toContain('window.history.back()');
    expect(handler).not.toContain('window.history.forward()');
  });

  it('copies the native webview URL without requiring page JS', () => {
    expect(handler).toContain('window.url()');
    expect(handler).toContain('copy_text_to_pasteboard');
    expect(handler).not.toContain(
      'navigator.clipboard.writeText(window.location.href)',
    );
  });
});
