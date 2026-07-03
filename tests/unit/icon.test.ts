import fs from 'fs';
import path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { downloadIcon } from '@/options/icon';
import { getIconSourcePriority } from '@/utils/icon-source';

const downloadedIconPaths: string[] = [];

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();

  while (downloadedIconPaths.length > 0) {
    const iconPath = downloadedIconPaths.pop();
    if (!iconPath) {
      continue;
    }

    const tempDir = path.dirname(iconPath);
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }
});

describe('icon source priority', () => {
  it('prefers dashboard-icons for matching public subdomain products', () => {
    expect(
      getIconSourcePriority('https://notebooklm.google.com/', 'NotebookLM'),
    ).toEqual(['dashboard', 'domain']);
  });

  it('prefers dashboard-icons for local or self-hosted hosts', () => {
    expect(
      getIconSourcePriority('https://grafana.mylab.local/', 'Grafana'),
    ).toEqual(['dashboard', 'domain']);
  });

  it('keeps domain-first lookup for public root domains', () => {
    expect(getIconSourcePriority('https://github.com/', 'GitHub')).toEqual([
      'domain',
      'dashboard',
    ]);
  });
});

describe('downloadIcon', () => {
  it('accepts svg icons when the response advertises image/svg+xml', async () => {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
        <rect width="128" height="128" rx="24" fill="#0f172a" />
        <circle cx="64" cy="64" r="36" fill="#38bdf8" />
      </svg>
    `;

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {
          get: (name: string) =>
            name === 'content-type' ? 'image/svg+xml; charset=utf-8' : null,
        },
        arrayBuffer: async () => new TextEncoder().encode(svg).buffer,
      }),
    );

    const iconPath = await downloadIcon(
      'https://cdn.example.com/icons/notebooklm.svg',
      false,
      1000,
    );

    expect(iconPath).toBeTruthy();
    expect(iconPath?.endsWith('.svg')).toBe(true);

    if (iconPath) {
      downloadedIconPaths.push(iconPath);
      expect(fs.existsSync(iconPath)).toBe(true);
      expect(fs.readFileSync(iconPath, 'utf-8')).toContain('<svg');
    }
  });

  it('rejects html responses that only contain inline svg markup', async () => {
    const html = `
      <!doctype html>
      <html>
        <body>
          <svg viewBox="0 0 16 16"></svg>
        </body>
      </html>
    `;

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {
          get: (name: string) =>
            name === 'content-type' ? 'text/html; charset=utf-8' : null,
        },
        arrayBuffer: async () => new TextEncoder().encode(html).buffer,
      }),
    );

    await expect(
      downloadIcon(
        'https://cdn.example.com/icons/not-an-icon.svg',
        false,
        1000,
      ),
    ).resolves.toBeNull();
  });
});
