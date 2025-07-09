
const shortcuts = {
  '[': () => window.history.back(),
  ']': () => window.history.forward(),
  '-': () => zoomOut(),
  '=': () => zoomIn(),
  '+': () => zoomIn(),
  0: () => setZoom('100%'),
  r: () => window.location.reload(),
  ArrowUp: () => scrollTo(0, 0),
  ArrowDown: () => scrollTo(0, document.body.scrollHeight),
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
  zoomCommon(currentZoom => `${Math.min(parseInt(currentZoom) + 10, 200)}%`);
}

function zoomOut() {
  zoomCommon(currentZoom => `${Math.max(parseInt(currentZoom) - 10, 30)}%`);
}

function handleShortcut(event) {
  if (shortcuts[event.key]) {
    event.preventDefault();
    shortcuts[event.key]();
  }
}

// Judgment of file download.
function isDownloadLink(url) {
  // prettier-ignore
  const fileExtensions = [
    '3gp', '7z', 'ai', 'apk', 'avi', 'bmp', 'csv', 'dmg', 'doc', 'docx',
    'fla', 'flv', 'gif', 'gz', 'gzip', 'ico', 'iso', 'indd', 'jar', 'jpeg',
    'jpg', 'm3u8', 'mov', 'mp3', 'mp4', 'mpa', 'mpg', 'mpeg', 'msi', 'odt',
    'ogg', 'ogv', 'pdf', 'png', 'ppt', 'pptx', 'psd', 'rar', 'raw',
    'svg', 'swf', 'tar', 'tif', 'tiff', 'ts', 'txt', 'wav', 'webm', 'webp',
    'wma', 'wmv', 'xls', 'xlsx', 'xml', 'zip', 'json', 'yaml', '7zip', 'mkv',
  ];
  const downloadLinkPattern = new RegExp(`\\.(${fileExtensions.join('|')})$`, 'i');
  return downloadLinkPattern.test(url);
}

document.addEventListener('DOMContentLoaded', () => {
  const tauri = window.__TAURI__;
  const appWindow = tauri.window.getCurrentWindow();
  const invoke = tauri.core.invoke;

  if (!document.getElementById('pake-top-dom')) {
    const topDom = document.createElement('div');
    topDom.id = 'pake-top-dom';
    document.body.appendChild(topDom);
  }

  const domEl = document.getElementById('pake-top-dom');

  domEl.addEventListener('touchstart', () => {
    appWindow.startDragging();
  });

  domEl.addEventListener('mousedown', e => {
    e.preventDefault();
    if (e.buttons === 1 && e.detail !== 2) {
      appWindow.startDragging();
    }
  });

  domEl.addEventListener('dblclick', () => {
    appWindow.isFullscreen().then(fullscreen => {
      appWindow.setFullscreen(!fullscreen);
    });
  });

  if (window['pakeConfig']?.disabled_web_shortcuts !== true) {
    document.addEventListener('keyup', event => {
      if (/windows|linux/i.test(navigator.userAgent) && event.ctrlKey) {
        handleShortcut(event);
      }
      if (/macintosh|mac os x/i.test(navigator.userAgent) && event.metaKey) {
        handleShortcut(event);
      }
    });
  }

  // Collect blob urls to blob by overriding window.URL.createObjectURL
  function collectUrlToBlobs() {
    const backupCreateObjectURL = window.URL.createObjectURL;
    window.blobToUrlCaches = new Map();
    window.URL.createObjectURL = blob => {
      const url = backupCreateObjectURL.call(window.URL, blob);
      window.blobToUrlCaches.set(url, blob);
      return url;
    };
  }

  function convertBlobUrlToBinary(blobUrl) {
    return new Promise(resolve => {
      const blob = window.blobToUrlCaches.get(blobUrl);
      const reader = new FileReader();

      reader.readAsArrayBuffer(blob);
      reader.onload = () => {
        resolve(Array.from(new Uint8Array(reader.result)));
      };
    });
  }

  function downloadFromDataUri(dataURI, filename) {
    const byteString = atob(dataURI.split(',')[1]);
    // write the bytes of the string to an ArrayBuffer
    const bufferArray = new ArrayBuffer(byteString.length);

    // create a view into the buffer
    const binary = new Uint8Array(bufferArray);

    // set the bytes of the buffer to the correct values
    for (let i = 0; i < byteString.length; i++) {
      binary[i] = byteString.charCodeAt(i);
    }

    // write the ArrayBuffer to a binary, and you're done
    invoke('download_file_by_binary', {
      params: {
        filename,
        binary: Array.from(binary),
      },
    });
  }

  function downloadFromBlobUrl(blobUrl, filename) {
    convertBlobUrlToBinary(blobUrl).then(binary => {
      invoke('download_file_by_binary', {
        params: {
          filename,
          binary,
        },
      });
    });
  }

  // detect blob download by createElement("a")
  function detectDownloadByCreateAnchor() {
    const createEle = document.createElement;
    document.createElement = el => {
      if (el !== 'a') return createEle.call(document, el);
      const anchorEle = createEle.call(document, el);

      // use addEventListener to avoid overriding the original click event.
      anchorEle.addEventListener(
        'click',
        e => {
          const url = anchorEle.href;
          const filename = anchorEle.download || getFilenameFromUrl(url);
          if (window.blobToUrlCaches.has(url)) {
            downloadFromBlobUrl(url, filename);
            // case: download from dataURL -> convert dataURL ->
          } else if (url.startsWith('data:')) {
            downloadFromDataUri(url, filename);
          }
        },
        true,
      );

      return anchorEle;
    };
  }

  // process special download protocol['data:','blob:']
  const isSpecialDownload = url => ['blob', 'data'].some(protocol => url.startsWith(protocol));

  const isDownloadRequired = (url, anchorElement, e) => anchorElement.download || e.metaKey || e.ctrlKey || isDownloadLink(url);

  const handleExternalLink = url => {
    invoke('plugin:shell|open', {
      path: url,
    });
  };

  const detectAnchorElementClick = e => {
    const anchorElement = e.target.closest('a');

    if (anchorElement && anchorElement.href) {
      const target = anchorElement.target;
      const hrefUrl = new URL(anchorElement.href);
      const absoluteUrl = hrefUrl.href;
      let filename = anchorElement.download || getFilenameFromUrl(absoluteUrl);

      // Handling external link redirection, _blank will automatically open.
      if (target === '_blank') {
        e.preventDefault();
        return;
      }

      if (target === '_new') {
        e.preventDefault();
        handleExternalLink(absoluteUrl);
        return;
      }

      // Process download links for Rust to handle.
      if (isDownloadRequired(absoluteUrl, anchorElement, e) && !isSpecialDownload(absoluteUrl)) {
        e.preventDefault();
        invoke('download_file', { params: { url: absoluteUrl, filename } });
      }
    }
  };

  // Prevent some special websites from executing in advance, before the click event is triggered.
  document.addEventListener('click', detectAnchorElementClick, true);

  collectUrlToBlobs();
  detectDownloadByCreateAnchor();

  // Rewrite the window.open function.
  const originalWindowOpen = window.open;
  window.open = async function(url, name, specs = '') {
    // Apple login and google login
    if (name === 'AppleAuthentication') {
      //do nothing
    } else if (specs && (specs.includes('height=') || specs.includes('width='))) {
      location.href = url;
    } else {
      const baseUrl = window.location.origin + window.location.pathname;
      const hrefUrl = new URL(url, baseUrl);
      // handleExternalLink(hrefUrl.href);
      
      window.location.href = hrefUrl;
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
  document.addEventListener(
    'keydown',
    e => {
      if (e.keyCode === 229) e.stopPropagation();
    },
    true,
  );
});

document.addEventListener('DOMContentLoaded', function () {
  let permVal = 'granted';
  window.Notification = function (title, options) {
    const { invoke } = window.__TAURI__.core;
    const body = options?.body || '';
    let icon = options?.icon || '';

    // If the icon is a relative path, convert to full path using URI
    if (icon.startsWith('/')) {
      icon = window.location.origin + icon;
    }

    invoke('send_notification', {
      params: {
        title,
        body,
        icon,
      },
    });
  };

  window.Notification.requestPermission = async () => 'granted';

  Object.defineProperty(window.Notification, 'permission', {
    enumerable: true,
    get: () => permVal,
    set: v => {
      permVal = v;
    },
  });
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


function interceptXhrResponse(urlPattern, responseHandler, requestUrlModifier) {
  let interceptionRules = [];
  let oldUrl = '';

  // 添加拦截规则
  interceptionRules.push({ urlPattern, responseHandler, requestUrlModifier });
  // 处理拦截后的响应内容
  function handleInterceptedResponse(response, requestMethod, requestHeaders, requestBody, url) {
    const interceptionRule = interceptionRules.find(({ urlPattern }) => {
      return urlPattern.test(url)
    });
    if (interceptionRule) {
      const { responseHandler, requestUrlModifier } = interceptionRule;
      // 如果存在请求 URL 修改函数，先修改请求 URL
      if (typeof requestUrlModifier === 'function') {
        url = requestUrlModifier(url);
      }

      return responseHandler(requestMethod, requestHeaders, requestBody, url, oldUrl);
    }
    return response;
  }
  // 重写 XMLHttpRequest 对象
  const OriginalXMLHttpRequest = window.XMLHttpRequest;
  class XMLHttpRequest extends OriginalXMLHttpRequest {
    constructor() {
      super();
      this._requestMethod = null;
      this._requestHeaders = new Headers();
      this._requestBody = null;
    }

    open(method, url, async) {
      this._requestMethod = method;
      this._requestHeaders = new Headers();

      oldUrl = url
      // 在发送请求前，检查是否有 URL 修改规则
      const interceptionRule = interceptionRules.find(({ urlPattern }) =>
        urlPattern.test(url)
      );
      if (interceptionRule && typeof interceptionRule.requestUrlModifier === 'function') {
        url = interceptionRule.requestUrlModifier(url);
      }
      super.open(method, url, async);
    }
    setRequestHeader(header, value) {
      this._requestHeaders.append(header, value);
      return super.setRequestHeader(header, value);
    }
    send(body) {
      this._requestBody = JSON.parse(body) || null;
      return super.send(body);
    }
    get responseText() {
      if (this.readyState !== 4) {
        return super.responseText;
      }
      return handleInterceptedResponse(super.responseText, this._requestMethod,this._requestHeaders,this._requestBody, oldUrl);
    }
    get response() {
      if (this.readyState !== 4) {
        return super.response;
      }
      return handleInterceptedResponse(super.response, this._requestMethod,this._requestHeaders,this._requestBody, oldUrl);
    }
  }
  window.XMLHttpRequest = XMLHttpRequest;
}

// 使用拦截函数来修改响应内容和请求 URL
interceptXhrResponse(/^(https?:\/\/)?(localhost|127\.0\.0\.1|192\.168\.\d+).*/, 
  async (requestMethod, requestHeaders, requestBody, url, oldUrl) => {
    const tauri = window.__TAURI__;
    const option = {
      method: requestMethod,
      Headers: requestHeaders,
    }
    if(requestMethod.toUpperCase() === 'GET') {
      option.query = requestBody
    } else {
      option.body = requestBody
    }
    const res = await tauri.http.fetch(oldUrl, )

    return res;
  }, 
  (originalUrl) => {
    // 这里可以根据需要修改 URL，例如添加或删除某些参数
    return 'https://ai.goviewlink.com/proxy/test';
  }
);