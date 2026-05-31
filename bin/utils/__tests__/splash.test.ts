import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  generateSplashHtml,
  generateOfflineHtml,
  fetchOgImage,
  processSplashAsset,
} from '../splash';
import fsExtra from 'fs-extra';
import path from 'path';

describe('generateSplashHtml', () => {
  it('returns valid HTML with centered image', () => {
    const html = generateSplashHtml('logo.png', 'icon.png');
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('logo.png');
    expect(html).toContain('icon.png');
    expect(html).toContain('display: flex');
    expect(html).toContain('justify-content: center');
  });

  it('handles paths with spaces', () => {
    const html = generateSplashHtml('my logo.png', 'icon.png');
    expect(html).toContain('my logo.png');
  });

  it('includes dark mode media query', () => {
    const html = generateSplashHtml('logo.png', 'icon.png');
    expect(html).toContain('prefers-color-scheme: dark');
  });

  it('includes fade-in animation', () => {
    const html = generateSplashHtml('logo.png', 'icon.png');
    expect(html).toContain('fadeIn');
    expect(html).toContain('fadeOut');
  });
});

describe('generateOfflineHtml', () => {
  it('returns valid HTML with retry button', () => {
    const html = generateOfflineHtml();
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('No Internet Connection');
    expect(html).toContain('retry()');
    expect(html).toContain('retry-btn');
  });

  it('includes dark mode support', () => {
    const html = generateOfflineHtml();
    expect(html).toContain('prefers-color-scheme: dark');
  });

  it('includes spinner for loading state', () => {
    const html = generateOfflineHtml();
    expect(html).toContain('spinner');
    expect(html).toContain('loading');
  });

  it('has localStorage for URL persistence', () => {
    const html = generateOfflineHtml();
    expect(html).toContain('localStorage');
    expect(html).toContain('pake_original_url');
  });
});

describe('fetchOgImage', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('resolves absolute og:image URLs', async () => {
    const htmlResponse = new Response(
      '<html><meta property="og:image" content="https://example.com/image.png"></html>',
      { status: 200 },
    );
    const imgResponse = new Response(Buffer.from('fake-image'), {
      status: 200,
      headers: { 'content-type': 'image/png', 'content-length': '1000' },
    });

    vi.mocked(fetch)
      .mockResolvedValueOnce(htmlResponse)
      .mockResolvedValueOnce(imgResponse);

    const result = await fetchOgImage('https://example.com');
    expect(result).toBe('https://example.com/image.png');
  });

  it('resolves relative og:image URLs', async () => {
    const htmlResponse = new Response(
      '<html><meta property="og:image" content="/images/og.png"></html>',
      { status: 200 },
    );
    const imgResponse = new Response(Buffer.from('fake-image'), {
      status: 200,
      headers: { 'content-type': 'image/png', 'content-length': '1000' },
    });

    vi.mocked(fetch)
      .mockResolvedValueOnce(htmlResponse)
      .mockResolvedValueOnce(imgResponse);

    const result = await fetchOgImage('https://example.com/page');
    expect(result).toBe('https://example.com/images/og.png');
  });

  it('returns null when no og:image tag exists', async () => {
    const htmlResponse = new Response('<html><body>No og image</body></html>', {
      status: 200,
    });
    vi.mocked(fetch).mockResolvedValueOnce(htmlResponse);

    const result = await fetchOgImage('https://example.com');
    expect(result).toBeNull();
  });

  it('returns null on network error', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));

    const result = await fetchOgImage('https://example.com');
    expect(result).toBeNull();
  });

  it('returns null when image is too large', async () => {
    const htmlResponse = new Response(
      '<html><meta property="og:image" content="https://example.com/huge.png"></html>',
      { status: 200 },
    );
    const imgResponse = new Response(Buffer.from('fake-image'), {
      status: 200,
      headers: { 'content-type': 'image/png', 'content-length': '600000' },
    });

    vi.mocked(fetch)
      .mockResolvedValueOnce(htmlResponse)
      .mockResolvedValueOnce(imgResponse);

    const result = await fetchOgImage('https://example.com');
    expect(result).toBeNull();
  });

  it('returns null when og:image is not an image', async () => {
    const htmlResponse = new Response(
      '<html><meta property="og:image" content="https://example.com/page"></html>',
      { status: 200 },
    );
    const imgResponse = new Response(Buffer.from('not-an-image'), {
      status: 200,
      headers: { 'content-type': 'text/html', 'content-length': '100' },
    });

    vi.mocked(fetch)
      .mockResolvedValueOnce(htmlResponse)
      .mockResolvedValueOnce(imgResponse);

    const result = await fetchOgImage('https://example.com');
    expect(result).toBeNull();
  });
});

describe('processSplashAsset', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns app icon when no splash configured', async () => {
    const result = await processSplashAsset('', false, 'https://example.com', 'icon.png');
    expect(result.assetFilename).toBe('icon.png');
    expect(result.assetPath).toBe('icon.png');
  });
});
