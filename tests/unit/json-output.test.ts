import { describe, it, expect, vi, afterEach } from 'vitest';
import log from 'loglevel';
import {
  ERROR_EXIT_CODES,
  enableMachineMode,
  getCapturedWarnings,
  isInteractive,
  isMachineMode,
  printJsonResult,
  PakeJsonResult,
} from '@/utils/output';
import { PakeError } from '@/utils/error';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('exit code contract', () => {
  it('maps every error code to its documented exit code', () => {
    expect(ERROR_EXIT_CODES).toEqual({
      INVALID_INPUT: 2,
      BUILD_FAILED: 3,
      NETWORK: 3,
      ENV_MISSING: 4,
      UNEXPECTED: 1,
    });
  });
});

describe('PakeError code and hint', () => {
  it('carries an optional code and hint for the JSON result', () => {
    const err = new PakeError('rust missing', {
      code: 'ENV_MISSING',
      hint: 'Install Rust via https://rustup.rs',
    });
    expect(err.code).toBe('ENV_MISSING');
    expect(err.hint).toBe('Install Rust via https://rustup.rs');
  });

  it('leaves code and hint undefined when not provided', () => {
    const err = new PakeError('plain');
    expect(err.code).toBeUndefined();
    expect(err.hint).toBeUndefined();
  });
});

describe('machine mode', () => {
  // enableMachineMode mutates module-level state, so ordering inside this
  // file matters: isInteractive/isMachineMode pre-state is checked first.
  it('is off by default and never interactive after enabling', () => {
    expect(isMachineMode()).toBe(false);

    enableMachineMode();

    expect(isMachineMode()).toBe(true);
    expect(isInteractive()).toBe(false);
  });

  it('routes logs to stderr and captures warnings for the JSON result', () => {
    enableMachineMode();
    // setLevel after enabling must keep the stderr factory (cli.ts does this).
    log.setLevel('info');
    const stderrSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    log.warn('something soft-failed');
    log.info('progress line');

    expect(stderrSpy).toHaveBeenCalledTimes(2);
    expect(getCapturedWarnings()).toContain('something soft-failed');
    expect(getCapturedWarnings()).not.toContain('progress line');
  });

  it('prints exactly one parseable JSON line on stdout', () => {
    const writes: string[] = [];
    const stdoutSpy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation((chunk) => {
        writes.push(String(chunk));
        return true;
      });

    const result: PakeJsonResult = {
      ok: true,
      name: 'Weekly',
      platform: process.platform,
      arch: 'arm64',
      outputs: [{ path: '/tmp/Weekly.dmg', sizeBytes: 42, format: 'dmg' }],
      warnings: [],
      error: null,
    };
    printJsonResult(result);

    expect(stdoutSpy).toHaveBeenCalledTimes(1);
    expect(writes[0].endsWith('\n')).toBe(true);
    expect(JSON.parse(writes[0])).toEqual(result);
  });
});
