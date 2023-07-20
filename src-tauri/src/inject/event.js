const shortcuts = {
  'ArrowUp': () => scrollTo(0, 0),
  'ArrowDown': () => scrollTo(0, document.body.scrollHeight),
  '[': () => window.history.back(),
  ']': () => window.history.forward(),
  'r': () => window.location.reload(),
  '-': () => zoomOut(),
  '=': () => zoomIn(),
  '+': () => zoomIn(),
  '0': () => setZoom('100%'),
};

function setZoom(zoom) {
  const html = document.getElementsByTagName('html')[0];
  html.style.zoom = zoom;
  window.localStorage.setItem('htmlZoom', zoom);
}

function zoomCommon(zoomChange) {
  const currentZoom = window.localStorage.getItem('htmlZoom') || '100%';
  setZoom(zoomChange(currentZoom));
}

function zoomIn() {
  zoomCommon((currentZoom) => `${Math.min(parseInt(currentZoom) + 10, 200)}%`);
}

function zoomOut() {
  zoomCommon((currentZoom) => `${Math.max(parseInt(currentZoom) - 10, 30)}%`);
}

function handleShortcut(event) {
  if (shortcuts[event.key]) {
    event.preventDefault();
    shortcuts[event.key]();
  }
}

// Judgment of file download.
function isDownloadLink(url) {
  const fileExtensions = [
    '3gp', '7z', 'ai', 'apk', 'avi', 'bmp', 'csv', 'dmg', 'doc', 'docx', 'fla', 'flv', 'gif', 'gz', 'gzip',
    'ico', 'iso', 'indd', 'jar', 'jpeg', 'jpg', 'm3u8', 'mov', 'mp3', 'mp4', 'mpa', 'mpg',
    'mpeg', 'msi', 'odt', 'ogg', 'ogv', 'pdf', 'png', 'ppt', 'pptx', 'psd', 'rar', 'raw', 'rss', 'svg',
    'swf', 'tar', 'tif', 'tiff', 'ts', 'txt', 'wav', 'webm', 'webp', 'wma', 'wmv', 'xls', 'xlsx', 'xml', 'zip',
  ];
  const downloadLinkPattern = new RegExp(`\\.(${fileExtensions.join('|')})$`, 'i');
  return downloadLinkPattern.test(url);
}

// No need to go to the download link.
function externalDownLoadLink() {
  return ['quickref.me'].indexOf(location.hostname) > -1;
}

// Directly jumping out without hostname address.
function externalTargetLink() {
  return ['zbook.lol'].indexOf(location.hostname) > -1;
}

document.addEventListener('DOMContentLoaded', () => {
  const tauri = window.__TAURI__;
  const appWindow = tauri.window.appWindow;
  const invoke = tauri.tauri.invoke;

  const topDom = document.createElement('div');
  topDom.id = 'pack-top-dom';
  document.body.appendChild(topDom);
  const domEl = document.getElementById('pack-top-dom');

  domEl.addEventListener('mousedown', (e) => {
    e.preventDefault();
    if (e.buttons === 1 && e.detail !== 2) {
      appWindow.startDragging().then();
    }
  });

  domEl.addEventListener('touchstart', () => {
    appWindow.startDragging().then();
  });

  domEl.addEventListener('dblclick', () => {
    appWindow.isFullscreen().then((fullscreen) => {
      appWindow.setFullscreen(!fullscreen).then();
    });
  });

  document.addEventListener('keyup', (event) => {
    if (/windows|linux/i.test(navigator.userAgent) && event.ctrlKey) {
      handleShortcut(event);
    }
    if (/macintosh|mac os x/i.test(navigator.userAgent) && event.metaKey) {
      handleShortcut(event);
    }
  });

  const isExternalLink = (url, host) => window.location.host !== host;
  const isDownloadRequired = (url, anchorElement, e) =>
    anchorElement.download || e.metaKey || e.ctrlKey || isDownloadLink(url);

  const handleExternalLink = (e, url) => {
    e.preventDefault();
    tauri.shell.open(url);
  };

  const handleDownloadLink = (e, url, filename) => {
    e.preventDefault();
    invoke('download_file', { params: { url, filename } });
  };

  const detectAnchorElementClick = (e) => {
    const anchorElement = e.target.closest('a');
    if (anchorElement && anchorElement.href) {
      const hrefUrl = new URL(anchorElement.href);
      const absoluteUrl = hrefUrl.href;
      let filename = anchorElement.download || getFilenameFromUrl(absoluteUrl);

      // Handling external link redirection.
      if (isExternalLink(absoluteUrl, hrefUrl.host) && (['_blank', '_new'].includes(anchorElement.target) || externalTargetLink())) {
        handleExternalLink(e, absoluteUrl);
        return;
      }

      // Process download links for Rust to handle.
      if (isDownloadRequired(absoluteUrl, anchorElement, e) && !externalDownLoadLink()) {
        handleDownloadLink(e, absoluteUrl, filename);
      }
    }
  };

  // Prevent some special websites from executing in advance, before the click event is triggered.
  document.addEventListener('click', detectAnchorElementClick, true);

  collectUrlToBlobs();
  detectDownloadByCreateAnchor();

  // Rewrite the window.open function.
  const originalWindowOpen = window.open;
  window.open = function(url, name, specs) {
    // Apple login and google login
    if (name === 'AppleAuthentication') {
      //do nothing
    } else if (specs.includes('height=') || specs.includes('width=')) {
      location.href = url;
    } else {
      const baseUrl = window.location.origin + window.location.pathname;
      const hrefUrl = new URL(url, baseUrl);
      tauri.shell.open(hrefUrl.href);
    }
    // Call the original window.open function to maintain its normal functionality.
    return originalWindowOpen.call(window, url, name, specs);
  };

  // Set the default zoom, There are problems with Loop without using try-catch.
  try {
    setDefaultZoom();
  } catch (e) {
    console.log(e);
  }

  // Fix Chinese input method "Enter" on Safari
  document.addEventListener('keydown', (e) => {
    if (e.keyCode === 229) e.stopPropagation();
  }, true);

});

function setDefaultZoom() {
  const htmlZoom = window.localStorage.getItem('htmlZoom');
  if (htmlZoom) {
    setZoom(htmlZoom);
  }
}

function getFilenameFromUrl(url) {
  const urlPath = new URL(url).pathname;
  return urlPath.substring(urlPath.lastIndexOf('/') + 1);
}

// Collect blob urls to blob by overriding window.URL.createObjectURL
function collectUrlToBlobs() {
  const backupCreateObjectURL = window.URL.createObjectURL;
  window.blobToUrlCaches = new Map();
  window.URL.createObjectURL = (blob) => {
    const url = backupCreateObjectURL.call(window.URL, blob);
    window.blobToUrlCaches.set(url, blob);
    return url;
  };
}

function convertBlobUrlToBinary(blobUrl) {
  return new Promise((resolve) => {
    const blob = window.blobToUrlCaches.get(blobUrl);
    const reader = new FileReader();

    reader.readAsArrayBuffer(blob);
    reader.onload = () => {
      resolve(reader.result);
    };
  });
}

async function downloadFromBlobUrl(blobUrl, filename) {
  try {
    const tauri = window.__TAURI__;
    const binary = await convertBlobUrlToBinary(blobUrl);

    await tauri.fs.writeBinaryFile(filename, binary, {
      dir: tauri.fs.BaseDirectory.Download,
    });

    const lang = getSystemLanguage();
    window.pakeToast(lang === 'en' ? 'Download successful, saved to download directory~' : '下载成功，已保存到下载目录~');
  } catch (error) {
    console.error('Error downloading from Blob URL:', error);
  }
}


// detect blob download by createElement("a")
function detectDownloadByCreateAnchor() {
  const originalCreateElement = document.createElement;

  document.createElement = function(el, ...args) {
    const element = originalCreateElement.call(this, el, ...args);

    if (el === 'a') {
      element.addEventListener('click', (event) => {
        const url = element.href;
        if (window.blobToUrlCaches.has(url)) {
          // Prevent default 'click' event if a blob URL is detected
          event.preventDefault();
          const filename = element.download || getFilenameFromUrl(url);
          downloadFromBlobUrl(url, filename);
        }
      });
    }

    return element;
  };
}


// Determine the language of the current system.
function getSystemLanguage() {
  const lang = navigator.language.substr(0, 2);
  return lang === 'ch' ? 'ch' : 'en';
}
