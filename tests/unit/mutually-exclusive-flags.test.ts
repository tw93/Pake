import { describe, it, expect } from 'vitest';
import { validateMutuallyExclusiveFlags } from '@/utils/validate';
import { PakeError } from '@/utils/error';
import { PakeCliOptions } from '@/types';

/**
 * Test suite for mutually exclusive CLI flags validation.
 * Validates that conflicting options are rejected with clear error messages.
 */
describe('validateMutuallyExclusiveFlags', () => {
  const baseOptions: Partial<PakeCliOptions> = {
    fullscreen: false,
    maximize: false,
    width: 1200,
    height: 780,
    minWidth: 0,
    minHeight: 0,
    startToTray: false,
  };

  describe('--fullscreen vs size constraints', () => {
    it('accepts --fullscreen alone', () => {
      expect(() =>
        validateMutuallyExclusiveFlags({
          ...baseOptions,
          fullscreen: true,
        }),
      ).not.toThrow();
    });

    it('rejects --fullscreen with explicit --width', () => {
      expect(() =>
        validateMutuallyExclusiveFlags({
          ...baseOptions,
          fullscreen: true,
          width: 1400,
        }),
      ).toThrow(
        expect.objectContaining({
          message: expect.stringContaining(
            '"--fullscreen" and "--width" cannot be used together',
          ),
          code: 'INVALID_INPUT',
        }),
      );
    });

    it('rejects --fullscreen with explicit --height', () => {
      expect(() =>
        validateMutuallyExclusiveFlags({
          ...baseOptions,
          fullscreen: true,
          height: 900,
        }),
      ).toThrow(
        expect.objectContaining({
          message: expect.stringContaining(
            '"--fullscreen" and "--height" cannot be used together',
          ),
          code: 'INVALID_INPUT',
        }),
      );
    });

    it('rejects --fullscreen with explicit --min-width', () => {
      expect(() =>
        validateMutuallyExclusiveFlags({
          ...baseOptions,
          fullscreen: true,
          minWidth: 800,
        }),
      ).toThrow(
        expect.objectContaining({
          message: expect.stringContaining(
            '"--fullscreen" and "--min-width" cannot be used together',
          ),
          code: 'INVALID_INPUT',
        }),
      );
    });

    it('rejects --fullscreen with explicit --min-height', () => {
      expect(() =>
        validateMutuallyExclusiveFlags({
          ...baseOptions,
          fullscreen: true,
          minHeight: 600,
        }),
      ).toThrow(
        expect.objectContaining({
          message: expect.stringContaining(
            '"--fullscreen" and "--min-height" cannot be used together',
          ),
          code: 'INVALID_INPUT',
        }),
      );
    });

    it('accepts --fullscreen with default width/height (not explicitly set)', () => {
      // When options come from defaults (not explicitly set), they should not trigger conflict
      expect(() =>
        validateMutuallyExclusiveFlags({
          fullscreen: true,
          width: 1200, // default value
          height: 780, // default value
        }),
      ).not.toThrow();
    });

    it('allows multiple size conflicts in error sequence', () => {
      // First conflict should throw, preventing cascade errors
      expect(() =>
        validateMutuallyExclusiveFlags({
          fullscreen: true,
          width: 1400,
          height: 900,
        }),
      ).toThrow();
    });
  });

  describe('--fullscreen vs --maximize', () => {
    it('rejects --fullscreen with --maximize', () => {
      expect(() =>
        validateMutuallyExclusiveFlags({
          ...baseOptions,
          fullscreen: true,
          maximize: true,
        }),
      ).toThrow(
        expect.objectContaining({
          message: expect.stringContaining(
            '"--fullscreen" and "--maximize" cannot be used together',
          ),
          code: 'INVALID_INPUT',
          hint: expect.stringContaining('Use only "--fullscreen"'),
        }),
      );
    });

    it('accepts --fullscreen without --maximize', () => {
      expect(() =>
        validateMutuallyExclusiveFlags({
          ...baseOptions,
          fullscreen: true,
          maximize: false,
        }),
      ).not.toThrow();
    });

    it('accepts --maximize without --fullscreen', () => {
      expect(() =>
        validateMutuallyExclusiveFlags({
          ...baseOptions,
          fullscreen: false,
          maximize: true,
        }),
      ).not.toThrow();
    });
  });

  describe('--start-to-tray vs --maximize', () => {
    it('rejects --start-to-tray with --maximize', () => {
      expect(() =>
        validateMutuallyExclusiveFlags({
          ...baseOptions,
          startToTray: true,
          maximize: true,
        }),
      ).toThrow(
        expect.objectContaining({
          message: expect.stringContaining(
            '"--start-to-tray" and "--maximize" cannot be used together',
          ),
          code: 'INVALID_INPUT',
          hint: expect.stringContaining('Remove "--maximize"'),
        }),
      );
    });

    it('accepts --start-to-tray without --maximize', () => {
      expect(() =>
        validateMutuallyExclusiveFlags({
          ...baseOptions,
          startToTray: true,
          maximize: false,
        }),
      ).not.toThrow();
    });

    it('accepts --maximize without --start-to-tray', () => {
      expect(() =>
        validateMutuallyExclusiveFlags({
          ...baseOptions,
          startToTray: false,
          maximize: true,
        }),
      ).not.toThrow();
    });
  });

  describe('error messages', () => {
    it('provides helpful hint for --fullscreen + --width conflict', () => {
      try {
        validateMutuallyExclusiveFlags({
          fullscreen: true,
          width: 1400,
        });
        throw new Error('Expected to throw but did not');
      } catch (error) {
        expect(error).toBeInstanceOf(PakeError);
        const pakeError = error as PakeError;
        expect(pakeError.hint).toContain('--maximize');
      }
    });

    it('provides helpful hint for --start-to-tray + --maximize conflict', () => {
      try {
        validateMutuallyExclusiveFlags({
          startToTray: true,
          maximize: true,
        });
        throw new Error('Expected to throw but did not');
      } catch (error) {
        expect(error).toBeInstanceOf(PakeError);
        const pakeError = error as PakeError;
        expect(pakeError.hint).toContain('--maximize');
      }
    });
  });

  describe('valid combinations', () => {
    it('accepts all false values (defaults)', () => {
      expect(() =>
        validateMutuallyExclusiveFlags({
          fullscreen: false,
          maximize: false,
          startToTray: false,
        }),
      ).not.toThrow();
    });

    it('accepts --fullscreen with other unrelated flags', () => {
      expect(() =>
        validateMutuallyExclusiveFlags({
          ...baseOptions,
          fullscreen: true,
          darkMode: true,
          incognito: true,
          multiWindow: true,
        }),
      ).not.toThrow();
    });

    it('accepts --start-to-tray without --maximize', () => {
      expect(() =>
        validateMutuallyExclusiveFlags({
          ...baseOptions,
          startToTray: true,
          showSystemTray: true,
          hideOnClose: true,
        }),
      ).not.toThrow();
    });

    it('accepts --maximize with --height, --width independently', () => {
      // --maximize can coexist with size settings when --fullscreen is not set
      expect(() =>
        validateMutuallyExclusiveFlags({
          fullscreen: false,
          maximize: true,
          width: 1000,
          height: 900,
        }),
      ).not.toThrow();
    });
  });

  describe('partial options (from config files)', () => {
    it('handles undefined conflicting options gracefully', () => {
      expect(() =>
        validateMutuallyExclusiveFlags({
          fullscreen: true,
          // width and height undefined, should not throw
        }),
      ).not.toThrow();
    });

    it('validates when only some conflicting options are present', () => {
      expect(() =>
        validateMutuallyExclusiveFlags({
          fullscreen: true,
          maximize: true,
          // other options undefined
        }),
      ).toThrow();
    });
  });

  describe('return behavior', () => {
    it('returns undefined on success (no throw)', () => {
      const result = validateMutuallyExclusiveFlags({
        ...baseOptions,
        fullscreen: false,
      });
      expect(result).toBeUndefined();
    });

    it('throws PakeError on conflict', () => {
      expect(() =>
        validateMutuallyExclusiveFlags({
          fullscreen: true,
          maximize: true,
        }),
      ).toThrow(PakeError);
    });
  });
});
