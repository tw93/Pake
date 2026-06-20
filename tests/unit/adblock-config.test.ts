import { describe, expect, it } from 'vitest';
import { DEFAULT_PAKE_OPTIONS } from '../../bin/defaults.js';
import { getCliProgram } from '../../bin/helpers/cli-program.js';
import { buildAdblockConfig } from '../../bin/helpers/merge.js';

describe('adblock configuration', () => {
  it('defaults to the disabled profile', () => {
    expect(DEFAULT_PAKE_OPTIONS.adblockProfile).toBe('none');
    expect(buildAdblockConfig('none')).toEqual({
      enabled: false,
      profile: 'none',
    });
  });

  it('registers the hidden adblock CLI option', () => {
    const option = getCliProgram().options.find(
      (item) => item.long === '--adblock',
    );

    expect(option).toBeDefined();
    expect(option?.hidden).toBe(true);
    expect(option?.defaultValue).toBe('none');
    expect(option?.argChoices).toEqual(['none', 'youtube']);
  });

  it('enables the YouTube profile', () => {
    expect(buildAdblockConfig('youtube')).toEqual({
      enabled: true,
      profile: 'youtube',
    });
  });
});
