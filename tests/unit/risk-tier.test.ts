import { describe, it, expect } from 'vitest';
import {
  TIERS,
  tiersFor,
  deadPatterns,
  matches,
} from '../../scripts/risk-tier.mjs';

const names = (paths: string[]) => tiersFor(paths).map((tier) => tier.name);

describe('risk tiers', () => {
  it('matches every tier pattern against a tracked file', () => {
    expect(deadPatterns()).toEqual([]);
  });

  it('reports a pattern that a rename left behind', () => {
    expect(deadPatterns(['README.md'])).toContain(
      'publish: .github/workflows/npm-publish.yml',
    );
  });

  it.each([
    ['.github/workflows/npm-publish.yml', 'publish'],
    ['scripts/check-release-version.mjs', 'publish'],
    ['action.yml', 'public-workflow'],
    ['.github/workflows/single-app.yaml', 'public-workflow'],
    ['.github/workflows/quality-and-test.yml', 'ci'],
    ['.github/actions/setup-env/action.yml', 'ci'],
    ['src-tauri/capabilities/default.json', 'ipc-permission'],
    ['src-tauri/src/inject/event.js', 'ipc-permission'],
    ['src-tauri/tauri.conf.json', 'bundle'],
    ['bin/builders/WinBuilder.ts', 'bundle'],
    ['package.json', 'cli-artifact'],
  ])('puts %s in the %s tier', (file, tier) => {
    expect(names([file])).toEqual([tier]);
  });

  it('leaves ordinary source, tests and docs at the default checks', () => {
    expect(
      names(['bin/utils/url.ts', 'tests/unit/url.test.ts', 'docs/faq.md']),
    ).toEqual([]);
  });

  it('lists every tier a change reaches, highest first', () => {
    expect(
      names(['package.json', 'action.yml', '.github/workflows/release.yml']),
    ).toEqual(['publish', 'public-workflow', 'cli-artifact']);
    expect(TIERS.map((tier) => tier.name)[0]).toBe('publish');
  });

  it('matches a directory pattern only below that directory', () => {
    expect(matches('bin/builders/MacBuilder.ts', 'bin/builders/*')).toBe(true);
    expect(matches('bin/builders.ts', 'bin/builders/*')).toBe(false);
    expect(matches('xaction.yml', 'action.yml')).toBe(false);
  });
});
