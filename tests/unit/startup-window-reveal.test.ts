import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const libSource = fs.readFileSync(
  path.join(process.cwd(), 'src-tauri', 'src', 'lib.rs'),
  'utf8',
);
const setupSource = fs.readFileSync(
  path.join(process.cwd(), 'src-tauri', 'src', 'app', 'setup.rs'),
  'utf8',
);

describe('startup window reveal', () => {
  it('waits for the first real page finish instead of a fixed short delay', () => {
    expect(libSource).toContain('.on_page_load(');
    expect(libSource).toContain('PageLoadEvent::Finished');
    expect(libSource).toContain('claim_startup_reveal');
    expect(libSource).toContain('STARTUP_WINDOW_FALLBACK_DELAY');
    expect(libSource).toContain('is_placeholder_startup_url');
    // Main window still respects start_to_tray; secondary multi-window labels
    // share the same page-load hook via reveal_built_window.
    expect(libSource).toContain('if start_to_tray');
    expect(libSource).toContain('reveal_built_window');
    expect(libSource).toContain('label.starts_with("pake-")');
    expect(libSource).not.toContain('WINDOW_SHOW_DELAY');
  });

  it('does not treat about:blank as a ready first paint', () => {
    expect(libSource).toMatch(/is_placeholder_startup_url\(payload\.url\(\)\)/);
    expect(libSource).toMatch(
      /url\.scheme\(\)\.eq_ignore_ascii_case\("about"\)/,
    );
  });

  it('cancels automatic reveal when the user controls visibility during startup', () => {
    expect(libSource).toContain('cancel_startup_reveal');
    expect(libSource).toMatch(
      /user_show_then_hide_blocks_automatic_startup_reveal/,
    );
    // Tray, shortcut, second-instance, hide-on-close, and dock reopen.
    expect(setupSource).toMatch(/cancel_startup_reveal\(&menu_revealed\)/);
    expect(setupSource).toMatch(/cancel_startup_reveal\(&click_revealed\)/);
    expect(setupSource).toMatch(/cancel_startup_reveal\(&startup_revealed\)/);
    expect(libSource).toMatch(/cancel_startup_reveal\(&instance_revealed\)/);
    expect(libSource).toMatch(/cancel_startup_reveal\(&close_revealed\)/);
  });
});
