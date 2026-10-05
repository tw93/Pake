import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const rustRoot = path.join(process.cwd(), 'src-tauri', 'src');
const read = (relative: string) =>
  fs.readFileSync(path.join(rustRoot, relative), 'utf8');

function rustSources(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) return rustSources(full);
    return entry.name.endsWith('.rs') ? [full] : [];
  });
}

describe('macOS trackpad history gestures (#1401)', () => {
  it('turns on the native WKWebView switch, gated to macOS', () => {
    const navigation = read('app/navigation.rs');
    const helper = navigation.indexOf('pub fn enable_back_forward_gestures(');
    expect(helper).toBeGreaterThan(-1);
    expect(navigation.slice(Math.max(0, helper - 400), helper)).toMatch(
      /#\[cfg\(target_os = "macos"\)\]\s*$/,
    );
    expect(navigation).toContain(
      'msg_send![ptr, setAllowsBackForwardNavigationGestures: Bool::YES]',
    );
  });

  it('applies it to the one builder every window path goes through', () => {
    const builders = rustSources(rustRoot).filter((file) =>
      fs.readFileSync(file, 'utf8').includes('WebviewWindowBuilder::new('),
    );
    expect(builders.map((file) => path.relative(rustRoot, file))).toEqual([
      path.join('app', 'window.rs'),
    ]);

    const window = read('app/window.rs');
    const start = window.indexOf('fn build_window(');
    const end = window.indexOf('\n}\n', start);
    const body = window.slice(start, end);
    const built = body.indexOf('let window = window_builder.build()?;');
    const gesture = body.indexOf(
      'crate::app::navigation::enable_back_forward_gestures(&webview);',
    );
    expect(built).toBeGreaterThan(-1);
    expect(gesture).toBeGreaterThan(built);
    expect(body.slice(Math.max(0, gesture - 300), gesture)).toMatch(
      /#\[cfg\(target_os = "macos"\)\]\s*if let Err\(error\) = window\.with_webview\(/,
    );

    // Main window, Cmd+N clones and popups must all reach build_window.
    expect(window).toMatch(/fn build_window_with_label[\s\S]*?build_window\(/);
    expect(window).toMatch(/fn open_requested_window[\s\S]*?build_window\(/);
    expect(window).toMatch(
      /pub fn set_window[\s\S]*?build_window_with_label\(app, config, tauri_config, "pake"\)/,
    );
    expect(window).toMatch(
      /pub fn open_additional_window\([\s\S]*?build_window_with_label\(/,
    );
  });
});
