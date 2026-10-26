import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  ROOT,
  LEDGER,
  problems,
  definedCatchers,
  isShallow,
  rows,
} from '../../scripts/check-incidents.mjs';

const HEADER = [
  '## Incidents',
  '',
  '| ID | Reported | Symptom | Introduced | Fixed | Layer | Caught by |',
  '| --- | --- | --- | --- | --- | --- | --- |',
];
const GOOD = [
  'I-01',
  '2026-01-02',
  'Something broke',
  'unknown',
  'abc1234',
  'unit',
  '`a known test`',
];
const defined = new Set(['a known test']);
const resolve = (sha: string) => sha === 'abc1234' || sha === 'def5678';

function ledger(...table: string[][]) {
  return [...HEADER, ...table.map((cells) => `| ${cells.join(' | ')} |`)].join(
    '\n',
  );
}

function check(text: string, checkCommits = true) {
  return problems(text, { defined, checkCommits, resolve });
}

function withCell(index: number, value: string) {
  const cells = [...GOOD];
  cells[index] = value;
  return cells;
}

describe('incident ledger', () => {
  it('keeps every row of docs/incidents.md valid', () => {
    const text = fs.readFileSync(LEDGER, 'utf8');
    expect([...rows(text)].length).toBeGreaterThan(0);
    expect(
      problems(text, {
        defined: definedCatchers(),
        checkCommits: !isShallow(),
      }),
    ).toEqual([]);
  });

  it('accepts a well-formed row and a confirmed introducing commit', () => {
    expect(check(ledger(GOOD))).toEqual([]);
    expect(check(ledger(withCell(3, 'def5678')))).toEqual([]);
  });

  it('ignores Prettier column padding and tables outside the section', () => {
    const padded = `| ${GOOD.map((cell) => cell.padEnd(20)).join(' | ')} |`;
    const other = '## Other\n\n| x | y |\n| - | - |\n| bad | row |';
    expect(check(`${other}\n${HEADER.join('\n')}\n${padded}`)).toEqual([]);
  });

  it.each([
    ['a repeated ID', ledger(GOOD, GOOD), /I-01 repeats/],
    [
      'a Reported cell that is not a date',
      ledger(withCell(1, 'July')),
      /Reported is not a date/,
    ],
    [
      'an Introduced cell that is not a commit',
      ledger(withCell(3, 'maybe')),
      /Introduced is not a commit/,
    ],
    [
      'an Introduced commit that does not resolve',
      ledger(withCell(3, 'fff9999')),
      /Introduced fff9999 does not resolve/,
    ],
    [
      'a Fixed cell that is not a commit',
      ledger(withCell(4, 'unknown')),
      /Fixed is not a commit/,
    ],
    [
      'a Fixed commit that does not resolve',
      ledger(withCell(4, 'fff9999')),
      /Fixed fff9999 does not resolve/,
    ],
    ['an unknown layer', ledger(withCell(5, 'qa')), /layer qa is not one of/],
    ['no catcher', ledger(withCell(6, 'a test somewhere')), /no catcher named/],
    [
      'an undefined catcher',
      ledger(withCell(6, '`a missing test`')),
      /catcher `a missing test` is not a test or gate/,
    ],
    ['a missing cell', ledger(GOOD.slice(0, 6)), /expected 7 cells, found 6/],
  ])('fails on %s and nothing else', (_name, text, message) => {
    const found = check(text);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatch(message);
  });

  it('only shape-checks commits in a shallow clone', () => {
    expect(check(ledger(withCell(4, 'fff9999')), false)).toEqual([]);
    expect(check(ledger(withCell(4, 'HEAD')), false)).toHaveLength(1);
  });

  it('finds Vitest, node:test and Rust test names and repository paths', () => {
    const names = definedCatchers();
    expect(names.has('keeps every row of docs/incidents.md valid')).toBe(true);
    expect(
      names.has(
        "uses WebKit's target configuration with a fresh user content controller",
      ),
    ).toBe(true);
    expect(
      names.has(
        'native fullscreen preserves the player subtree and F11 exits its top layer',
      ),
    ).toBe(true);
    expect(names.has('dmabuf_renderer_stays_disabled_outside_niri')).toBe(true);
    const text = ledger(withCell(6, '`tests/browser/fullscreen.mjs`'));
    expect(problems(text, { defined: names, checkCommits: false })).toEqual([]);
    expect(
      problems(ledger(withCell(6, '`tests/browser`')), {
        defined: names,
        checkCommits: false,
      }),
    ).toHaveLength(1);
    expect(fs.existsSync(path.join(ROOT, 'tests/browser/fullscreen.mjs'))).toBe(
      true,
    );
  });
});

describe('scripts imported by tests', () => {
  // Windows checks out CRLF, and Vitest fails to parse an imported module whose
  // first line is a hashbang ending in \r ("Invalid or unexpected token").
  it('do not start with a hashbang', () => {
    const testsDir = path.join(process.cwd(), 'tests');
    const imported = new Set<string>();
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.test\.[cm]?[jt]s$/.test(entry.name)) {
          const text = fs.readFileSync(full, 'utf8');
          for (const m of text.matchAll(
            /from '((?:\.\.\/)+scripts\/[^']+\.mjs)'/g,
          )) {
            imported.add(path.resolve(dir, m[1]));
          }
        }
      }
    };
    walk(testsDir);
    expect(imported.size).toBeGreaterThan(0);
    const withHashbang = [...imported].filter((file) =>
      fs.readFileSync(file, 'utf8').startsWith('#!'),
    );
    expect(withHashbang).toEqual([]);
  });
});
