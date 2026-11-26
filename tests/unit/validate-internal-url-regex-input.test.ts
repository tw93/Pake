import { describe, expect, it } from 'vitest';
import { validateInternalUrlRegexInput } from '@/utils/validate';
import { safeDomainsToRegex } from '@/utils/url';

describe('validateInternalUrlRegexInput', () => {
  it('accepts an empty value and valid patterns', () => {
    expect(validateInternalUrlRegexInput('')).toBe('');
    expect(
      validateInternalUrlRegexInput('^https://(www\\.)?example\\.com'),
    ).toBe('^https://(www\\.)?example\\.com');
    const fromSafeDomain = safeDomainsToRegex('example.com,sso.example.org');
    expect(validateInternalUrlRegexInput(fromSafeDomain)).toBe(fromSafeDomain);
  });

  it.each(['[', '(abc', '*.example.com', 'a{2,1}'])(
    'rejects %s, which the app could not compile',
    (value) => {
      expect(() => validateInternalUrlRegexInput(value)).toThrow(
        expect.objectContaining({ code: 'INVALID_INPUT' }),
      );
    },
  );
});
