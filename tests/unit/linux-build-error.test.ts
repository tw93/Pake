import { describe, it, expect } from 'vitest';
import { appendAppImageGuidance } from '@/utils/linuxBuildError';

describe('appendAppImageGuidance', () => {
  it('appends guidance listing every known cause and the deb fallback', () => {
    const result = appendAppImageGuidance(new Error('boom'));
    expect(result.message).toContain('boom'); // original message preserved
    expect(result.message).toContain('Linux AppImage Build Failed');
    expect(result.message).toContain('NO_STRIP=1 was already applied');
    expect(result.message).toContain('gdk-pixbuf');
    expect(result.message).toContain('/dev/fuse');
    expect(result.message).toContain('--targets deb');
  });

  it('returns the same Error instance so the stack is preserved', () => {
    const original = new Error('Command failed with exit code 1');
    expect(appendAppImageGuidance(original)).toBe(original);
  });

  it('wraps non-Error throwables', () => {
    const result = appendAppImageGuidance('raw string failure');
    expect(result).toBeInstanceOf(Error);
    expect(result.message).toContain('raw string failure');
    expect(result.message).toContain('Linux AppImage Build Failed');
  });
});
