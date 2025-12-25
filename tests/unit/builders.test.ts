import { describe, it, expect } from 'vitest';

/**
 * Tests for multi-target build parsing logic
 * These tests verify the core logic used in LinuxBuilder without needing to instantiate the class
 */
describe('Multi-target build parsing', () => {
  /**
   * Simulates the logic from LinuxBuilder.build()
   */
  function parseAndFilterTargets(targetsString: string): string[] {
    const validTargets = ['deb', 'appimage', 'rpm'];
    const requestedTargets = targetsString
      .split(',')
      .map((t: string) => t.trim());

    return validTargets.filter((target) => requestedTargets.includes(target));
  }

  describe('Target parsing', () => {
    it('should parse single target', () => {
      const result = parseAndFilterTargets('deb');

      expect(result).toEqual(['deb']);
      expect(result).toHaveLength(1);
    });

    it('should parse comma-separated targets', () => {
      const result = parseAndFilterTargets('deb,appimage');

      expect(result).toEqual(['deb', 'appimage']);
      expect(result).toHaveLength(2);
    });

    it('should handle targets with spaces', () => {
      const result = parseAndFilterTargets('deb, appimage, rpm');

      expect(result).toEqual(['deb', 'appimage', 'rpm']);
      expect(result).toHaveLength(3);
    });

    it('should filter out invalid targets', () => {
      const result = parseAndFilterTargets('deb,invalid,appimage');

      expect(result).toEqual(['deb', 'appimage']);
      expect(result).not.toContain('invalid');
      expect(result).toHaveLength(2);
    });

    it('should handle all valid targets', () => {
      const result = parseAndFilterTargets('deb,appimage,rpm');

      expect(result).toEqual(['deb', 'appimage', 'rpm']);
      expect(result).toHaveLength(3);
    });

    it('should return empty array for all invalid targets', () => {
      const result = parseAndFilterTargets('invalid1,invalid2');

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    it('should handle excessive whitespace', () => {
      const result = parseAndFilterTargets('  deb  ,  appimage  ,  rpm  ');

      expect(result).toEqual(['deb', 'appimage', 'rpm']);
      expect(result).toHaveLength(3);
    });

    it('should be case-sensitive', () => {
      const result = parseAndFilterTargets('DEB,APPIMAGE');

      // Should not match uppercase
      expect(result).toEqual([]);
    });

    it('should handle single target with comma', () => {
      const result = parseAndFilterTargets('deb,');

      expect(result).toEqual(['deb']);
      expect(result).toHaveLength(1);
    });
  });

  describe('Target validation', () => {
    it('should validate against Linux target types', () => {
      const validTargets = ['deb', 'appimage', 'rpm'];

      expect(validTargets).toContain('deb');
      expect(validTargets).toContain('appimage');
      expect(validTargets).toContain('rpm');
      expect(validTargets).not.toContain('msi');
      expect(validTargets).not.toContain('dmg');
    });

    it('should check if target is valid', () => {
      const validTargets = ['deb', 'appimage', 'rpm'];
      const testTargets = ['deb', 'invalid', 'appimage', 'msi'];

      const valid = testTargets.filter((t) => validTargets.includes(t));
      const invalid = testTargets.filter((t) => !validTargets.includes(t));

      expect(valid).toEqual(['deb', 'appimage']);
      expect(invalid).toEqual(['invalid', 'msi']);
    });
  });

  describe('Architecture suffix handling', () => {
    it('should extract format from arm64 target', () => {
      const target = 'deb-arm64';
      const format = target.replace('-arm64', '');

      expect(format).toBe('deb');
    });

    it('should keep format without suffix', () => {
      const target = 'deb';
      const format = target.replace('-arm64', '');

      expect(format).toBe('deb');
    });

    it('should handle appimage-arm64', () => {
      const target = 'appimage-arm64';
      const format = target.replace('-arm64', '');

      expect(format).toBe('appimage');
    });
  });
});
