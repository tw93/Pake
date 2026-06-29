import { describe, expect, it } from 'vitest';
import { InvalidArgumentError } from 'commander';
import { validateUrlInput } from '@/utils/validate';

describe('validateUrlInput', () => {
  it('prepends https:// to a bare domain', () => {
    expect(validateUrlInput('github.com')).toBe('https://github.com');
  });

  it('passes a fully-qualified URL through unchanged', () => {
    expect(validateUrlInput('https://example.com/path')).toBe(
      'https://example.com/path',
    );
  });

  it('returns an existing local path untouched', () => {
    // A path that exists on disk (file or directory) is returned untouched,
    // not normalized as a URL.
    const cwd = process.cwd();
    expect(validateUrlInput(cwd)).toBe(cwd);
  });

  it('wraps a normalize failure in InvalidArgumentError', () => {
    // '' is not a file, normalizeUrl('') -> 'https://' -> new URL() throws.
    expect(() => validateUrlInput('')).toThrow(InvalidArgumentError);
  });
});
