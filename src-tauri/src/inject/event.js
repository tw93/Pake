const shortcuts = {
  ArrowUp: () => scrollTo(0, 0),
  ArrowDown: () => scrollTo(0, document.body.scrollHeight),
  ArrowLeft: () => window.history.back(),
  ArrowRight: () => window.history.forward(),
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

document.addEventListener('DOMContentLoaded', () => {
  const topDom = document.createElement('div');
  topDom.id = 'pack-top-dom';
  document.body.appendChild(topDom);
  const domEl = document.getElementById('pack-top-dom');

  domEl.addEventListener('mousedown', (e) => {
    e.preventDefault();
    if (e.buttons === 1 && e.detail !== 2) {
      invoke('drag_window');
    }
  });

  domEl.addEventListener('touchstart', () => {
    invoke('drag_window');
  });

  domEl.addEventListener('dblclick', () => {
    invoke('fullscreen');
  });

  document.addEventListener('keyup', (event) => {
    if (/windows|linux/i.test(navigator.userAgent) && event.ctrlKey) {
      handleShortcut(event);
    }
    if (/macintosh|mac os x/i.test(navigator.userAgent) && event.metaKey) {
      handleShortcut(event);
    }
  });

  document.addEventListener('click', (e) => {
    const anchorElement = e.target.closest('a');

    if (anchorElement && anchorElement.href) {
      const target = anchorElement.target;
      anchorElement.target = '_self';
      const hrefUrl = new URL(anchorElement.href);
      const absoluteUrl = hrefUrl.href;

      // 处理外部链接跳转
      if (window.location.host !== hrefUrl.host && target === '_blank') {
        e.preventDefault();
        invoke('open_browser', { url: absoluteUrl });
        return;
      }

      // 处理下载链接让Rust处理
      if (/\.[a-zA-Z0-9]+$/i.test(absoluteUrl)) {
        e.preventDefault();
        invoke('download_file', {
          params: {
            url: absoluteUrl,
            filename: getFilenameFromUrl(absoluteUrl),
          },
        });
      }
    }
  });

  setDefaultZoom();

  // Rewrite the window.open function.
  const originalWindowOpen = window.open;
  window.open = function (url, name, specs) {
    console.log('0window.open>>>>>>>', url, name, specs);
    // Apple login and google login
    if (name === 'AppleAuthentication') {
      //do nothing
    } else if (specs.includes('height=') || specs.includes('height=')) {
      location.href = url;
    } else {
      const baseUrl = window.location.origin + window.location.pathname;
      const hrefUrl = new URL(url, baseUrl);
      invoke('open_browser', { url: hrefUrl.href });
    }
    // Call the original window.open function to maintain its normal functionality.
    return originalWindowOpen.call(window, url, name, specs);
  };
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
