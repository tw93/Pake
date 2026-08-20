import { describe, expect, it } from 'vitest';
import { DEFAULT_PAKE_OPTIONS } from '../../bin/defaults';
import { validateManagedServerOptions } from '../../bin/options/index';
import { buildServerRemoteUrlPattern } from '../../bin/helpers/merge';
import type { PakeCliOptions } from '../../bin/types';

function options(overrides: Partial<PakeCliOptions> = {}): PakeCliOptions {
  return { ...DEFAULT_PAKE_OPTIONS, ...overrides };
}

describe('managed local server options', () => {
  it('accepts matching loopback URLs and trims the command', () => {
    const appOptions = options({
      serverPort: 30141,
      serverCommand: '  pi-web --port 30141  ',
    });
    expect(
      validateManagedServerOptions(appOptions, 'http://127.0.0.1:30141/path'),
    ).toBe('127.0.0.1');
    expect(appOptions.serverCommand).toBe('pi-web --port 30141');
  });

  it('requires port and command together', () => {
    expect(() =>
      validateManagedServerOptions(
        options({ serverPort: 30141 }),
        'http://127.0.0.1:30141',
      ),
    ).toThrow(/must be provided together/);
    expect(() =>
      validateManagedServerOptions(
        options({ serverCommand: 'pi-web' }),
        'http://127.0.0.1:30141',
      ),
    ).toThrow(/must be provided together/);
    expect(() =>
      validateManagedServerOptions(
        options({ serverCommand: '   ' }),
        'http://127.0.0.1:30141',
      ),
    ).toThrow(/must not be empty/);
  });

  it('rejects non-loopback targets and mismatched ports', () => {
    const managed = options({
      serverPort: 30141,
      serverCommand: 'pi-web',
    });
    expect(() =>
      validateManagedServerOptions(managed, 'https://example.com:30141'),
    ).toThrow(/loopback/);
    expect(() =>
      validateManagedServerOptions(managed, 'http://localhost:3000'),
    ).toThrow(/does not match/);
  });

  it('rejects managed servers with multiple app instances', () => {
    expect(() =>
      validateManagedServerOptions(
        options({
          serverPort: 30141,
          serverCommand: 'pi-web',
          multiInstance: true,
        }),
        'http://127.0.0.1:30141',
      ),
    ).toThrow(/cannot be used with --multi-instance/);
  });

  it('accepts default HTTP and HTTPS ports when they match', () => {
    expect(
      validateManagedServerOptions(
        options({ serverPort: 80, serverCommand: 'server' }),
        'http://localhost',
      ),
    ).toBe('localhost');
    expect(
      validateManagedServerOptions(
        options({ serverPort: 443, serverCommand: 'server' }),
        'https://[::1]',
      ),
    ).toBe('::1');
  });

  it('builds an exact Tauri URL pattern for the configured origin', () => {
    expect(buildServerRemoteUrlPattern('http://127.0.0.1:30141/path')).toBe(
      'http://127.0.0.1:30141/*',
    );
    expect(buildServerRemoteUrlPattern('https://localhost')).toBe(
      'https://localhost/*',
    );
    expect(buildServerRemoteUrlPattern('http://[::1]:30141')).toBe(
      'http://[\\:\\:1]:30141/*',
    );
  });
});
