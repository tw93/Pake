import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) =>
  fs.readFileSync(path.join(process.cwd(), 'src-tauri', file), 'utf8');

describe('native IPC permission registration', () => {
  it('puts every registered app command in the Tauri ACL manifest', () => {
    const handler = read('src/lib.rs').match(
      /tauri::generate_handler!\[([^\]]+)\]/,
    )?.[1];
    const manifest = read('build.rs').match(
      /tauri_build::AppManifest::new\(\)\.commands\(&\[([^\]]+)\]\)/,
    )?.[1];
    expect(handler).toBeTruthy();
    expect(manifest).toBeTruthy();
    const commands = handler!
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean);
    const declared = [...manifest!.matchAll(/"([a-z_]+)"/g)].map(
      (match) => match[1],
    );
    for (const command of commands) expect(declared).toContain(command);
  });

  it('keeps the packaged capability local until configured origins are granted', () => {
    const capability = JSON.parse(read('capabilities/default.json'));
    expect(capability.remote).toBeUndefined();
    expect(capability.permissions).toContain('allow-download-file');
  });
});
