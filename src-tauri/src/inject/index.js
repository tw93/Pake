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
    const origin = e.target.closest('a');
    if (origin && origin.href) {
      const target = origin.target;
      origin.target = '_self';
      const hrefUrl = new URL(origin.href);

      if (
        window.location.host !== hrefUrl.host && // 如果 a 标签内链接的域名和当前页面的域名不一致 且
        target === '_blank' // a 标签内链接的 target 属性为 _blank 时
      ) {
        e.preventDefault();
        invoke('open_browser', { url: origin.href });
      }
    }
  });

  setDefaultZoom();
});

function setDefaultZoom() {
  const htmlZoom = window.localStorage.getItem('htmlZoom');
  if (htmlZoom) {
    setZoom(htmlZoom);
  }
}
