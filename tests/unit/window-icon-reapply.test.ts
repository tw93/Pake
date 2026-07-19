import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const rustRoot = path.join(process.cwd(), 'src-tauri', 'src');
const windowSource = fs.readFileSync(
  path.join(rustRoot, 'app', 'window.rs'),
  'utf8',
);
const visibilitySources = [
  path.join(rustRoot, 'lib.rs'),
  path.join(rustRoot, 'app', 'setup.rs'),
  path.join(rustRoot, 'app', 'window.rs'),
].map((source) => fs.readFileSync(source, 'utf8'));

describe('Windows taskbar icon reapplication', () => {
  it('targets the large taskbar icon instead of only the small window icon', () => {
    expect(windowSource).toContain('ExtractIconExW');
    expect(windowSource).toContain('WM_SETICON');
    expect(windowSource).toContain('ICON_BIG');
  });

  it('reapplies the icon after every explicit window show', () => {
    for (const source of visibilitySources) {
      const shows = [...source.matchAll(/let _ = (\w+)\.show\(\);/g)];
      for (const show of shows) {
        const followingSource = source.slice(
          (show.index ?? 0) + show[0].length,
          (show.index ?? 0) + show[0].length + 160,
        );
        expect(followingSource).toContain(`reapply_window_icon(&${show[1]});`);
      }
    }
  });
});
