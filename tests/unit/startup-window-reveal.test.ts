import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const libSource = fs.readFileSync(
  path.join(process.cwd(), 'src-tauri', 'src', 'lib.rs'),
  'utf8',
);

describe('startup window reveal', () => {
  it('waits for the first real page finish instead of a fixed short delay', () => {
    expect(libSource).toContain('.on_page_load(');
    expect(libSource).toContain('PageLoadEvent::Finished');
    expect(libSource).toContain('revealed.swap(true');
    expect(libSource).toContain('STARTUP_WINDOW_FALLBACK_DELAY');
    expect(libSource).toContain('is_placeholder_startup_url');
    expect(libSource).toMatch(
      /if !start_to_tray \{[\s\S]*?app_builder = app_builder\.on_page_load/,
    );
    expect(libSource).not.toContain('WINDOW_SHOW_DELAY');
  });

  it('does not treat about:blank as a ready first paint', () => {
    expect(libSource).toMatch(/is_placeholder_startup_url\(payload\.url\(\)\)/);
    expect(libSource).toMatch(
      /url\.scheme\(\)\.eq_ignore_ascii_case\("about"\)/,
    );
  });
});
