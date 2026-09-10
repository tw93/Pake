import { describe, expect, it } from 'vitest';
import { InvalidArgumentError } from 'commander';
import { validateUrlInput, validateDownloadDirInput } from '@/utils/validate';

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

  it('rejects path-shaped input that does not exist instead of URL-ifying it', () => {
    // Regression guard: './typo' must never become https://./typo and build
    // a silently broken app. Covers ./, ../, /, ~/ and Windows drive paths.
    for (const missing of [
      './does-not-exist-dir',
      '../does-not-exist-dir',
      '/does/not/exist/anywhere-pake',
      '~/does-not-exist-pake',
      'C:\\does-not-exist-pake',
    ]) {
      expect(() => validateUrlInput(missing)).toThrow(/does not exist/);
    }
  });

  it('still treats bare domains without scheme as web urls', () => {
    expect(validateUrlInput('example.com')).toBe('https://example.com');
  });
});

describe('validateDownloadDirInput', () => {
  it('keeps defaults, absolute paths, and runtime home paths unchanged', () => {
    for (const value of ['', process.cwd(), '~', '~/Documents/My App']) {
      expect(validateDownloadDirInput(value)).toBe(value);
    }
  });

  it('rejects relative, user-specific tilde, and NUL paths', () => {
    for (const value of [
      'downloads',
      './downloads',
      '~alice/downloads',
      '   ',
      '~/bad\0path',
      '~//tmp',
    ]) {
      expect(() => validateDownloadDirInput(value)).toThrow(
        'Invalid download directory',
      );
    }
  });

  it('rejects drive-relative paths on Windows', () => {
    if (process.platform === 'win32') {
      for (const value of [
        'C:downloads',
        '\\downloads',
        '/downloads',
        '~/C:\\other',
        '~/C:other',
        '~/\\other',
      ]) {
        expect(() => validateDownloadDirInput(value)).toThrow(
          'Invalid download directory',
        );
      }
      expect(validateDownloadDirInput('C:\\Downloads')).toBe('C:\\Downloads');
    }
  });
});
