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
});
