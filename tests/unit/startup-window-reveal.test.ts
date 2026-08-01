import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const libSource = fs.readFileSync(
  path.join(process.cwd(), 'src-tauri', 'src', 'lib.rs'),
  'utf8',
);

describe('startup window reveal', () => {
  it('waits for the initial page to finish instead of exposing a blank webview', () => {
    expect(libSource).toContain('.on_page_load(');
    expect(libSource).toContain('PageLoadEvent::Finished');
    expect(libSource).toContain('revealed.swap(true');
    expect(libSource).toContain('STARTUP_WINDOW_FALLBACK_DELAY');
    expect(libSource).toMatch(
      /if !start_to_tray \{[\s\S]*?app_builder = app_builder\.on_page_load/,
    );
    expect(libSource).not.toContain('WINDOW_SHOW_DELAY');
  });
});
