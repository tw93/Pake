import { describe, it, expect } from 'vitest';
import {
  LINUX_TARGET_TYPES,
  filterLinuxTargets,
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
});
