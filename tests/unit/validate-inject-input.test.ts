import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { validateInjectInput } from '@/utils/validate';

describe('validateInjectInput', () => {
  let dir: string;

  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pake-inject-'));
    for (const name of ['style.css', 'hotkey.js', 'THEME.CSS', 'notes.txt']) {
      fs.writeFileSync(path.join(dir, name), '');
    }
    fs.mkdirSync(path.join(dir, 'folder.js'));
  });

  afterAll(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('returns no files when nothing is injected', () => {
    expect(validateInjectInput(undefined, dir)).toEqual([]);
    expect(validateInjectInput([], dir)).toEqual([]);
  });

  it('accepts relative and absolute .css and .js files', () => {
    const absolute = path.join(dir, 'hotkey.js');
    expect(validateInjectInput(['style.css', absolute], dir)).toEqual([
      'style.css',
      absolute,
    ]);
  });

  it('accepts upper-case extensions', () => {
    expect(validateInjectInput(['THEME.CSS'], dir)).toEqual(['THEME.CSS']);
  });

  it('keeps a path with a comma whole and drops blank entries', () => {
    fs.mkdirSync(path.join(dir, 'My, Styles'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'My, Styles', 'x.css'), '');
    expect(
      validateInjectInput([' My, Styles/x.css ', ' ', 'hotkey.js'], dir),
    ).toEqual(['My, Styles/x.css', 'hotkey.js']);
  });

  it('rejects a file that is neither CSS nor JS', () => {
    expect(() => validateInjectInput(['style.css', 'notes.txt'], dir)).toThrow(
      expect.objectContaining({
        code: 'INVALID_INPUT',
        message: expect.stringMatching(
          /"notes\.txt" is not a \.css or \.js file/,
        ),
      }),
    );
  });

  it('rejects a missing file instead of failing later in the build', () => {
    expect(() => validateInjectInput(['missing.js'], dir)).toThrow(
      expect.objectContaining({
        code: 'INVALID_INPUT',
        message: expect.stringMatching(/Injected file not found: missing\.js/),
      }),
    );
  });

  it('rejects a directory whose name ends in .js', () => {
    expect(() => validateInjectInput(['folder.js'], dir)).toThrow(
      expect.objectContaining({
        code: 'INVALID_INPUT',
        message: expect.stringMatching(/Injected file not found: folder\.js/),
      }),
    );
  });

  it('runs in the CLI before the build workspace is entered', () => {
    const source = fs
      .readFileSync(path.join(__dirname, '../../bin/cli.ts'), 'utf8')
      .replace(/\r\n/g, '\n');
    const validateAt = source.indexOf(
      'options.inject = validateInjectInput(options.inject);',
    );
    expect(validateAt).toBeGreaterThan(-1);
    expect(validateAt).toBeGreaterThan(
      source.indexOf('loadConfigFile(options.config'),
    );
    expect(validateAt).toBeLessThan(
      source.indexOf('await enterBuildWorkspace()'),
    );
  });
});
