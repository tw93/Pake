import { describe, expect, it } from 'vitest';
import { DEFAULT_PAKE_OPTIONS } from '../../bin/defaults.js';
import { getCliProgram } from '../../bin/helpers/cli-program.js';
import { buildAdblockConfig } from '../../bin/helpers/merge.js';
import { normalizeCliOptions } from '../../bin/options/index.js';

describe('adblock configuration', () => {
  it('defaults to the disabled profile', () => {
    expect(DEFAULT_PAKE_OPTIONS.adblockProfile).toBe('none');
    expect(buildAdblockConfig('none')).toEqual({
      enabled: false,
      profile: 'none',
    });
  });

  it('registers the hidden adblock CLI option', () => {
    const program = getCliProgram();
    const option = program.options.find((item) => item.is('--adblock'));

    expect(option).toBeDefined();
    expect(option?.attributeName()).toBe('adblock');
    expect(option?.hidden).toBe(true);
    expect(option?.defaultValue).toBe('none');
    expect(option?.argChoices).toEqual(['none', 'youtube']);
  });

  it('maps parsed adblock values to the internal profile option', () => {
    const options = normalizeCliOptions({
      ...DEFAULT_PAKE_OPTIONS,
      adblock: 'youtube',
    });

    expect(options.adblockProfile).toBe('youtube');
  });

  it('enables the YouTube profile', () => {
    expect(buildAdblockConfig('youtube')).toEqual({
      enabled: true,
      profile: 'youtube',
    });
  });
});
