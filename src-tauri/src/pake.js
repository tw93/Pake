/**
 * @typedef {string} KeyboardKey `event.key` 的代号，
 * 见 <https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key/Key_Values>
 * @typedef {() => void} OnKeyDown 使用者按下 [CtrlKey] 或者 ⌘ [KeyboardKey]时应该执行的行为
 * 以 Ctrl键或者Meta 键 (⌘) 为首的快捷键清单。
 * 每个写在这里的 shortcuts 都会运行 {@link Event.preventDefault}.
 * @type {Record<KeyboardKey, OnKeyDown>}
 */

const metaKeyShortcuts = {
  ArrowUp: () => scrollTo(0, 0),
  ArrowDown: () => scrollTo(0, document.body.scrollHeight),
  "[": () => window.history.back(),
  "]": () => window.history.forward(),
  r: () => window.location.reload(),
  "-": () => zoomOut(),
  "=": () => zoomIn(),
  "+": () => zoomIn(),
  0: () => zoomCommon(() => "100%"),
};

const ctrlKeyShortcuts = {
  ArrowUp: () => scrollTo(0, 0),
  ArrowDown: () => scrollTo(0, document.body.scrollHeight),
  ArrowLeft: () => window.history.back(),
  ArrowRight: () => window.history.forward(),
  r: () => window.location.reload(),
  "-": () => zoomOut(),
  "=": () => zoomIn(),
  "+": () => zoomIn(),
  0: () => zoomCommon(() => "100%"),
};

window.addEventListener("DOMContentLoaded", (_event) => {
  const style = document.createElement("style");
  style.innerHTML = `
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
    #masthead-ad,
    #Rightbar > div:nth-child(6) > div.sidebar_compliance {
      display: none !important;
    }

    #page .main_header, .cb-layout-basic--navbar{
      padding-top: 20px;
    }

    .lark > .dashboard-sidebar, .lark > .dashboard-sidebar > .sidebar-user-info , .lark > .dashboard-sidebar .index-module_wrapper_F-Wbq{
      padding-top:15px;
    }

    .lark > .main-wrapper [data-testid="aside"] {
      top: 15px;
    }

    .panel.give_me .nav_view {
      top: 154px !important;
    }

    .columns .column #header{
      padding-top: 30px;
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

    #react-root [data-testid="placementTracking"] article,
    #react-root a[href*="quick_promote_web"],
    #react-root [data-testid="AppTabBar_Explore_Link"],
    #react-root a[href*="/lists"][role="link"][aria-label],
    #react-root a[href="/i/bookmarks"] {
      display: none !important;
    }

    #react-root [data-testid="DMDrawer"] {
      visibility: hidden !important;
    }

    #react-root [data-testid="primaryColumn"] > div > div {
      position: relative !important;
    }

    #react-root [data-testid="sidebarColumn"] {
      visibility: hidden !important;
      width: 0 !important;
      margin: 0 !important;
      padding: 0 !important;
      z-index: 1 !important;
    }

    @media only screen and (min-width: 1000px) {
      #react-root main[role="main"] {
        align-items: center !important;
        overflow-x: clip !important;
      }

      #react-root [data-testid="primaryColumn"] {
        width: 700px !important;
        max-width: 700px !important;
        margin: 0 auto !important;
      }
      #react-root [data-testid="primaryColumn"] > div > div:last-child,
      #react-root [data-testid="primaryColumn"] > div > div:last-child div {
        max-width: unset !important;
      }

      #react-root div[aria-label][role="group"][id^="id__"] {
        margin-right: 81px !important;
      }

      #react-root header[role="banner"] {
        position: fixed !important;
        left: 0 !important;
      }

      #react-root header[role="banner"] > div > div > div {
        justify-content: center !important;
        padding-top: 0;
      }

      #react-root form[role="search"] > div:nth-child(1) > div {
        background-color: transparent !important;
      }

      #react-root h1[role="heading"] {
        padding-top: 4px !important;
      }

      #react-root header[role="banner"]
        nav[role="navigation"]
        *
        div[dir="auto"]:not([aria-label])
        > span,
      #react-root [data-testid="SideNav_AccountSwitcher_Button"] > div:not(:first-child) {
        display: inline-block !important;
        opacity: 0 !important;
        transition: 0.5s cubic-bezier(0.2, 0.8, 0.2, 1);
      }
      #react-root header[role="banner"]
        nav[role="navigation"]:hover
        *
        div[dir="auto"]:not([aria-label])
        > span,
      #react-root [data-testid="SideNav_AccountSwitcher_Button"]:hover > div:not(:first-child) {
        opacity: 1 !important;
      }
      #react-root header[role="banner"] nav[role="navigation"]:hover > * > div {
        backdrop-filter: blur(12px) !important;
      }
      #react-root header[role="banner"] nav[role="navigation"] > a {
        position: relative;
      }

      #react-root header[role="banner"] nav[role="navigation"] > a::before {
        content: "";
        position: absolute;
        top: 0px;
        right: -40px;
        bottom: 0px;
        left: 0px;
      }
      #react-root [data-testid="SideNav_AccountSwitcher_Button"] {
        bottom: 18px !important;
        left: 1px !important;
      }

      #react-root [data-testid="SideNav_NewTweet_Button"] {
        position: fixed !important;
        right: 16px !important;
        bottom: 24px !important;
      }
    }

    @media only screen and (min-width: 1265px) {
      #react-root [data-testid="sidebarColumn"] form[role="search"] {
        visibility: visible !important;
        position: fixed !important;
        top: 12px !important;
        right: 16px !important;
      }

      #react-root [data-testid="sidebarColumn"] input[placeholder="Search Twitter"] {
        width: 150px;
      }

      #react-root [data-testid="sidebarColumn"] form[role="search"]:focus-within {
        width: 374px !important;
        backdrop-filter: blur(12px) !important;
      }

      #react-root [data-testid="sidebarColumn"] input[placeholder="Search Twitter"]:focus {
        width: 328px !important;
      }

      #react-root div[style*="left: -12px"] {
        left: unset !important;
      }

      #react-root div[style="left: -8px; width: 306px;"] {
        left: unset !important;
        width: 374px !important;
      }

      #react-root .searchFilters {
        visibility: visible !important;
        position: fixed;
        top: 12px;
        right: 16px;
        width: 240px;
      }
      #react-root .searchFilters > div > div:first-child {
        display: none;
      }
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
      z-index: 90000;
    }
  `;
  document.head.append(style);
  const topDom = document.createElement("div");
  topDom.id = "pack-top-dom";
  document.body.appendChild(topDom);

  const domEl = document.getElementById("pack-top-dom");

  domEl.addEventListener("mousedown", (e) => {
    if (e.buttons === 1 && e.detail !== 2) {
      window.ipc.postMessage("drag_window");
    }
  });

  domEl.addEventListener("touchstart", () => {
    window.ipc.postMessage("drag_window");
  });

  domEl.addEventListener("dblclick", () => {
    window.ipc.postMessage("fullscreen");
  });

  document.addEventListener("keyup", function (event) {
    const preventDefault = (f) => {
      event.preventDefault();
      f();
    };
    if (/windows|linux/i.test(navigator.userAgent)) {
      if (event.ctrlKey && event.key in ctrlKeyShortcuts) {
        preventDefault(ctrlKeyShortcuts[event.key]);
      }
    }
    if (/macintosh|mac os x/i.test(navigator.userAgent)) {
      if (event.metaKey && event.key in metaKeyShortcuts) {
        preventDefault(ctrlKeyShortcuts[event.key]);
      }
    }
  });

  document.addEventListener("click", (e) => {
    const origin = e.target.closest("a");
    if (origin && origin.href) {
      origin.target = "_self";

      //额外处理下 twitter 的外跳，对于其他需要外跳的可以改这里成对应域名
      const href = origin.href;
      if (
        location.host === "twitter.com" &&
        href.indexOf("twitter.com") === -1
      ) {
        e.preventDefault();
        window.ipc.postMessage(`open_browser:${href}`);
      }
    }
  });
});

setDefaultZoom();

function setDefaultZoom() {
  const htmlZoom = window.localStorage.getItem("htmlZoom");
  if (htmlZoom) {
    document.getElementsByTagName("html")[0].style.zoom = htmlZoom;
  }
}

/**
 * @param {(htmlZoom: string) => string} [zoomRule]
 */
function zoomCommon(zoomRule) {
  const htmlZoom = window.localStorage.getItem("htmlZoom") || "100%";
  const html = document.getElementsByTagName("html")[0];
  const zoom = zoomRule(htmlZoom);
  html.style.zoom = zoom;
  window.localStorage.setItem("htmlZoom", zoom);
}

function zoomIn() {
  zoomCommon((htmlZoom) => `${Math.min(parseInt(htmlZoom) + 10, 200)}%`);
}

function zoomOut() {
  zoomCommon((htmlZoom) => `${Math.max(parseInt(htmlZoom) - 10, 30)}%`);
}
