import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const rustRoot = path.join(process.cwd(), 'src-tauri', 'src');
const setupSource = fs.readFileSync(
  path.join(rustRoot, 'app', 'setup.rs'),
  'utf8',
);
const windowSource = fs.readFileSync(
  path.join(rustRoot, 'app', 'window.rs'),
  'utf8',
);

describe('tray click toggle (#1343)', () => {
  it('acts on one edge of the click, not both', () => {
    // Windows emits TrayIconEvent::Click twice per physical click, Down then
    // Up. Matching on button alone runs the toggle twice, so a hidden window is
    // shown and immediately re-hidden.
    const handler = setupSource.slice(
      setupSource.indexOf('.on_tray_icon_event('),
    );
    expect(handler).toContain('button_state');
    expect(handler).toMatch(/button_state\s*==\s*MouseButtonState::Up/);
  });

  it('gives a menu-bar-only Mac app the window on left click', () => {
    // With no Dock icon the menu bar icon is the only way back to the window,
    // so there the left click toggles it and the menu moves to a right click.
    // Every other app keeps the menu on left click.
    expect(setupSource).toMatch(
      /\.show_menu_on_left_click\(!left_click_toggles_window\)/,
    );
    const libSource = fs.readFileSync(path.join(rustRoot, 'lib.rs'), 'utf8');
    const call = libSource.slice(libSource.indexOf('set_system_tray('));
    expect(call.slice(0, call.indexOf(')?;'))).toMatch(
      /cfg!\(target_os = "macos"\) && pake_config\.hides_dock_icon\(\)/,
    );
  });

  it('treats a minimized window as not on screen', () => {
    // hide_on_close minimizes before hiding, and Windows keeps IsWindowVisible
    // true while a window is iconic. Without the is_minimized check the toggle
    // reads a minimized window as visible and hides it instead of restoring it.
    const fn = windowSource.slice(
      windowSource.indexOf('pub fn any_app_window_visible'),
      windowSource.indexOf('pub fn hide_all_app_windows'),
    );
    expect(fn).toMatch(/!window\.is_minimized\(\)\.unwrap_or\(false\)/);
  });

  it('clears the iconic state on every restore path', () => {
    // Tray menu Show, tray click, and the activation shortcut all restore
    // through show_all_app_windows, so unminimize has to live there.
    const fn = windowSource.slice(
      windowSource.indexOf('pub fn show_all_app_windows'),
      windowSource.indexOf('pub fn toggle_all_app_windows'),
    );
    expect(fn).toContain('unminimize()');
  });
});
