import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('macOS proxy feature', () => {
  it('keeps the Tauri proxy API behind the package feature gate', () => {
    const manifestPath = path.join(process.cwd(), 'src-tauri', 'Cargo.toml');
    const manifest = fs.readFileSync(manifestPath, 'utf8');
    const dependencies = manifest.slice(
      manifest.indexOf('[dependencies]'),
      manifest.indexOf('[target.'),
    );
    const packageFeatures = manifest.slice(
      manifest.indexOf('[features]'),
      manifest.indexOf('[profile.'),
    );

    expect(dependencies).not.toMatch(/^\s*"macos-proxy",?$/m);
    expect(packageFeatures).toMatch(
      /^macos-proxy = \["tauri\/macos-proxy"\]$/m,
    );
  });
});
