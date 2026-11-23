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
    expect(appendProtocol('http://localhost:3000')).toBe(
      'http://localhost:3000',
    );
    expect(appendProtocol('example.com://8443')).toBe('example.com://8443');
    expect(appendProtocol('tel:1234')).toBe('tel:1234');
    expect(appendProtocol('file:///tmp/index.html')).toBe(
      'file:///tmp/index.html',
    );
  });

  it('prepends https:// to a bare host', () => {
    expect(appendProtocol('github.com')).toBe('https://github.com');
  });

  it.each([
    'localhost:3000',
    'example.com:8443/dashboard',
    'example.com.:8443/dashboard',
    'localhost:3000?view=summary',
    'example.com:8443#section',
  ])('prepends https:// to a bare host with a port: %s', (input) => {
    expect(appendProtocol(input)).toBe(`https://${input}`);
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

  it('rejects an out-of-range port on a bare host', () => {
    expect(() => normalizeUrl('example.com:65536')).toThrow('is invalid');
  });
});
