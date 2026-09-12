import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { verifyBuildOutput, verifyMacApp } from '../helpers/build-output.js';
const dirs: string[] = [];
afterEach(() =>
  dirs
    .splice(0)
    .forEach((dir) => fs.rmSync(dir, { recursive: true, force: true })),
);
function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pake-output-test-'));
  dirs.push(dir);
  const app = path.join(dir, 'Expected.app');
  fs.mkdirSync(app);
  return {
    app,
    stdout: JSON.stringify({ ok: true, outputs: [{ path: app }] }),
  };
}
it('rejects a failed process even when a stale app and success JSON exist', () => {
  const { app, stdout } = fixture();
  expect(() => verifyBuildOutput(1, stdout, app)).toThrow('Build exited');
});
it('rejects a different app and a missing expected artifact', () => {
  const { app, stdout } = fixture();
  expect(() => verifyBuildOutput(0, stdout, app + '-other')).toThrow('missing');
  fs.rmdirSync(app);
  expect(() => verifyBuildOutput(0, stdout, app)).toThrow('missing');
});
it('requires one successful machine-readable result', () => {
  const { app, stdout } = fixture();
  verifyBuildOutput(0, stdout, app);
  expect(() => verifyBuildOutput(0, stdout + '\nnoise', app)).toThrow();
  expect(() =>
    verifyBuildOutput(0, JSON.stringify({ ok: false }), app),
  ).toThrow();
});
it.skipIf(process.platform !== 'darwin')('rejects an empty app bundle', () => {
  expect(() => verifyMacApp(fixture().app, ['arm64', 'x86_64'])).toThrow();
});

it('accepts filesystem aliases of the same output without accepting a different file', () => {
  const { app } = fixture();
  const alias = app + '-alias';
  fs.symlinkSync(app, alias, process.platform === 'win32' ? 'junction' : 'dir');
  verifyBuildOutput(
    0,
    JSON.stringify({ ok: true, outputs: [{ path: alias }] }),
    app,
  );
  const other = app + '-other';
  fs.mkdirSync(other);
  expect(() =>
    verifyBuildOutput(
      0,
      JSON.stringify({ ok: true, outputs: [{ path: other }] }),
      app,
    ),
  ).toThrow('expected artifact');
});
