window.addEventListener("DOMContentLoaded", (_event) => {
  // Applies to every app.
  const globalContentCSS = `
    html::-webkit-scrollbar {
      display: none !important;
    }
  `;

  // Window drag strip shared by every immersive header.
  const dragBarCSS = `
    #pake-top-dom:active {
      cursor: grabbing;
      cursor: -webkit-grabbing;
    }

    #pake-top-dom {
      position: fixed;
      background: transparent;
      top: 0;
      width: 100%;
      height: 20px;
      cursor: grab;
      -webkit-app-region: drag;
      user-select: none;
      -webkit-user-select: none;
      z-index: 99999;
    }
  `;

  // Site tweaks only load on their own hosts (and subdomains), so a site
  // packaged by a user never inherits rules written for another app.
  // `content` applies on every platform; `immersive` only under the macOS
  // hidden title bar, where the traffic lights overlap the page.
  const siteStyles = [
    {
      hosts: ["chatgpt.com", "chat.openai.com"],
      immersive: `
        #app-shell-sidebar > div {
          padding-top: 24px;
        }
      `,
    },
    {
      hosts: ["x.com", "twitter.com"],
      content: `
        #react-root [data-testid="placementTracking"] article,
        #react-root a[href*="quick_promote_web"] {
          display: none !important;
        }

        #react-root [data-testid="GrokDrawer"],
        #react-root [data-testid="chat-drawer-root"] {
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

        /* Keep Grok quote cards inside the column, including long author names. */
        #react-root [data-testid="primaryColumn"] [aria-label="Grok"]
          div:has(> div > div[role="link"]) {
          max-width: 100% !important;
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
            overflow-x: hidden;
          }

          #react-root form[role="search"] > div:nth-child(1) > div {
            background-color: transparent !important;
          }

          #react-root h1[role="heading"] {
            padding-top: 4px !important;
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
            display: none;
          }
        }

        @media only screen and (min-width: 1000px) and (max-width: 1264px) {
          #react-root [data-testid="sidebarColumn"] form[role="search"] {
            visibility: visible !important;
            position: fixed !important;
            top: 12px !important;
            right: 16px !important;
            left: auto !important;
            width: 182px !important;
          }

          #react-root [data-testid="sidebarColumn"] form[role="search"] input[data-testid="SearchBox_Search_Input"] {
            width: 100% !important;
          }

          #react-root [data-testid="sidebarColumn"] form[role="search"]:focus-within {
            width: 280px !important;
            backdrop-filter: blur(12px) !important;
          }
        }

        @media only screen and (min-width: 1265px) {
          #react-root [data-testid="sidebarColumn"] form[role="search"] {
            visibility: visible !important;
            position: fixed !important;
            top: 12px !important;
            right: 16px !important;
            left: auto !important;
            width: 182px !important;
          }

          #react-root [data-testid="sidebarColumn"] form[role="search"] input[data-testid="SearchBox_Search_Input"] {
            width: 100% !important;
          }

          #react-root [data-testid="sidebarColumn"] form[role="search"]:focus-within {
            width: 374px !important;
            backdrop-filter: blur(12px) !important;
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
      `,
    },
    {
      hosts: ["grok.com"],
      immersive: `
        .flex.w-full.h-full.overflow-hidden{
          padding-top:20px;
        }

        #grok-app-root [data-sidebar="sidebar"] {
          padding-top: 24px;
        }
      `,
    },
    {
      hosts: ["chat.deepseek.com"],
      immersive: `
        body:not(.rtl) ._5a20a69 {
          margin-left: 84px;
        }

        .b8812f16 {
          padding-top: 16px;
        }
      `,
    },
    {
      hosts: ["gemini.google.com"],
      immersive: `
        .side-nav-menu-button {
          margin-left: 76px !important;
        }
      `,
    },
    {
      hosts: ["notion.so", "notion.com"],
      immersive: `
        #notion-app .notion-sidebar,#notion-app .notion-topbar{
          padding-top: 20px;
          box-sizing: content-box;
        }
      `,
    },
    {
      hosts: ["excalidraw.com"],
      immersive: `
        #root > .excalidraw-app> .excalidraw-container .App-menu.App-menu_top{
          margin-top: 15px;
        }
      `,
    },
    {
      hosts: ["youtube.com"],
      content: `
        #masthead-ad {
          display: none !important;
        }
      `,
      immersive: `
        #layout > ytmusic-nav-bar{
          padding-top: 20px;
        }

        ytd-masthead>#container.style-scope.ytd-masthead {
          padding-top: 12px;
        }

        #background.ytd-masthead {
          height: 68px;
        }
      `,
    },
    {
      hosts: ["xiaohongshu.com"],
      content: `
        #app > header > div > div.menu,
        #app > div.layout > div.main-container > div.side-bar > li.divider {
          display: none !important;
        }

        #app > header .right .avatar.logged-in{
          opacity: 0;
          transition: opacity 0.3s;
        }

        #app > header .right .avatar.logged-in:hover{
          opacity: 1;
        }

        #global > div.header-container.showSearchBoxOrHeaderFixed > header > div.right > div > div.dropdown-nav{
          display: none;
        }
      `,
      immersive: `
        #app > div.layout > div.header-container.showSearchBoxOrHeaderFixed > header > a {
          padding-top:10px;
        }

        #header-area .logoIcon .user-info{
          padding-top: 20px;
        }

        #global > div.header-container > .mask-paper {
          padding-top: 20px;
        }
      `,
    },
    {
      hosts: ["wx.qq.com", "wx2.qq.com"],
      content: `
        .download_entry,
        .lang, .copyright {
          display: none !important;
        }

        .panel.give_me .nav_view {
          top: 164px !important;
        }
      `,
      immersive: `
        .main > div > div.panel.give_me > div.header {
          padding-top: 30px;
        }
      `,
    },
    {
      hosts: ["v.flomoapp.com"],
      content: `
        #page #footer-wrapper {
          display: none !important;
        }
      `,
    },
    {
      hosts: ["qwerty.kaiyi.cool"],
      content: `
        #root > main > footer.justify-center.ease-in {
          visibility: hidden !important;
        }
      `,
    },
    {
      hosts: ["lizhi.dengdengju.com", "lizhi.turkyden.com"],
      content: `
        #root > div > div.fixed.top-0.left-0.w-64.h-screen.p-10.pb-0.flex.flex-col.justify-between > div > div.space-y-4 > a:nth-child(3) {
          display: none !important;
        }
      `,
    },
  ];

  const hostname = window.location.hostname;
  const matchedSites = siteStyles.filter(({ hosts }) =>
    hosts.some((host) => hostname === host || hostname.endsWith(`.${host}`)),
  );
  const siteCSS = (key) =>
    matchedSites.map((site) => site[key] || "").join("\n");

  const injectStyle = (css, id) => {
    if (typeof window.__PAKE_INJECT_STYLE__ === "function") {
      window.__PAKE_INJECT_STYLE__(css, id);
    } else {
      const styleElement = document.createElement("style");
      styleElement.id = id;
      styleElement.textContent = css;
      document.head.appendChild(styleElement);
    }
  };

  injectStyle(globalContentCSS + siteCSS("content"), "pake-content-style");

  // Top spacing adapts to head-hiding scenarios
  const isMac = /Mac/i.test(navigator.userAgent);
  if (hasImmersiveHeader(window["pakeConfig"])) {
    const topPaddingCSS = isMac
      ? siteCSS("immersive") + dragBarCSS
      : dragBarCSS;
    injectStyle(topPaddingCSS, "pake-top-padding-style");
  }
});
