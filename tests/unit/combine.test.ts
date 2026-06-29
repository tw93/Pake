import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import combineFiles from '../../bin/utils/combine.js';

describe('combineFiles', () => {
  let dir: string;

  beforeAll(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pake-combine-'));
  });

  afterAll(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('keeps the wrapper valid when a .js file ends in a line comment without a trailing newline', async () => {
    const jsFile = path.join(dir, 'inject.js');
    const out = path.join(dir, 'out-js.js');
    // No trailing newline after the line comment: the closing `});` must not be
    // absorbed into the comment.
    await fs.writeFile(
      jsFile,
      "console.log('pake');\n//# sourceMappingURL=inject.js.map",
    );

    await combineFiles([jsFile], out);
    const result = await fs.readFile(out, 'utf-8');

    // Compiles only if the arrow function and its call are both closed.
    expect(() => new Function(result)).not.toThrow();
    expect(result).toContain("addEventListener('DOMContentLoaded'");
  });

  it('wraps .css files as a style injection with the content JSON-encoded', async () => {
    const cssFile = path.join(dir, 'inject.css');
    const out = path.join(dir, 'out-css.js');
    await fs.writeFile(cssFile, 'body { color: red; }');

    await combineFiles([cssFile], out);
    const result = await fs.readFile(out, 'utf-8');

    expect(() => new Function(result)).not.toThrow();
    expect(result).toContain('document.head.appendChild');
    expect(result).toContain(JSON.stringify('body { color: red; }'));
  });

  it('returns the input file list', async () => {
    const jsFile = path.join(dir, 'ret.js');
    const out = path.join(dir, 'out-ret.js');
    await fs.writeFile(jsFile, 'void 0;');

    const returned = await combineFiles([jsFile], out);

    expect(returned).toEqual([jsFile]);
  });
});
