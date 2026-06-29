import { describe, it, expect } from 'vitest';
import {
  LINUX_TARGET_TYPES,
  filterLinuxTargets,
  needsTemporaryDebForZst,
  resolveLinuxBundleTargets,
} from '../../bin/utils/targets.js';

describe('Linux target filtering', () => {
  it('parses a single target', () => {
    expect(filterLinuxTargets('deb')).toEqual(['deb']);
  });

  it('parses comma-separated targets', () => {
    expect(filterLinuxTargets('deb,appimage')).toEqual(['deb', 'appimage']);
  });

  it('handles targets with spaces', () => {
    expect(filterLinuxTargets('deb, appimage, rpm, zst')).toEqual([
      'deb',
      'appimage',
      'rpm',
      'zst',
    ]);
  });

  it('filters out invalid targets', () => {
    expect(filterLinuxTargets('deb,invalid,appimage')).toEqual([
      'deb',
      'appimage',
    ]);
  });

  it('returns empty array when no target is valid', () => {
    expect(filterLinuxTargets('invalid1,invalid2')).toEqual([]);
  });

  it('handles excessive whitespace', () => {
    expect(filterLinuxTargets('  deb  ,  appimage  ,  rpm  , zst ')).toEqual([
      'deb',
      'appimage',
      'rpm',
      'zst',
    ]);
  });

  it('is case-sensitive', () => {
    expect(filterLinuxTargets('DEB,APPIMAGE')).toEqual([]);
  });

  it('ignores trailing commas', () => {
    expect(filterLinuxTargets('deb,')).toEqual(['deb']);
  });

  it('preserves canonical order regardless of input order', () => {
    expect(filterLinuxTargets('zst,deb')).toEqual(['deb', 'zst']);
  });

  it('covers exactly the supported Linux formats', () => {
    expect(LINUX_TARGET_TYPES).toEqual(['deb', 'appimage', 'rpm', 'zst']);
  });

  it('uses a temporary deb only when zst is requested without deb', () => {
    expect(needsTemporaryDebForZst(['zst'])).toBe(true);
    expect(needsTemporaryDebForZst(['appimage', 'zst'])).toBe(true);
    expect(needsTemporaryDebForZst(['deb', 'zst'])).toBe(false);
    expect(needsTemporaryDebForZst(['deb', 'appimage'])).toBe(false);
  });
});

describe('resolveLinuxBundleTargets', () => {
  it('treats the default multi-target value as valid (no fallback warning)', () => {
    expect(resolveLinuxBundleTargets('deb,appimage')).toEqual({
      bundleTargets: ['deb', 'appimage'],
      hasValidTarget: true,
    });
  });

  it('treats the RPM-distro default as valid (canonical target order)', () => {
    expect(resolveLinuxBundleTargets('rpm,appimage')).toEqual({
      bundleTargets: ['appimage', 'rpm'],
      hasValidTarget: true,
    });
  });

  it('maps zst to a deb bundle (zst is repacked from the deb payload)', () => {
    expect(resolveLinuxBundleTargets('zst')).toEqual({
      bundleTargets: ['deb'],
      hasValidTarget: true,
    });
  });

  it('deduplicates when zst and deb are both requested', () => {
    expect(resolveLinuxBundleTargets('deb,zst')).toEqual({
      bundleTargets: ['deb'],
      hasValidTarget: true,
    });
  });

  it('reports no valid target when nothing matches', () => {
    expect(resolveLinuxBundleTargets('invalid')).toEqual({
      bundleTargets: [],
      hasValidTarget: false,
    });
  });
});
