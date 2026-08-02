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

  it('no longer treats /assets/ as a download path heuristic', () => {
    const patternsBlock = eventSource.match(
      /const DOWNLOAD_PATH_PATTERNS = \[([\s\S]*?)\];/,
    )?.[1];
    expect(patternsBlock).toBeTruthy();
    expect(patternsBlock).not.toContain('/assets/');
    expect(patternsBlock).not.toContain('/dist/');
    expect(patternsBlock).toContain('/download/');
    expect(patternsBlock).toContain('/files/');
    expect(patternsBlock).toContain('/attachments/');
  });
});
