window.addEventListener('DOMContentLoaded', (_event) => {
  const css = `
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
    #app > header > div > div.menu,
    #root > div > div.fixed.top-0.left-0.w-64.h-screen.p-10.pb-0.flex.flex-col.justify-between > div > div.space-y-4 > a:nth-child(3),
    #app > div.layout > div.main-container > div.side-bar > div,
    #app > div.layout > div.main-container > div.side-bar > li.divider,
    #Rightbar > div:nth-child(6) > div.sidebar_compliance {
      display: none !important;
    }

    #app > header .right .avatar.logged-in{
      opacity: 0;
      transition: opacity 0.3s;
    }

    #app > header .right .avatar.logged-in:hover{
      opacity: 1;
    }

    #page .main_header, .cb-layout-basic--navbar,
    #app .splitpanes.splitpanes--horizontal.no-splitter header {
      padding-top: 20px;
    }

    .fui-FluentProvider .fui-Button[data-testid="HomeButton"]{
      padding-top: 20px;
    }

    .chakra-ui-light #app .chakra-heading,
    .chakra-ui-dark #app .chakra-heading,
    .chakra-ui-light #app .chakra-stack,
    .chakra-ui-dark #app .chakra-stack,
    .app-main .sidebar-mouse-in-out,
    .chakra-modal__content-container .chakra-modal__header > div > div {
      padding-top: 10px;
    }

    #__next .overflow-hidden>.hidden.bg-gray-900 span.rounded-md.bg-yellow-200 {
      display: none;
    }

    #__next .overflow-hidden>.hidden.bg-gray-900 .scrollbar-trigger{
      padding-top: 20px;
    }

    #__next .absolute .px-3.pt-2.pb-3.text-center {
      visibility: hidden;
    }

    .lark > .dashboard-sidebar, .lark > .dashboard-sidebar > .sidebar-user-info , .lark > .dashboard-sidebar .index-module_wrapper_F-Wbq{
      padding-top:15px;
    }

    .lark > .main-wrapper [data-testid="aside"] {
      top: 15px;
    }

    .panel.give_me .nav_view {
      top: 164px !important;
    }

    .columns .column #header,
    .main > div > div.panel.give_me > div.header {
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

    .geist-page nav.dashboard_nav__PRmJv,
    #app > div.layout > div.header-container.showSearchBoxOrHeaderFixed > header > a {
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

      #react-root [data-testid="SideNav_NewTweet_Button"], #react-root [aria-label="Twitter Blue"]{
        display: none;
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

    @media (min-width:1024px){
      #__next .text-base.lg\\:max-w-xl {
        max-width: 41rem;
      }
    }

    @media (min-width:1280px){
      #__next .text-base.xl\\:max-w-3xl {
        max-width: 48rem;
      }
    }

    @media (min-width:640px){
      #__next .sticky.top-0{
        padding-top: 15px;
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
      -webkit-app-region: drag;
      user-select: none;
      -webkit-user-select: none;
      z-index: 90000;
    }
  `;
  const styleElement = document.createElement('style');
  styleElement.innerHTML = css;
  document.head.appendChild(styleElement);
});
