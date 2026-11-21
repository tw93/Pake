import { describe, expect, it } from 'vitest';
// @ts-expect-error a plain script without types
import { verdict } from '../blocking/run.mjs';

const page = (over: Record<string, number>) => ({
  elements: 2000,
  visible: 1500,
  text: 4000,
  svg: 20,
  svgHidden: 0,
  ...over,
});

describe('the real-page verdict of tests/blocking/run.mjs', () => {
  it('fails a page whose icons are all hidden, as I-23 shipped', () => {
    expect(verdict(page({}), page({ svgHidden: 20 }))).toMatch(
      /20 of 20 svg hidden/,
    );
  });

  it('fails a page that lost most of what it shows or says', () => {
    expect(verdict(page({}), page({ visible: 400 }))).toMatch(/visible/);
    expect(verdict(page({}), page({ text: 900 }))).toMatch(/characters/);
  });

  it('fails a page that loads only without blocking', () => {
    expect(verdict(page({}), { error: 'timeout' })).toMatch(/did not load/);
  });

  it('passes a page that lost an ad, a tracker pixel or a cookie notice', () => {
    expect(
      verdict(page({}), page({ visible: 1400, text: 3400, svgHidden: 2 })),
    ).toBe('');
    // grok.com: the cookie notice is more than half of a short page's text.
    expect(verdict(page({ text: 806 }), page({ text: 302 }))).toBe('');
  });

  it('passes a page that hides its own icons without blocking too', () => {
    expect(verdict(page({ svgHidden: 14 }), page({ svgHidden: 15 }))).toBe('');
  });
});
