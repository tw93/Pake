import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const rustRoot = path.join(process.cwd(), 'src-tauri', 'src');
const read = (relative: string) =>
  // A Windows checkout has CRLF line endings; the patterns below are written for LF.
  fs.readFileSync(path.join(rustRoot, relative), 'utf8').replace(/\r\n/g, '\n');

describe('macOS title bar navigation buttons', () => {
  it('is a macOS-only module, installed from the one window builder when asked', () => {
    const modules = read('app/mod.rs');
    expect(modules).toMatch(
      /#\[cfg\(target_os = "macos"\)\]\npub mod nav_buttons;/,
    );

    const window = read('app/window.rs');
    const start = window.indexOf('fn build_window(');
    const end = window.indexOf('\n}\n', start);
    const builder = window.slice(start, end);
    expect(builder).toMatch(
      /#\[cfg\(target_os = "macos"\)\]\s+if window_config\.navigation_buttons \{\s+crate::app::nav_buttons::install\(app, &window\);/,
    );
  });

  it('is off unless the config asks for it', () => {
    const config = read('app/config.rs');
    expect(config).toMatch(
      /#\[serde\(default\)\]\s+pub navigation_buttons: bool,/,
    );
    const defaults = JSON.parse(
      fs.readFileSync(
        path.join(process.cwd(), 'src-tauri', 'pake.json'),
        'utf8',
      ),
    );
    expect(defaults.windows[0].navigation_buttons).toBeUndefined();
  });

  it('steps history natively and follows the webview by key-value observing', () => {
    const buttons = read('app/nav_buttons.rs');
    // The same native step as the Navigation menu, so a blank error page works.
    expect(buttons).toContain('history_step(window, back);');
    expect(buttons).not.toMatch(/eval\(/);
    // Enabled state comes from WebKit's observable properties, not a timer.
    expect(buttons).toContain(
      'const HISTORY_KEYS: [&str; 2] = ["canGoBack", "canGoForward"];',
    );
    expect(buttons).toContain('addObserver: observer_ptr');
    expect(buttons).not.toMatch(/NSTimer|scheduledTimer/);
  });

  it('stops observing when the window closes, while the webview is alive', () => {
    const buttons = read('app/nav_buttons.rs');
    // A webview that owns its observer is already deallocating when the
    // observer drops, so removal there never runs; the close is the last
    // moment it can.
    expect(buttons).toContain(
      '("NSWindowWillCloseNotification", sel!(pakeWindowWillClose:))',
    );
    const close = buttons.indexOf('fn window_will_close(');
    expect(buttons.slice(close, close + 200)).toContain(
      'self.stop_observing();',
    );
    // Removing an unregistered observer raises, so one flag guards it.
    const stop = buttons.indexOf('fn stop_observing(');
    expect(buttons.slice(stop, stop + 200)).toContain(
      'if !ivars.observing.replace(false) {',
    );
  });

  it('aligns to the close button and draws its own centred chevrons', () => {
    const buttons = read('app/nav_buttons.rs');
    expect(buttons).toContain('standardWindowButton: 0usize');
    // A system symbol sits on a text baseline, 1.5 points above the lights.
    expect(buttons).not.toMatch(/imageWithSystemSymbolName/);
    // Where AppKit sets the image inside the button is read, not assumed.
    expect(buttons).toContain('imageRectForBounds: bounds');
    expect(buttons).not.toMatch(/GLYPH_DROP/);
    // The title bar is laid out again on resize and around full screen.
    for (const name of [
      'NSWindowDidResizeNotification',
      'NSWindowDidEnterFullScreenNotification',
      'NSWindowDidExitFullScreenNotification',
    ]) {
      expect(buttons).toContain(`"${name}"`);
    }
    // NSLayoutAttributeLeading puts the accessory right after the lights.
    expect(buttons).toContain('setLayoutAttribute: 5isize');
  });
});
