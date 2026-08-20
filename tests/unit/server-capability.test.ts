import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { configureServerCapability } from '../../bin/helpers/merge';
import type { PakeAppOptions, PakeTauriConfig } from '../../bin/types';

describe('managed server capability', () => {
  it('keeps loopback URLs out of the default capability', () => {
    const capability = JSON.parse(
      fs.readFileSync(
        path.join(process.cwd(), 'src-tauri', 'capabilities', 'default.json'),
        'utf8',
      ),
    );

    expect(capability.remote.urls).toEqual(['https://*.*']);
  });

  it('adds only the configured loopback origin to managed builds', async () => {
    const tauriConf = { app: { security: {} } } as PakeTauriConfig;
    await configureServerCapability(
      'http://127.0.0.1:30141/path',
      { serverHost: '127.0.0.1' } as PakeAppOptions,
      tauriConf,
    );

    expect(tauriConf.app.security?.capabilities?.[0]).toBe('pake-capability');
    expect(tauriConf.app.security?.capabilities?.[1]).toMatchObject({
      identifier: 'pake-managed-server-capability',
      local: false,
      remote: { urls: ['http://127.0.0.1:30141/*'] },
    });
  });

  it('does not add explicit capabilities to ordinary builds', async () => {
    const tauriConf = { app: { security: {} } } as PakeTauriConfig;
    await configureServerCapability(
      'https://example.com',
      {} as PakeAppOptions,
      tauriConf,
    );
    expect(tauriConf.app.security?.capabilities).toBeUndefined();
  });
});
