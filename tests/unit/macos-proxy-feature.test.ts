import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('macOS proxy feature', () => {
  it('keeps the Tauri proxy API behind the package feature gate', () => {
    const manifestPath = path.join(process.cwd(), 'src-tauri', 'Cargo.toml');
    const metadata = JSON.parse(
      execFileSync(
        'cargo',
        [
          'metadata',
          '--manifest-path',
          manifestPath,
          '--format-version',
          '1',
          '--no-deps',
        ],
        { encoding: 'utf8' },
      ),
    );
    const pakePackage = metadata.packages.find(
      (pkg: { name: string }) => pkg.name === 'pake',
    );
    const tauriDependency = pakePackage.dependencies.find(
      (dependency: { name: string }) => dependency.name === 'tauri',
    );

    expect(tauriDependency.features).not.toContain('macos-proxy');
    expect(pakePackage.features['macos-proxy']).toEqual(['tauri/macos-proxy']);
  });
});
