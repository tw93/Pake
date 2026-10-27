import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  TIERS,
  tiersFor,
  deadPatterns,
  matches,
  recentIncidents,
  breakerLine,
  report,
  BREAKER_ROWS,
  BREAKER_GATE,
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

describe('incident breaker', () => {
  const ledger = (rows: [string, string][]) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pake-breaker-'));
    const file = path.join(dir, 'incidents.md');
    const body = rows
      .map(
        ([day, layer], i) =>
          `| I-${String(i + 1).padStart(2, '0')} | ${day} | s | unknown | abc1234 | ${layer} | \`t\` |`,
      )
      .join('\n');
    fs.writeFileSync(
      file,
      '# Incidents\n\n| ID | Reported | Symptom |\n|---|---|---|\n| X-01 | 2026-10-27 | outside |\n\n' +
        '## Incidents\n\n| ID | Reported | Symptom | Introduced | Fixed | Layer | Caught by |\n' +
        `|---|---|---|---|---|---|---|\n${body}\n`,
    );
    return file;
  };
  const recent = (rows: [string, string][]) =>
    recentIncidents({ today: '2026-10-27', ledger: ledger(rows) });

  it('counts only rows reported in the last seven days', () => {
    const rows = recent([
      ['2026-10-27', 'unit'],
      ['2026-10-21', 'unit'],
      ['2026-10-20', 'unit'],
      ['2026-10-28', 'unit'],
    ]);
    // Day 0 and day 6 count; day 7 has aged out; a future date is never counted.
    expect(rows.map(([id]) => id)).toEqual(['I-01', 'I-02']);
  });

  it('trips at five rows and names the layers by count', () => {
    expect(
      breakerLine(recent(Array(4).fill(['2026-10-26', 'unit']))),
    ).toBeNull();
    const line = breakerLine(
      recent([
        ...Array(3).fill(['2026-10-26', 'review']),
        ...Array(2).fill(['2026-10-25', 'unit']),
      ]),
    );
    expect(line).toContain('5 incidents in the last 7 days');
    expect(line).toContain(BREAKER_GATE);
    expect(line?.endsWith('(review 3, unit 2)')).toBe(true);
  });

  it('never trips on a missing ledger', () => {
    expect(
      recentIncidents({
        today: '2026-10-27',
        ledger: '/nonexistent/incidents.md',
      }),
    ).toEqual([]);
  });

  it('is printed only beside a tier', () => {
    const tripped = Array(BREAKER_ROWS).fill(['I-01', 'unit']);
    expect(report(['docs/faq.md'], tripped)).toEqual([]);
    expect(report(['package.json'], tripped).at(-1)).toMatch(/^risk: breaker /);
  });
});
