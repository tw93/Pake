import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const windowSource = fs.readFileSync(
  path.join(process.cwd(), 'src-tauri/src/app/window.rs'),
  'utf8',
);
const setupSource = fs.readFileSync(
  path.join(process.cwd(), 'src-tauri/src/app/setup.rs'),
  'utf8',
);
const invokeSource = fs.readFileSync(
  path.join(process.cwd(), 'src-tauri/src/app/invoke.rs'),
  'utf8',
);
const libSource = fs.readFileSync(
  path.join(process.cwd(), 'src-tauri/src/lib.rs'),
  'utf8',
);
const eventSource = fs.readFileSync(
  path.join(process.cwd(), 'src-tauri/src/inject/event.js'),
  'utf8',
);

describe('multi-window visibility control', () => {
  it('exposes hide/show/toggle helpers over every webview window', () => {
    expect(windowSource).toContain('pub fn hide_all_app_windows');
    expect(windowSource).toContain('pub fn show_all_app_windows');
    expect(windowSource).toContain('pub fn toggle_all_app_windows');
    expect(windowSource).toContain('app.webview_windows()');
  });

  it('routes tray hide/show/click and activation shortcut through multi-window helpers', () => {
    expect(setupSource).toContain('hide_all_app_windows(app)');
    expect(setupSource).toContain(
      'show_all_app_windows(app, _init_fullscreen)',
    );
    expect(setupSource).toContain(
      'toggle_all_app_windows(tray.app_handle(), _init_fullscreen)',
    );
    expect(setupSource).toContain(
      'toggle_all_app_windows(app, _init_fullscreen)',
    );
    // Must not only touch the main label for hide/show menu items.
    const hideBranch = setupSource.slice(
      setupSource.indexOf('"hide_app"'),
      setupSource.indexOf('"show_app"'),
    );
    expect(hideBranch).not.toContain('get_webview_window("pake")');
  });
});

describe('native webview navigation IPC', () => {
  it('registers webview_navigate for reload/back/forward', () => {
    expect(invokeSource).toContain('pub fn webview_navigate');
    expect(invokeSource).toContain('reload_window(&window)');
    expect(invokeSource).toContain('history_step(&window, true)');
    expect(invokeSource).toContain('history_step(&window, false)');
    expect(libSource).toContain('webview_navigate');
  });

  it('routes Ctrl shortcut reload/back/forward through native navigate', () => {
    expect(eventSource).toContain('function nativeNavigate(action)');
    expect(eventSource).toContain('invoke("webview_navigate", { action })');
    expect(eventSource).toContain('nativeNavigate("reload")');
    expect(eventSource).toContain('nativeNavigate("back")');
    expect(eventSource).toContain('nativeNavigate("forward")');
    // Top-level shortcuts must not call page APIs directly.
    expect(eventSource).not.toMatch(
      /const shortcuts = \{[\s\S]*?window\.location\.reload\(\)/,
    );
    expect(eventSource).not.toMatch(
      /const shortcuts = \{[\s\S]*?window\.history\.back\(\)/,
    );
  });
});
