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

const downloadFunction = () =>
  invokeSource.slice(
    invokeSource.indexOf('pub async fn download_file'),
    invokeSource.indexOf('pub fn send_notification'),
  );

describe('download HTTP status handling', () => {
  it('rejects non-success HTTP responses before writing the file', () => {
    expect(invokeSource).toContain('res.status().is_success()');
    expect(invokeSource).toMatch(
      /if !res\.status\(\)\.is_success\(\) \{[\s\S]*?MessageType::Failure/,
    );
    // File creation must come after the status gate so 403 bodies are not saved.
    const downloadFn = downloadFunction();
    const statusIdx = downloadFn.indexOf('res.status().is_success()');
    const createIdx = downloadFn.indexOf('create_unique_file(path_str)');
    expect(statusIdx).toBeGreaterThan(-1);
    expect(createIdx).toBeGreaterThan(statusIdx);
  });

  it('reports download directory failure when the file cannot be created', () => {
    const start = invokeSource.indexOf(
      'create_unique_file(path_str).await.map_err(|e| {',
    );
    const end = invokeSource.indexOf('})?;', start);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    expect(invokeSource.slice(start, end)).toMatch(
      /show_toast\(\s*&window,\s*&get_download_message_with_lang\(\s*MessageType::DirectoryFailure,/,
    );
  });

  it('reserves the destination atomically so concurrent downloads never share a file', () => {
    const helper = invokeSource.slice(
      invokeSource.indexOf('async fn create_unique_file('),
      invokeSource.indexOf('pub async fn download_file'),
    );
    expect(helper).toContain('.create_new(true)');
    expect(helper).toContain('ErrorKind::AlreadyExists');
  });

  it('reports disk write failures and removes the partial file', () => {
    const downloadFn = downloadFunction();
    expect(downloadFn).toMatch(
      /file\.write_all\(&chunk\)\s*\.await\s*\.map_err\(\|e\| \(true,/,
    );
    expect(downloadFn).toMatch(
      /\.chunk\(\)\s*\.await\s*\.map_err\(\|e\| \(false,/,
    );
    const failure = downloadFn.slice(
      downloadFn.indexOf('if let Err((disk_failure, error)) = written {'),
      downloadFn.indexOf('return Err(error);'),
    );
    expect(failure).toContain('tokio::fs::remove_file(&file_path).await');
    expect(failure).toMatch(
      /if disk_failure \{\s*show_toast\(\s*&window,\s*&get_download_message_with_lang\(\s*MessageType::DirectoryFailure,/,
    );
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

  it('waits for the final asynchronous disk write before reporting success', () => {
    const downloadFn = downloadFunction();
    const flush = downloadFn.search(/file\.flush\(\)\s*\.await/);
    expect(flush).toBeGreaterThan(downloadFn.indexOf('file.write_all(&chunk)'));
    expect(flush).toBeLessThan(downloadFn.indexOf('MessageType::Success'));
    expect(downloadFn.slice(flush, flush + 200)).toMatch(
      /\.map_err\(\|e\| \(true,/,
    );
  });
});
