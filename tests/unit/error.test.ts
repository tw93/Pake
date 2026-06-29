import { describe, it, expect } from 'vitest';
import { PakeError, isPakeError } from '@/utils/error';

describe('PakeError', () => {
  it('is an Error flagged as a user error with the right name', () => {
    const err = new PakeError('boom');

    expect(err).toBeInstanceOf(Error);
    expect(err.isUserError).toBe(true);
    expect(err.name).toBe('PakeError');
    expect(err.message).toBe('boom');
  });
});

describe('isPakeError', () => {
  it('returns true for a PakeError instance', () => {
    expect(isPakeError(new PakeError('x'))).toBe(true);
  });

  it('returns true for a duck-typed object with isUserError === true', () => {
    // Cross-module instances may fail instanceof, so the flag is also accepted.
    expect(isPakeError({ isUserError: true })).toBe(true);
  });

  it('returns false for a plain Error', () => {
    expect(isPakeError(new Error('x'))).toBe(false);
  });

  it('returns false for an object whose isUserError is not strictly true', () => {
    expect(isPakeError({ isUserError: false })).toBe(false);
    expect(isPakeError({})).toBe(false);
  });

  it('returns false for null and undefined (typeof null === "object" guard)', () => {
    expect(isPakeError(null)).toBe(false);
    expect(isPakeError(undefined)).toBe(false);
  });
});
