import { describe, expect, it } from 'vitest';
import { getIdentifier, resolveIdentifier } from '@/utils/info';

describe('identifier generation', () => {
  const url = 'https://gmail.com';

  it('generates different identifiers for the same URL when app names differ', () => {
    expect(getIdentifier(url, 'Work Gmail')).not.toBe(
      getIdentifier(url, 'Personal Gmail'),
    );
  });

  it('generates stable identifiers for the same URL and app name', () => {
    expect(getIdentifier(url, 'Work Gmail')).toBe(
      getIdentifier(url, 'Work Gmail'),
    );
  });

  it('prefers a custom identifier when provided', () => {
    expect(resolveIdentifier(url, 'Work Gmail', 'com.example.work-gmail')).toBe(
      'com.example.work-gmail',
    );
  });

  it('accepts valid custom identifier formats', () => {
    expect(resolveIdentifier(url, undefined, 'com.example.myapp')).toBe(
      'com.example.myapp',
    );
    expect(resolveIdentifier(url, undefined, 'io.github.myapp')).toBe(
      'io.github.myapp',
    );
    expect(resolveIdentifier(url, undefined, 'com.my-company.app2')).toBe(
      'com.my-company.app2',
    );
  });

  it('rejects invalid custom identifiers', () => {
    expect(() => resolveIdentifier(url, undefined, '123.invalid')).toThrow(
      'Invalid identifier',
    );
    expect(() => resolveIdentifier(url, undefined, 'has spaces')).toThrow(
      'Invalid identifier',
    );
    expect(() => resolveIdentifier(url, undefined, 'bad!chars')).toThrow(
      'Invalid identifier',
    );
  });

  it('generated identifier segments never start with a digit (D-Bus compliance)', () => {
    const inputs = [
      ['https://chatgpt.com/', 'chatgpt'],
      ['https://gmail.com', 'Work Gmail'],
      ['https://github.com', undefined],
      ['https://notion.so', 'Notion'],
      ['https://figma.com', 'Figma'],
      ['https://linear.app', 'Linear'],
    ];
    for (const [testUrl, name] of inputs) {
      const id = getIdentifier(testUrl, name);
      const segments = id.split('.');
      for (const seg of segments) {
        expect(seg).toMatch(/^[a-zA-Z_]/);
      }
    }
  });
});
