import { describe, expect, it } from 'vitest';

import {
  generateDashboardIconSlugs,
  getIconSourcePriority,
  isLikelyLocalHostname,
  shouldPreferDashboardIcons,
} from '@/utils/icon-source';

describe('isLikelyLocalHostname', () => {
  it('recognises the literal localhost label', () => {
    expect(isLikelyLocalHostname('localhost')).toBe(true);
    expect(isLikelyLocalHostname('LOCALHOST')).toBe(true);
  });

  it('recognises IPv4 literals', () => {
    expect(isLikelyLocalHostname('127.0.0.1')).toBe(true);
    expect(isLikelyLocalHostname('10.0.0.5')).toBe(true);
  });

  it('recognises IPv6 literals via the colon heuristic', () => {
    expect(isLikelyLocalHostname('::1')).toBe(true);
    expect(isLikelyLocalHostname('fe80::1')).toBe(true);
  });

  it('treats dotless hostnames as local', () => {
    expect(isLikelyLocalHostname('myhost')).toBe(true);
  });

  it('recognises typical local-network suffixes', () => {
    expect(isLikelyLocalHostname('router.local')).toBe(true);
    expect(isLikelyLocalHostname('nas.lan')).toBe(true);
    expect(isLikelyLocalHostname('svc.internal')).toBe(true);
    expect(isLikelyLocalHostname('box.home')).toBe(true);
    expect(isLikelyLocalHostname('pi.localdomain')).toBe(true);
  });

  it('rejects public hostnames and empty input', () => {
    expect(isLikelyLocalHostname('example.com')).toBe(false);
    expect(isLikelyLocalHostname('a.b.example.com')).toBe(false);
    expect(isLikelyLocalHostname('')).toBe(false);
    expect(isLikelyLocalHostname('   ')).toBe(false);
  });
});

describe('generateDashboardIconSlugs', () => {
  it('lowercases and deduplicates a single-word name', () => {
    expect(generateDashboardIconSlugs('GitHub')).toEqual(['github']);
  });

  it('emits both spaced and hyphenated variants for multi-word names', () => {
    expect(generateDashboardIconSlugs('Notion AI')).toEqual([
      'notion ai',
      'notion-ai',
    ]);
  });

  it('returns an empty list for blank input', () => {
    expect(generateDashboardIconSlugs('')).toEqual([]);
    expect(generateDashboardIconSlugs('   ')).toEqual([]);
  });
});

describe('shouldPreferDashboardIcons', () => {
  it('returns false when the app name is empty', () => {
    expect(shouldPreferDashboardIcons('https://github.com/', '')).toBe(false);
  });

  it('returns false when the URL cannot be parsed', () => {
    expect(shouldPreferDashboardIcons('not a url', 'GitHub')).toBe(false);
  });

  it('returns false for root domains that already host the brand', () => {
    expect(shouldPreferDashboardIcons('https://github.com/', 'GitHub')).toBe(
      false,
    );
  });

  it('returns false when the subdomain label does not match the app name', () => {
    expect(
      shouldPreferDashboardIcons('https://mail.google.com/', 'Gmail'),
    ).toBe(false);
  });

  it('returns true for product subdomains matching the app name', () => {
    expect(
      shouldPreferDashboardIcons(
        'https://notebooklm.google.com/',
        'NotebookLM',
      ),
    ).toBe(true);
  });

  it('returns true for self-hosted local hostnames', () => {
    expect(
      shouldPreferDashboardIcons('https://grafana.mylab.local/', 'Grafana'),
    ).toBe(true);
  });
});

describe('getIconSourcePriority', () => {
  it('orders domain-first for plain root domains', () => {
    expect(getIconSourcePriority('https://github.com/', 'GitHub')).toEqual([
      'domain',
      'dashboard',
    ]);
  });

  it('orders dashboard-first for product subdomains', () => {
    expect(
      getIconSourcePriority('https://notebooklm.google.com/', 'NotebookLM'),
    ).toEqual(['dashboard', 'domain']);
  });
});
