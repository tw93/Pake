import path from 'path';
import fsExtra from 'fs-extra';
import logger from '@/options/logger';
import { npmDirectory } from '@/utils/dir';

const OG_IMAGE_MAX_SIZE = 500 * 1024; // 500KB

export function generateSplashHtml(assetPath: string, iconPath: string, isIconFallback: boolean = false): string {
  if (isIconFallback) {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      display: flex; justify-content: center; align-items: center;
      height: 100vh; background: #1a1a1a;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      animation: fadeIn 0.3s ease-in;
    }
    .icon-box {
      display: flex; justify-content: center; align-items: center;
      width: 200px; height: 200px; border-radius: 16px;
      background: #2C2C2E;
      box-shadow: 0 2px 12px rgba(0,0,0,0.3);
    }
    .icon-box img {
      max-width: 120px; max-height: 120px; object-fit: contain;
      border-radius: 12px;
    }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }
  </style>
</head>
<body>
  <div class="icon-box">
    <img src="${assetPath}" alt="Loading...">
  </div>
</body>
</html>`;
  }

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      display: flex; justify-content: center; align-items: center;
      height: 100vh; background: #1a1a1a;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      animation: fadeIn 0.3s ease-in;
      overflow: hidden;
    }
    img {
      width: 100%; height: 100%; object-fit: cover;
      border-radius: 16px;
    }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }
  </style>
</head>
<body>
  <img src="${assetPath}" alt="Loading..." onerror="this.src='${iconPath}'">
</body>
</html>`;
}

export function generateOfflineHtml(): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      display: flex; justify-content: center; align-items: center;
      height: 100vh; background: #FFFFFF;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
    }
    @media (prefers-color-scheme: dark) {
      body { background: #1a1a1a; }
      .heading { color: #FFFFFF; }
      .subtext { color: #AEAEB2; }
      .icon { stroke: #636366; }
      .retry-btn { background: #0A84FF; }
      .retry-btn:hover { background: #409CFF; }
    }
    .card { text-align: center; max-width: 400px; padding: 40px; }
    .icon { width: 64px; height: 64px; stroke: #8E8E93; margin-bottom: 24px; }
    .heading { font-size: 24px; font-weight: 700; color: #000000; margin-bottom: 8px; }
    .subtext { font-size: 16px; color: #8E8E93; margin-bottom: 32px; }
    .retry-btn {
      display: inline-flex; align-items: center; justify-content: center;
      min-width: 120px; height: 44px; padding: 0 16px;
      background: #007AFF; color: #FFFFFF; border: none; border-radius: 8px;
      font-size: 16px; font-weight: 600; cursor: pointer;
      transition: background 0.15s;
    }
    .retry-btn:hover { background: #0056CC; }
    .retry-btn:disabled { background: #C7C7CC; cursor: not-allowed; }
    .retry-btn .spinner { display: none; width: 20px; height: 20px; border: 2px solid #FFF; border-top-color: transparent; border-radius: 50%; animation: spin 0.6s linear infinite; }
    .retry-btn.loading .btn-text { display: none; }
    .retry-btn.loading .spinner { display: inline-block; }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="card">
    <svg class="icon" viewBox="0 0 24 24" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M1 1l22 22"/>
      <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/>
      <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/>
      <path d="M10.71 5.05A16 16 0 0 1 22.56 9"/>
      <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/>
      <path d="M8.53 16.11a6 6 0 0 1 6.95 0"/>
      <line x1="12" y1="20" x2="12.01" y2="20"/>
    </svg>
    <h1 class="heading">No Internet Connection</h1>
    <p class="subtext">Check your network and try again</p>
    <button class="retry-btn" onclick="retry()">
      <span class="btn-text">Retry</span>
      <span class="spinner"></span>
    </button>
  </div>
  <script>
    let cooldown = false;
    function getLocalUrl(file) {
      if (window.location.hostname === 'tauri.localhost' || window.location.protocol === 'tauri:') {
        return file;
      }
      return 'https://tauri.localhost/' + file;
    }
    function retry() {
      if (cooldown) return;
      cooldown = true;
      const btn = document.querySelector('.retry-btn');
      btn.classList.add('loading');
      btn.disabled = true;
      setTimeout(() => {
        const original = localStorage.getItem('pake_original_url');
        if (original) window.location.href = original;
        else window.location.reload();
      }, 3000);
    }
  </script>
</body>
</html>`;
}

export async function fetchOgImage(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Pake/1.0)' },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return null;

    const html = await response.text();
    const ogMatch = html.match(
      /<meta\s+(?:[^>]*?)property=["']og:image["']\s+(?:[^>]*?)content=["']([^"']+)["']/i,
    );
    if (!ogMatch) return null;

    let imageUrl = ogMatch[1];
    if (imageUrl.startsWith('/')) {
      const base = new URL(url);
      imageUrl = `${base.origin}${imageUrl}`;
    } else if (!imageUrl.startsWith('http')) {
      const base = new URL(url);
      imageUrl = new URL(imageUrl, base.origin).toString();
    }

    const imgResponse = await fetch(imageUrl, {
      signal: AbortSignal.timeout(10000),
    });
    if (!imgResponse.ok) return null;

    const contentLength = imgResponse.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > OG_IMAGE_MAX_SIZE) {
      logger.warn('✼ og:image too large, falling back to app icon.');
      return null;
    }

    const contentType = imgResponse.headers.get('content-type');
    if (contentType && !contentType.startsWith('image/')) {
      return null;
    }

    return imageUrl;
  } catch {
    return null;
  }
}

export async function processSplashAsset(
  splash: string,
  autoSplash: boolean,
  targetUrl: string,
  appIcon: string,
): Promise<{ assetFilename: string; assetPath: string }> {
  const distDir = path.join(npmDirectory, 'dist');

  if (splash) {
    const resolved = path.resolve(splash);
    if (resolved.startsWith('http://') || resolved.startsWith('https://')) {
      const filename = `splash-asset${getExtension(resolved)}`;
      const dest = path.join(distDir, filename);
      try {
        const response = await fetch(resolved, { signal: AbortSignal.timeout(15000) });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const buffer = Buffer.from(await response.arrayBuffer());
        await fsExtra.writeFile(dest, buffer);
        return { assetFilename: filename, assetPath: filename };
      } catch (err) {
        logger.warn(`✼ Failed to download splash image: ${err instanceof Error ? err.message : String(err)}`);
        logger.warn('✼ Falling back to app icon.');
        return { assetFilename: 'icon.png', assetPath: appIcon };
      }
    }

    if (await fsExtra.pathExists(resolved)) {
      const ext = path.extname(resolved);
      const filename = `splash-asset${ext}`;
      const dest = path.join(distDir, filename);
      await fsExtra.copy(resolved, dest);
      return { assetFilename: filename, assetPath: filename };
    }

    logger.warn('✼ Splash image not found, falling back to app icon.');
    return { assetFilename: 'icon.png', assetPath: appIcon };
  }

  if (autoSplash) {
    const ogUrl = await fetchOgImage(targetUrl);
    if (ogUrl) {
      const ext = getExtension(ogUrl);
      const filename = `splash-asset${ext}`;
      const dest = path.join(distDir, filename);
      try {
        const response = await fetch(ogUrl, { signal: AbortSignal.timeout(15000) });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const buffer = Buffer.from(await response.arrayBuffer());
        if (buffer.length > OG_IMAGE_MAX_SIZE) {
          logger.warn('✼ Downloaded og:image too large, falling back to app icon.');
          return { assetFilename: 'icon.png', assetPath: appIcon };
        }
        await fsExtra.writeFile(dest, buffer);
        return { assetFilename: filename, assetPath: filename };
      } catch {
        logger.warn('✼ Failed to download og:image, falling back to app icon.');
      }
    }
    return { assetFilename: 'icon.png', assetPath: appIcon };
  }

  return { assetFilename: 'icon.png', assetPath: appIcon };
}

function getExtension(urlOrPath: string): string {
  try {
    const url = new URL(urlOrPath);
    const pathname = url.pathname;
    const ext = path.extname(pathname).split('?')[0];
    if (ext && ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'].includes(ext.toLowerCase())) {
      return ext;
    }
  } catch {
    const ext = path.extname(urlOrPath);
    if (ext) return ext;
  }
  return '.png';
}
