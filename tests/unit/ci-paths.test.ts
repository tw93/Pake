import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

// A push that touches only files the Quality & Testing path filter skips
// starts no run, so a skipped file that a check reads or the Rust build
// embeds could break main with nothing red. This evaluates the filter the way
// GitHub does (last matching pattern wins, `*` stops at `/`, `**` crosses it)
// over every tracked file.

const ROOT = path.resolve(__dirname, '../..');
const WORKFLOW = path.join(ROOT, '.github/workflows/quality-and-test.yml');

// Non-code files a check reads. Add a file here and to the filter in the same
// change when a check starts reading it.
const READS: Record<string, string> = {
  'docs/incidents.md': 'scripts/check-incidents.mjs',
};

// Code-suffixed files skipped on purpose: agent skills and plugin manifests,
// which no check, test or build reads.
const SKIPPED_CODE = ['.agents/', '.claude/', '.claude-plugin/', 'plugins/'];

const CODE_SUFFIXES = new Set([
  '.ts',
  '.js',
  '.mjs',
  '.cjs',
  '.json',
  '.rs',
  '.toml',
  '.lock',
  '.yml',
  '.yaml',
  '.sh',
  '.ps1',
  '.wxs',
  '.html',
  '.css',
  '.plist',
  '.py',
]);

function eventPaths(text: string, event: string): string[] {
  const match = text.match(
    new RegExp(`^  ${event}:\\n(?:    .*\\n)*?    paths: (\\[.*\\])$`, 'm'),
  );
  if (!match) throw new Error(`no paths list under ${event}`);
  return JSON.parse(match[1]);
}

function compile(pattern: string): RegExp {
  let out = '';
  for (let i = 0; i < pattern.length; ) {
    if (pattern.startsWith('**', i)) {
      out += '.*';
      i += 2;
    } else if (pattern[i] === '*') {
      out += '[^/]*';
      i += 1;
    } else if (pattern[i] === '?') {
      out += '[^/]';
      i += 1;
    } else {
      out += pattern[i].replace(/[.+^${}()|[\]\\]/g, '\\$&');
      i += 1;
    }
  }
  return new RegExp(`^${out}$`);
}

function makeFilter(patterns: string[]) {
  const compiled = patterns.map((p) => ({
    negated: p.startsWith('!'),
    regex: compile(p.replace(/^!/, '')),
  }));
  return (file: string) => {
    let result = false;
    for (const { negated, regex } of compiled) {
      if (regex.test(file)) result = !negated;
    }
    return result;
  };
}

// Windows checkouts convert line endings to CRLF; the patterns below expect LF.
const text = fs.readFileSync(WORKFLOW, 'utf8').replace(/\r\n/g, '\n');
const push = eventPaths(text, 'push');
const included = makeFilter(push);
const files = execSync('git ls-files', { cwd: ROOT, encoding: 'utf8' })
  .split('\n')
  .filter(Boolean);

describe('Quality & Testing path filter', () => {
  it('uses the same list for push and pull_request', () => {
    expect(eventPaths(text, 'pull_request')).toEqual(push);
  });

  it('skips docs (positive control)', () => {
    expect(included('README.md')).toBe(false);
    expect(included('docs/faq.md')).toBe(false);
    expect(included('docs/incidents.md')).toBe(true);
  });

  it('never skips a code file', () => {
    const skipped = files.filter(
      (f) =>
        CODE_SUFFIXES.has(path.extname(f)) &&
        !SKIPPED_CODE.some((p) => f.startsWith(p)) &&
        !included(f),
    );
    expect(skipped).toEqual([]);
  });

  it('never skips a file a check reads', () => {
    expect(Object.keys(READS).filter((f) => !files.includes(f))).toEqual([]);
    const skipped = Object.entries(READS)
      .filter(([f]) => !included(f))
      .map(([f, reader]) => `${f} (read by ${reader})`);
    expect(skipped).toEqual([]);
  });

  it('never skips a file the Rust build embeds', () => {
    const include = /include_(?:bytes|str)!\(\s*"([^"]+)"\s*\)/g;
    let found = 0;
    const skipped: string[] = [];
    for (const source of files.filter((f) => f.endsWith('.rs'))) {
      const body = fs.readFileSync(path.join(ROOT, source), 'utf8');
      for (const [, target] of body.matchAll(include)) {
        const relative = path
          .relative(ROOT, path.resolve(ROOT, path.dirname(source), target))
          .split(path.sep)
          .join('/');
        if (!files.includes(relative)) continue;
        found += 1;
        if (!included(relative))
          skipped.push(`${relative} (embedded by ${source})`);
      }
    }
    expect(found).toBeGreaterThan(0);
    expect(skipped).toEqual([]);
  });
});
