import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

const apps = JSON.parse(fs.readFileSync('default_app_list.json', 'utf8'));
const release = fs.readFileSync('.github/workflows/release.yml', 'utf8');
const singleApp = fs.readFileSync('.github/workflows/single-app.yaml', 'utf8');

describe('popular app ad-block profile', () => {
  it('selects YouTube and no other popular app', () => {
    expect(apps.find((app) => app.name === 'youtube').adblock).toBe('youtube');
    expect(apps.filter((app) => app.name !== 'youtube' && app.adblock)).toEqual(
      [],
    );
  });

  it('passes the profile and applies it only in the Windows command', () => {
    expect(release).toContain('adblock: ${{ matrix.config.adblock ||');
    expect(singleApp).toContain('adblock:');
    const windowsSection = singleApp.split('- name: Build for Windows')[1];
    expect(windowsSection).toContain('$args += "--adblock"');
    expect(windowsSection).toContain('$args += "--show-system-tray"');
    expect(singleApp.split('- name: Build for Windows')[0]).not.toContain(
      '--adblock',
    );
  });
});
