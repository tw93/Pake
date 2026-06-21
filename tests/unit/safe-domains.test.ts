import { describe, expect, it } from 'vitest';
import { safeDomainsToRegex } from '../../bin/utils/url.js';

describe('safeDomainsToRegex', () => {
  it('wraps a single domain and escapes dots', () => {
    expect(safeDomainsToRegex('slack.com')).toBe('(slack\\.com)');
  });

  it('joins multiple domains with alternation', () => {
    expect(safeDomainsToRegex('slack.com,acme.com')).toBe(
      '(slack\\.com|acme\\.com)',
    );
  });

  it('trims whitespace and drops empty entries', () => {
    expect(safeDomainsToRegex(' slack.com , , acme.com ')).toBe(
      '(slack\\.com|acme\\.com)',
    );
  });

  it('returns an empty string for blank input', () => {
    expect(safeDomainsToRegex('')).toBe('');
    expect(safeDomainsToRegex('  ,  , ')).toBe('');
  });

  it('escapes regex metacharacters in domains', () => {
    expect(safeDomainsToRegex('a.b+c')).toBe('(a\\.b\\+c)');
  });

  it('compiles to a regex that matches the domain inside a URL', () => {
    const pattern = new RegExp(safeDomainsToRegex('slack.com,okta.com'));

    expect(pattern.test('https://mycompany.okta.com/sso')).toBe(true);
    expect(pattern.test('https://app.slack.com/client')).toBe(true);
    expect(pattern.test('https://example.com/dashboard')).toBe(false);
  });
});
