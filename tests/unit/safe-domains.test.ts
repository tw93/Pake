import { describe, expect, it } from 'vitest';
import { safeDomainsToRegex } from '../../bin/utils/url.js';

describe('safeDomainsToRegex', () => {
  it('builds a host-bound regex for a single domain', () => {
    expect(safeDomainsToRegex('slack.com')).toBe(
      '^https?:\\/\\/(?:[^/?#@]+\\.)*(?:slack\\.com)(?::\\d+)?(?:[/?#]|$)',
    );
  });

  it('joins multiple domains with alternation', () => {
    expect(safeDomainsToRegex('slack.com,acme.com')).toBe(
      '^https?:\\/\\/(?:[^/?#@]+\\.)*(?:slack\\.com|acme\\.com)(?::\\d+)?(?:[/?#]|$)',
    );
  });

  it('trims whitespace and drops empty entries', () => {
    expect(safeDomainsToRegex(' slack.com , , acme.com ')).toBe(
      '^https?:\\/\\/(?:[^/?#@]+\\.)*(?:slack\\.com|acme\\.com)(?::\\d+)?(?:[/?#]|$)',
    );
  });

  it('returns an empty string for blank input', () => {
    expect(safeDomainsToRegex('')).toBe('');
    expect(safeDomainsToRegex('  ,  , ')).toBe('');
  });

  it('escapes regex metacharacters in domains', () => {
    expect(safeDomainsToRegex('a.b+c')).toBe(
      '^https?:\\/\\/(?:[^/?#@]+\\.)*(?:a\\.b\\+c)(?::\\d+)?(?:[/?#]|$)',
    );
  });

  it('compiles to a regex that matches allowed URL hosts', () => {
    const pattern = new RegExp(safeDomainsToRegex('slack.com,okta.com'));

    expect(pattern.test('https://slack.com')).toBe(true);
    expect(pattern.test('https://mycompany.okta.com/sso')).toBe(true);
    expect(pattern.test('https://app.slack.com/client')).toBe(true);
    expect(pattern.test('https://slack.com:443/client')).toBe(true);
    expect(pattern.test('https://example.com/dashboard')).toBe(false);
  });

  it('does not match domains embedded in unrelated hosts or URL text', () => {
    const pattern = new RegExp(safeDomainsToRegex('slack.com,okta.com'));

    expect(pattern.test('https://evilslack.com')).toBe(false);
    expect(pattern.test('https://slack.com.evil.example')).toBe(false);
    expect(pattern.test('https://okta.com.evil.example/sso')).toBe(false);
    expect(
      pattern.test('https://example.com/callback?next=https://okta.com'),
    ).toBe(false);
    expect(pattern.test('https://okta.com@evil.example/sso')).toBe(false);
  });
});
