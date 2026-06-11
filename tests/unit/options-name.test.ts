import { describe, expect, it } from 'vitest';
import { isValidName, resolveLocalAppName } from '@/options/index';

describe('option name validation', () => {
  it('allows dots inside macOS and Windows app names', () => {
    expect(isValidName('Vectorizer.AI', 'darwin')).toBe(true);
    expect(isValidName('Vectorizer.AI', 'win32')).toBe(true);
  });

  it('rejects leading dots, dashes, and spaces on macOS and Windows', () => {
    expect(isValidName('.hidden', 'darwin')).toBe(false);
    expect(isValidName('-hidden', 'win32')).toBe(false);
    expect(isValidName(' Hidden', 'darwin')).toBe(false);
  });

  it('keeps Linux package names stricter than desktop app names', () => {
    expect(isValidName('vectorizer.ai', 'linux')).toBe(false);
    expect(isValidName('vectorizer-ai', 'linux')).toBe(true);
  });
});

describe('local app name resolution', () => {
  it('preserves dots in local file names on macOS and Windows', () => {
    expect(resolveLocalAppName('/tmp/Vectorizer.AI.html', 'darwin')).toBe(
      'Vectorizer.AI',
    );
    expect(resolveLocalAppName('/tmp/Vectorizer.AI.html', 'win32')).toBe(
      'Vectorizer.AI',
    );
  });

  it('normalizes leading dots from local file names', () => {
    expect(resolveLocalAppName('/tmp/.hidden.html', 'darwin')).toBe('hidden');
  });

  it('normalizes dotted local names for Linux package names', () => {
    expect(resolveLocalAppName('/tmp/Vectorizer.AI.html', 'linux')).toBe(
      'vectorizer-ai',
    );
  });
});
