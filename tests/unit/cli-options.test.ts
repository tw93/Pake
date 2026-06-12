import { describe, expect, it } from 'vitest';
import { getCliProgram } from '../../bin/helpers/cli-program.js';
import { validateNumberInput } from '../../bin/utils/validate.js';

describe('CLI options', () => {
  const program = getCliProgram();

  it('registers hidden --multi-window option', () => {
    const option = program.options.find(
      (item) => item.long === '--multi-window',
    );

    expect(option).toBeDefined();
    expect(option?.defaultValue).toBe(false);
  });

  it('registers hidden --internal-url-regex option', () => {
    const option = program.options.find(
      (item) => item.long === '--internal-url-regex',
    );

    expect(option).toBeDefined();
    expect(option?.defaultValue).toBe('');
  });

  it('registers hidden --identifier option', () => {
    const option = program.options.find((item) => item.long === '--identifier');

    expect(option).toBeDefined();
    expect(option?.hidden).toBe(true);
  });

  it('registers hidden --install option', () => {
    const option = program.options.find((item) => item.long === '--install');

    expect(option).toBeDefined();
    expect(option?.defaultValue).toBe(false);
    expect(option?.hidden).toBe(true);
  });

  it('registers hidden --enable-find option', () => {
    const option = program.options.find(
      (item) => item.long === '--enable-find',
    );

    expect(option).toBeDefined();
    expect(option?.defaultValue).toBe(false);
    expect(option?.hidden).toBe(true);
  });

  it('rejects malformed zoom values instead of truncating them', () => {
    const option = program.options.find((item) => item.long === '--zoom');

    expect(option).toBeDefined();
    expect(option?.parseArg?.('80', undefined)).toBe(80);
    expect(() => option?.parseArg?.('80abc', undefined)).toThrow(
      '--zoom must be a number between 50 and 200',
    );
  });

  it('rejects non-finite numeric option values', () => {
    expect(() => validateNumberInput('Infinity')).toThrow('Not a number.');
    expect(() => validateNumberInput('-Infinity')).toThrow('Not a number.');
    expect(validateNumberInput('1200')).toBe(1200);
  });

  it('rejects negative numeric option values', () => {
    expect(() => validateNumberInput('-100')).toThrow('Must not be negative.');
    expect(validateNumberInput('0')).toBe(0);
  });
});
