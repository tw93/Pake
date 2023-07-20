const shortcuts = {
  ArrowUp: () => scrollTo(0, 0),
  ArrowDown: () => scrollTo(0, document.body.scrollHeight),
  // Don't use command + ArrowLeft or command + ArrowRight
  // When editing text in page, it causes unintended page navigation.
  // ArrowLeft: () => window.history.back(),
  // ArrowRight: () => window.history.forward(),
  '[': () => window.history.back(),
  ']': () => window.history.forward(),
  r: () => window.location.reload(),
  '-': () => zoomOut(),
  '=': () => zoomIn(),
  '+': () => zoomIn(),
  0: () => setZoom('100%'),
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

//这里参考 ChatGPT 的代码
const uid = () => window.crypto.getRandomValues(new Uint32Array(1))[0];

function transformCallback(callback = () => {}, once = false) {
  const identifier = uid();
  const prop = `_${identifier}`;
  Object.defineProperty(window, prop, {
    value: (result) => {
      if (once) {
        Reflect.deleteProperty(window, prop);
      }
      return callback(result);
    },
    writable: false,
    configurable: true,
  });
  return identifier;
}

async function invoke(cmd, args) {
  return new Promise((resolve, reject) => {
    if (!window.__TAURI_POST_MESSAGE__)
      reject('__TAURI_POST_MESSAGE__ does not exist~');
    const callback = transformCallback((e) => {
      resolve(e);
      Reflect.deleteProperty(window, `_${error}`);
    }, true);
    const error = transformCallback((e) => {
      reject(e);
      Reflect.deleteProperty(window, `_${callback}`);
    }, true);
    window.__TAURI_POST_MESSAGE__({
      cmd,
      callback,
      error,
      ...args,
    });
  });
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

  const specialDownloadProtocal = ['blob', 'data'];

  const detectAnchorElementClick = (e) => {
    const anchorElement = e.target.closest('a');
    if (anchorElement && anchorElement.href) {
      const target = anchorElement.target;
      anchorElement.target = '_self';
      const hrefUrl = new URL(anchorElement.href);
      const absoluteUrl = hrefUrl.href;

      // Handling external link redirection.
      if (
        window.location.host !== hrefUrl.host &&
        (target === '_blank' || target === '_new' || externalTargetLink())
      ) {
        e.preventDefault && e.preventDefault();
        tauri.shell.open(absoluteUrl);
        return;
      }

      let filename = anchorElement.download || getFilenameFromUrl(absoluteUrl);

      // Process download links for Rust to handle.
      // If the download attribute is set, the download attribute is used as the file name.
      if (
        (anchorElement.download ||
          e.metaKey ||
          e.ctrlKey ||
          isDownloadLink(absoluteUrl)) &&
        !externalDownLoadLink() && specialDownloadProtocal.every(protocal => !absoluteUrl.startsWith(protocal))
      ) {
        e.preventDefault();
        invoke('download_file', {
          params: {
            url: absoluteUrl,
            filename,
          },
        });
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
});

function setDefaultZoom() {
  const htmlZoom = window.localStorage.getItem('htmlZoom');
  if (htmlZoom) {
    setZoom(htmlZoom);
  }
}

function getFilenameFromUrl(url) {
  const urlPath = new URL(url).pathname;
  const filename = urlPath.substring(urlPath.lastIndexOf('/') + 1);
  return filename;
}

function removeUrlParameters(url) {
  const parsedUrl = new URL(url);
  parsedUrl.search = '';
  return parsedUrl.toString();
}

// Toggle video playback when the window is hidden.
function toggleVideoPlayback(pause) {
  const videos = document.getElementsByTagName('video');
  for (const video of videos) {
    if (pause) {
      video.pause();
    } else {
      video.play();
    }
  }
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
      resolve(Array.from(new Uint8Array(reader.result)));
    };
  });
}

function downladFromDataUri(dataURI, filename) {
  const byteString = atob(dataURI.split(',')[1]);
  // write the bytes of the string to an ArrayBuffer
  const bufferArray = new ArrayBuffer(byteString.length);

  // create a view into the buffer
  const binary = new Uint8Array(bufferArray);

  // set the bytes of the buffer to the correct values
  for (var i = 0; i < byteString.length; i++) {
    binary[i] = byteString.charCodeAt(i);
  }

  // write the ArrayBuffer to a binary, and you're done
  invoke('download_file_by_binary', {
    params: {
      filename,
      binary: Array.from(binary)
    },
  });
}

function downloadFromBlobUrl(blobUrl, filename) {
  convertBlobUrlToBinary(blobUrl).then((binary) => {
    invoke('download_file_by_binary', {
      params: {
        filename,
        binary
      },
    });
  });
}

// detect blob download by createElement("a")
function detectDownloadByCreateAnchor() {
  const createEle = document.createElement;
  document.createElement = (el) => {
    if (el !== 'a') return createEle.call(document, el);
    const anchorEle = createEle.call(document, el);

    // use addEventListener to avoid overriding the original click event.
    anchorEle.addEventListener('click', () => {
      const url = anchorEle.href;
      const filename = anchorEle.download || getFilenameFromUrl(url);
      if (window.blobToUrlCaches.has(url)) {
        downloadFromBlobUrl(url, filename);
        // case: downoload from dataURL -> convert dataURL -> 
      } else if (url.startsWith('data:')) {
        downladFromDataUri(url, filename);
      }
    }, true);

    return anchorEle;
  };
}
