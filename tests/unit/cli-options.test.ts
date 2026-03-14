import { describe, expect, it } from 'vitest';
import { getCliProgram } from '../../bin/helpers/cli-program.js';

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

  it('registers visible --install option', () => {
    const option = program.options.find((item) => item.long === '--install');

    expect(option).toBeDefined();
    expect(option?.defaultValue).toBe(false);
    expect(option?.hidden).toBe(false);
  });
});
