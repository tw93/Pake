import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const { user_agent: userAgent } = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), 'src-tauri', 'pake.json'), 'utf8'),
);

describe('default user agents', () => {
  // YouTube withholds caption tokens from a "Chrome" that runs on WebKit, so
  // captions never load in Linux apps that claim Chrome (#1406).
  it.each(['macos', 'linux'])(
    '%s claims the WebKit engine it runs on',
    (os) => {
      expect(userAgent[os]).toMatch(
        /AppleWebKit\/605\.1\.15 .*Safari\/605\.1\.15$/,
      );
      expect(userAgent[os]).not.toContain('Chrome/');
    },
  );

  it('windows claims Chromium, matching WebView2', () => {
    expect(userAgent.windows).toContain('Chrome/');
  });
});
