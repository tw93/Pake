import { describe, expect, it } from 'vitest';
import {
  getDomain,
  appendProtocol,
  normalizeUrl,
} from '../../bin/utils/url.js';

describe('getDomain', () => {
  it('returns the SLD for a bare domain', () => {
    expect(getDomain('https://github.com')).toBe('github');
  });

  it('strips the www subdomain down to the SLD', () => {
    expect(getDomain('https://www.google.com')).toBe('google');
  });

  it('strips an arbitrary subdomain down to the registrable SLD', () => {
    expect(getDomain('https://weekly.tw93.fun')).toBe('tw93');
  });

  it('handles multi-part public suffixes via PSL', () => {
    expect(getDomain('https://sub.example.co.uk')).toBe('example');
  });

  it('returns null when the URL has no protocol', () => {
    expect(getDomain('github.com')).toBeNull();
  });

  it('returns null for a malformed URL', () => {
    expect(getDomain('not a url')).toBeNull();
  });

  it('returns null for a single-label host such as localhost', () => {
    expect(getDomain('https://localhost')).toBeNull();
  });
});

describe('appendProtocol', () => {
  it('leaves an already-schemed URL unchanged', () => {
    expect(appendProtocol('https://github.com')).toBe('https://github.com');
    expect(appendProtocol('http://localhost')).toBe('http://localhost');
  });

  it('prepends https:// to a bare host', () => {
    expect(appendProtocol('github.com')).toBe('https://github.com');
  });

  it('leaves a bare host:port unchanged (WHATWG parses "localhost:" as a scheme)', () => {
    // Documents a known parser quirk: new URL('localhost:3000') succeeds with
    // scheme "localhost:", so the input is treated as already-schemed.
    expect(appendProtocol('localhost:3000')).toBe('localhost:3000');
  });
});

describe('normalizeUrl', () => {
  it('normalizes a bare host by adding https://', () => {
    expect(normalizeUrl('github.com')).toBe('https://github.com');
  });

  it('keeps a valid URL unchanged', () => {
    expect(normalizeUrl('https://github.com')).toBe('https://github.com');
  });

  it('throws for input that yields an unparseable URL', () => {
    // appendProtocol('') -> 'https://', which new URL() rejects.
    expect(() => normalizeUrl('')).toThrow('is invalid');
  });
});
