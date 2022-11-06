window.addEventListener('DOMContentLoaded', (_event) => {
  const style = document.createElement('style');
  style.innerHTML = `
    // mini twitter 代码存到 dist 下面，为了防止干扰，需要的时候 copy 过来即可

    .panel.give_me .nav_view {
      top: 154px !important;
    }

    .columns .column #header{
      padding-top: 30px;
    }

    #page .main_header, #ReactApp .lark .main-wrapper > div, #ReactApp .lark .sidebar-user-info, .explore-wrapper .yuque-header-wrapper {
      padding-top: 20px;
    }

    #page #footer-wrapper,
    .drawing-board .toolbar .toolbar-action,
    .c-swiper-container,
    .download_entry,
    .lang, .copyright,
    .wwads-cn, .adsbygoogle,
    #Bottom > div.content > div.inner,
    #Rightbar .sep20:nth-of-type(5),
    #Rightbar > div.box:nth-child(4),
    #Main > div.box:nth-child(8) > div
    #Wrapper > div.sep20,
    #Main > div.box:nth-child(8),
    #Rightbar > div:nth-child(6) > div.sidebar_compliance {
      display: none !important;
    }

    ytd-masthead>#container.style-scope.ytd-masthead {
      padding-top: 12px !important;
    }

    .wrap.h1body-exist.max-container > div.menu-tocs > div.menu-btn{
      top: 28px;
    }

    #Wrapper{
      background-color: #F8F8F8 !important;
      background-image:none !important;
    }

    #Top {
      border-bottom: none;
    }

    .container-with-note #home, .container-with-note #switcher{
      top: 30px;
    }

    .geist-page nav.dashboard_nav__PRmJv {
      padding-top:10px;
    }

    .geist-page .submenu button{
      margin-top:24px;
    }

    #pack-top-dom:active {
      cursor: grabbing;
      cursor: -webkit-grabbing;
    }

    #pack-top-dom{
      position:fixed;
      background:transparent;
      top:0;
      width: 100%;
      height: 20px;
      cursor: grab;
      cursor: -webkit-grab;
    }
  `;
  document.head.append(style);
  const topDom = document.createElement('div');
  topDom.id = 'pack-top-dom';
  document.body.appendChild(topDom);

  const domEl = document.getElementById('pack-top-dom');

  domEl.addEventListener('mousedown', (e) => {
    if (e.buttons === 1 && e.detail !== 2) {
      window.ipc.postMessage('drag_window');
    }
  });

  domEl.addEventListener('touchstart', (e) => {
    window.ipc.postMessage('drag_window');
  });

  domEl.addEventListener('dblclick', (e) => {
    window.ipc.postMessage('fullscreen');
  });

  document.addEventListener('keyup', function (event) {
    if (event.key === 'ArrowUp' && event.metaKey) {
      scrollTo(0, 0);
    }
    if (event.key === 'ArrowDown' && event.metaKey) {
      window.scrollTo(0, document.body.scrollHeight);
    }
    if (event.key === '[' && event.metaKey) {
      window.history.go(-1);
    }
    if (event.key === ']' && event.metaKey) {
      window.history.go(1);
    }
    if (event.key === 'r' && event.metaKey) {
      window.location.reload();
    }
    if (event.key === '-' && event.metaKey) {
      zoomOut();
    }
    if (event.key === '=' && event.metaKey) {
      zoomIn();
    }
    if (event.key === '0' && event.metaKey) {
      zoomCommon(() => '100%');
    }
  });

  document.addEventListener('click', (e) => {
    const origin = e.target.closest('a');
    const href = origin.href;
    if (href) {
      origin.target = '_self';
    }
  });
});

setDefaultZoom();

function setDefaultZoom() {
  const htmlZoom = window.localStorage.getItem('htmlZoom');
  if (htmlZoom) {
    document.getElementsByTagName('html')[0].style.zoom = htmlZoom;
  }
}

function zoomCommon(callback) {
  const htmlZoom = window.localStorage.getItem('htmlZoom') || '100%';
  const html = document.getElementsByTagName('html')[0];
  const zoom = callback(htmlZoom);
  html.style.zoom = zoom;
  window.localStorage.setItem('htmlZoom', zoom);
}

function zoomIn() {
  zoomCommon((htmlZoom) =>
    parseInt(htmlZoom) < 200 ? parseInt(htmlZoom) + 10 + '%' : '200%',
  );
}

function zoomOut() {
  zoomCommon((htmlZoom) =>
    parseInt(htmlZoom) > 30 ? parseInt(htmlZoom) - 10 + '%' : '30%',
  );
}
