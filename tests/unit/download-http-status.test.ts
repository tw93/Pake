import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const invokeSource = fs.readFileSync(
  path.join(process.cwd(), 'src-tauri', 'src', 'app', 'invoke.rs'),
  'utf8',
);

const eventSource = fs.readFileSync(
  path.join(process.cwd(), 'src-tauri', 'src', 'inject', 'event.js'),
  'utf8',
);

describe('download HTTP status handling', () => {
  it('rejects non-success HTTP responses before writing the file', () => {
    expect(invokeSource).toContain('res.status().is_success()');
    expect(invokeSource).toMatch(
      /if !res\.status\(\)\.is_success\(\) \{[\s\S]*?MessageType::Failure/,
    );
    // File creation must come after the status gate so 403 bodies are not saved.
    const statusIdx = invokeSource.indexOf('res.status().is_success()');
    const createIdx = invokeSource.indexOf('File::create');
    expect(statusIdx).toBeGreaterThan(-1);
    expect(createIdx).toBeGreaterThan(statusIdx);
  });

  it('keeps download path heuristics narrow (no SPA roots)', () => {
    const patternsBlock = eventSource.match(
      /const DOWNLOAD_PATH_PATTERNS = \[([\s\S]*?)\];/,
    )?.[1];
    expect(patternsBlock).toBeTruthy();
    expect(patternsBlock).not.toContain('/assets/');
    expect(patternsBlock).not.toContain('/dist/');
    expect(patternsBlock).not.toContain('/files/');
    expect(patternsBlock).not.toContain('/attachments/');
    expect(patternsBlock).not.toContain('/releases/');
    expect(patternsBlock).toContain('/download/');
  });

  it('toasts download progress on the calling window, not a hard-coded main label', () => {
    // The command must accept the invoker WebviewWindow so secondary windows
    // see their own toast instead of failing with "Window not found".
    const downloadFn = invokeSource.slice(
      invokeSource.indexOf('pub async fn download_file'),
      invokeSource.indexOf('pub fn send_notification'),
    );
    expect(downloadFn).toMatch(/window: WebviewWindow/);
    expect(downloadFn).not.toContain('get_webview_window("pake")');
  });

  it('attaches webview cookies to authenticated HTTP downloads', () => {
    expect(invokeSource).toContain('cookie_header_for_url');
    expect(invokeSource).toContain('cookies_for_url');
    expect(invokeSource).toContain('COOKIE');
  });
});
