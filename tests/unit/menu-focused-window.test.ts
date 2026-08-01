import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('macOS menu window targeting', () => {
  it('routes window commands through the focused webview helper', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'src-tauri/src/app/menu.rs'),
      'utf8',
    );
    const handler = source.slice(source.indexOf('pub fn handle_menu_click'));

    expect(source).toContain('fn focused_webview_window');
    expect(source).toContain('window.is_focused()');
    expect(handler).not.toContain('get_webview_window("pake")');
    expect(handler).toContain('focused_webview_window(app_handle)');
  });
});
