(function () {
  if (window.__PAKE_FIND_SCRIPT__) {
    return;
  }
  window.__PAKE_FIND_SCRIPT__ = true;

  const PANEL_ID = "pake-find-panel";
  const STYLE_ID = "pake-find-style";
  const MARK_ATTR = "data-pake-find";
  const ACTIVE_ATTR = "data-pake-find-active";
  const MATCH_HIGHLIGHT = "pake-find-match";
  const ACTIVE_HIGHLIGHT = "pake-find-active";
  const MAX_MATCHES = 1000;
  const SEARCH_DEBOUNCE_MS = 120;
  const SKIPPED_TAGS = new Set([
    "script",
    "style",
    "noscript",
    "input",
    "textarea",
    "select",
    "option",
  ]);

  const state = {
    enabled: window.pakeConfig?.enable_find === true,
    panel: null,
    input: null,
    counter: null,
    status: null,
    matches: [],
    activeIndex: -1,
    query: "",
    truncated: false,
    domMarks: [],
    observer: null,
    searchTimer: null,
    isOpen: false,
  };

  function getState() {
    return {
      enabled: state.enabled,
      isOpen: state.isOpen,
      query: state.query,
      matchCount: state.matches.length,
      activeIndex: state.activeIndex,
      truncated: state.truncated,
    };
  }

  function noop() {
    return getState();
  }

  if (!state.enabled) {
    window.pakeFind = {
      open: noop,
      close: noop,
      next: noop,
      previous: noop,
      search: noop,
      getState,
      getFindShortcutAction: () => "",
    };
    return;
  }

  function getNodeFilter() {
    return (
      window.NodeFilter ||
      globalThis.NodeFilter || {
        SHOW_TEXT: 4,
        FILTER_ACCEPT: 1,
        FILTER_REJECT: 2,
      }
    );
  }

  function supportsCustomHighlight() {
    return (
      typeof CSS !== "undefined" &&
      CSS.highlights &&
      typeof Highlight === "function"
    );
  }

  function isFindPanelNode(node) {
    const element =
      node?.nodeType === 1 ? node : node?.parentElement || node?.parentNode;
    if (!element) {
      return false;
    }
    if (element.id === PANEL_ID) {
      return true;
    }
    return element.closest?.(`#${PANEL_ID}`) != null;
  }

  function shouldSkipElement(element) {
    for (let current = element; current; current = current.parentElement) {
      if (current.id === PANEL_ID) {
        return true;
      }

      const tagName = current.tagName?.toLowerCase();
      if (tagName && SKIPPED_TAGS.has(tagName)) {
        return true;
      }

      if (
        current.isContentEditable ||
        current.getAttribute?.("contenteditable") === "true"
      ) {
        return true;
      }

      if (current.hidden || current.getAttribute?.("aria-hidden") === "true") {
        return true;
      }
    }

    return false;
  }

  function getSearchableTextNodes(root = document.body) {
    if (!root || !document.createTreeWalker) {
      return [];
    }

    const nodeFilter = getNodeFilter();
    const walker = document.createTreeWalker(root, nodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.nodeValue || node.nodeValue.length === 0) {
          return nodeFilter.FILTER_REJECT;
        }
        if (shouldSkipElement(node.parentElement)) {
          return nodeFilter.FILTER_REJECT;
        }
        return nodeFilter.FILTER_ACCEPT;
      },
    });

    const nodes = [];
    let current = walker.nextNode();
    while (current) {
      nodes.push(current);
      current = walker.nextNode();
    }
    return nodes;
  }

  function createRange(node, start, end) {
    const range = document.createRange();
    range.setStart(node, start);
    range.setEnd(node, end);
    return range;
  }

  function collectMatches(query) {
    const matches = [];
    const normalizedQuery = query.toLocaleLowerCase();
    if (!normalizedQuery) {
      return { matches, truncated: false };
    }

    for (const node of getSearchableTextNodes()) {
      const text = node.nodeValue || "";
      const normalizedText = text.toLocaleLowerCase();
      let searchFrom = 0;

      while (searchFrom <= normalizedText.length) {
        const index = normalizedText.indexOf(normalizedQuery, searchFrom);
        if (index === -1) {
          break;
        }

        matches.push({
          node,
          start: index,
          end: index + query.length,
          range: createRange(node, index, index + query.length),
          mark: null,
        });

        if (matches.length >= MAX_MATCHES) {
          return { matches, truncated: true };
        }

        searchFrom = index + Math.max(query.length, 1);
      }
    }

    return { matches, truncated: false };
  }

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) {
      return;
    }

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      #${PANEL_ID} {
        position: fixed;
        top: 14px;
        right: 14px;
        z-index: 2147483647;
        display: none;
        align-items: center;
        gap: 6px;
        box-sizing: border-box;
        min-width: 278px;
        max-width: min(420px, calc(100vw - 28px));
        padding: 8px;
        border: 1px solid rgba(0, 0, 0, 0.14);
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.96);
        color: #1f2328;
        box-shadow: 0 10px 26px rgba(0, 0, 0, 0.18);
        font: 13px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        backdrop-filter: blur(16px);
      }
      #${PANEL_ID}[data-visible="true"] {
        display: flex;
      }
      #${PANEL_ID} input {
        min-width: 0;
        flex: 1 1 auto;
        height: 28px;
        box-sizing: border-box;
        border: 1px solid rgba(0, 0, 0, 0.16);
        border-radius: 6px;
        padding: 0 8px;
        background: #fff;
        color: #1f2328;
        font: inherit;
        outline: none;
      }
      #${PANEL_ID} input:focus {
        border-color: #3b82f6;
        box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.16);
      }
      #${PANEL_ID} [data-pake-find-counter] {
        flex: 0 0 auto;
        min-width: 42px;
        color: #5f6b7a;
        text-align: center;
        font-size: 12px;
        white-space: nowrap;
      }
      #${PANEL_ID} button {
        flex: 0 0 auto;
        width: 28px;
        height: 28px;
        border: 0;
        border-radius: 6px;
        background: transparent;
        color: #30363d;
        font: 15px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        cursor: pointer;
      }
      #${PANEL_ID} button:hover {
        background: rgba(0, 0, 0, 0.08);
      }
      #${PANEL_ID} [data-pake-find-status] {
        position: absolute;
        left: 10px;
        top: calc(100% + 4px);
        color: #d1242f;
        font-size: 12px;
        white-space: nowrap;
      }
      @media (prefers-color-scheme: dark) {
        #${PANEL_ID} {
          border-color: rgba(255, 255, 255, 0.16);
          background: rgba(31, 35, 40, 0.94);
          color: #f0f3f6;
          box-shadow: 0 10px 26px rgba(0, 0, 0, 0.36);
        }
        #${PANEL_ID} input {
          border-color: rgba(255, 255, 255, 0.18);
          background: rgba(255, 255, 255, 0.08);
          color: #f0f3f6;
        }
        #${PANEL_ID} [data-pake-find-counter] {
          color: #b7c0cc;
        }
        #${PANEL_ID} button {
          color: #f0f3f6;
        }
        #${PANEL_ID} button:hover {
          background: rgba(255, 255, 255, 0.12);
        }
      }
      ::highlight(${MATCH_HIGHLIGHT}) {
        background: rgba(255, 214, 10, 0.58);
        color: inherit;
      }
      ::highlight(${ACTIVE_HIGHLIGHT}) {
        background: rgba(255, 149, 0, 0.9);
        color: inherit;
      }
      mark[${MARK_ATTR}] {
        background: rgba(255, 214, 10, 0.58);
        color: inherit;
        padding: 0;
      }
      mark[${MARK_ATTR}][${ACTIVE_ATTR}] {
        background: rgba(255, 149, 0, 0.9);
      }
    `;

    (document.head || document.body || document.documentElement)?.appendChild(
      style,
    );
  }

  function createButton(label, title, onClick) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.title = title;
    button.setAttribute("aria-label", title);
    button.addEventListener("click", onClick);
    return button;
  }

  function ensurePanel() {
    if (state.panel) {
      return state.panel;
    }

    ensureStyle();

    const panel = document.createElement("div");
    panel.id = PANEL_ID;
    panel.setAttribute("role", "search");
    panel.setAttribute("aria-label", "Find in page");

    const input = document.createElement("input");
    input.type = "search";
    input.autocomplete = "off";
    input.spellcheck = false;
    input.placeholder = "Find";
    input.setAttribute("aria-label", "Find in page");

    const counter = document.createElement("span");
    counter.setAttribute("data-pake-find-counter", "");
    counter.textContent = "0/0";

    const previousButton = createButton("<", "Find Previous", () => previous());
    const nextButton = createButton(">", "Find Next", () => next());
    const closeButton = createButton("x", "Close Find", () => close());

    const status = document.createElement("span");
    status.setAttribute("data-pake-find-status", "");

    input.addEventListener("input", () => {
      debounceSearch(input.value);
    });
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        event.stopPropagation();
        if (event.shiftKey) {
          previous();
        } else {
          next();
        }
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        close();
      }
    });

    panel.append(
      input,
      counter,
      previousButton,
      nextButton,
      closeButton,
      status,
    );
    (document.body || document.documentElement).appendChild(panel);

    state.panel = panel;
    state.input = input;
    state.counter = counter;
    state.status = status;

    return panel;
  }

  function clearCustomHighlights() {
    if (!supportsCustomHighlight()) {
      return;
    }

    CSS.highlights.delete(MATCH_HIGHLIGHT);
    CSS.highlights.delete(ACTIVE_HIGHLIGHT);
  }

  function clearDomMarks() {
    const marks = Array.from(
      document.querySelectorAll?.(`mark[${MARK_ATTR}]`) || state.domMarks,
    );

    for (const mark of marks) {
      const parent = mark.parentNode;
      const text = document.createTextNode(mark.textContent || "");
      mark.replaceWith?.(text);
      parent?.normalize?.();
    }

    state.domMarks = [];
  }

  function clearHighlights() {
    clearCustomHighlights();
    clearDomMarks();
  }

  function applyCustomHighlights() {
    if (!supportsCustomHighlight()) {
      return false;
    }

    const ranges = state.matches.map((match) => match.range);
    CSS.highlights.set(MATCH_HIGHLIGHT, new Highlight(...ranges));
    updateActiveHighlight();
    return true;
  }

  function applyDomHighlights() {
    const grouped = new Map();
    for (const match of state.matches) {
      const nodeMatches = grouped.get(match.node) || [];
      nodeMatches.push(match);
      grouped.set(match.node, nodeMatches);
    }

    for (const nodeMatches of grouped.values()) {
      nodeMatches.sort((a, b) => b.start - a.start);
      for (const match of nodeMatches) {
        try {
          const mark = document.createElement("mark");
          mark.setAttribute(MARK_ATTR, "");
          match.range.surroundContents(mark);
          match.mark = mark;
          state.domMarks.push(mark);
        } catch (error) {
          // Some browser-generated text ranges cannot be wrapped safely.
        }
      }
    }

    updateDomActiveMark();
  }

  function updateDomActiveMark() {
    state.matches.forEach((match, index) => {
      const mark = match.mark;
      if (!mark) {
        return;
      }

      if (mark.toggleAttribute) {
        mark.toggleAttribute(ACTIVE_ATTR, index === state.activeIndex);
      } else if (index === state.activeIndex) {
        mark.setAttribute(ACTIVE_ATTR, "");
      } else {
        mark.removeAttribute?.(ACTIVE_ATTR);
      }
    });
  }

  function updateActiveHighlight() {
    if (!supportsCustomHighlight()) {
      updateDomActiveMark();
      return;
    }

    CSS.highlights.delete(ACTIVE_HIGHLIGHT);
    if (state.activeIndex >= 0 && state.matches[state.activeIndex]) {
      CSS.highlights.set(
        ACTIVE_HIGHLIGHT,
        new Highlight(state.matches[state.activeIndex].range),
      );
    }
  }

  function scrollActiveIntoView() {
    const active = state.matches[state.activeIndex];
    if (!active) {
      return;
    }

    const target = active.mark || active.range.startContainer?.parentElement;
    if (target?.scrollIntoView) {
      target.scrollIntoView({ block: "center", inline: "nearest" });
    }
  }

  function updateCounter() {
    if (!state.counter) {
      return;
    }

    const total = state.matches.length;
    const active = state.activeIndex >= 0 ? state.activeIndex + 1 : 0;
    state.counter.textContent = `${active}/${total}${state.truncated ? "+" : ""}`;

    if (state.status) {
      state.status.textContent = state.query && total === 0 ? "No results" : "";
    }
  }

  function runSearch(query = state.query) {
    state.query = query;
    clearHighlights();

    if (!query) {
      state.matches = [];
      state.activeIndex = -1;
      state.truncated = false;
      updateCounter();
      return getState();
    }

    const result = collectMatches(query);
    state.matches = result.matches;
    state.truncated = result.truncated;
    state.activeIndex = state.matches.length > 0 ? 0 : -1;

    if (!applyCustomHighlights()) {
      applyDomHighlights();
    }

    updateCounter();
    scrollActiveIntoView();
    return getState();
  }

  function debounceSearch(query) {
    clearTimeout(state.searchTimer);
    state.searchTimer = setTimeout(() => runSearch(query), SEARCH_DEBOUNCE_MS);
  }

  function next() {
    if (!state.query && state.input?.value) {
      runSearch(state.input.value);
    }

    if (state.matches.length === 0) {
      return getState();
    }

    state.activeIndex = (state.activeIndex + 1) % state.matches.length;
    updateActiveHighlight();
    updateCounter();
    scrollActiveIntoView();
    return getState();
  }

  function previous() {
    if (!state.query && state.input?.value) {
      runSearch(state.input.value);
    }

    if (state.matches.length === 0) {
      return getState();
    }

    state.activeIndex =
      (state.activeIndex - 1 + state.matches.length) % state.matches.length;
    updateActiveHighlight();
    updateCounter();
    scrollActiveIntoView();
    return getState();
  }

  function observeDocumentChanges() {
    if (
      state.observer ||
      !document.body ||
      typeof MutationObserver !== "function"
    ) {
      return;
    }

    state.observer = new MutationObserver((mutations) => {
      if (!state.isOpen || !state.query) {
        return;
      }
      if (mutations.every((mutation) => isFindPanelNode(mutation.target))) {
        return;
      }
      debounceSearch(state.query);
    });

    state.observer.observe(document.body, {
      childList: true,
      characterData: true,
      subtree: true,
    });
  }

  function stopObservingDocumentChanges() {
    state.observer?.disconnect();
    state.observer = null;
  }

  function open() {
    if (!state.enabled) {
      return getState();
    }

    const panel = ensurePanel();
    panel.setAttribute("data-visible", "true");
    state.isOpen = true;
    observeDocumentChanges();

    requestAnimationFrame(() => {
      state.input?.focus();
      state.input?.select();
    });

    if (state.input?.value) {
      runSearch(state.input.value);
    } else {
      updateCounter();
    }

    return getState();
  }

  function close() {
    clearTimeout(state.searchTimer);
    state.isOpen = false;
    state.panel?.removeAttribute("data-visible");
    clearHighlights();
    stopObservingDocumentChanges();
    state.matches = [];
    state.activeIndex = -1;
    state.truncated = false;
    updateCounter();
    return getState();
  }

  function search(query) {
    if (state.input) {
      state.input.value = query;
    }
    return runSearch(query);
  }

  function getFindShortcutAction(event) {
    const userAgent = navigator.userAgent || "";
    const isMac = /macintosh|mac os x/i.test(userAgent);
    const hasModifier = isMac
      ? event.metaKey && !event.ctrlKey
      : event.ctrlKey && !event.metaKey;

    if (!hasModifier || event.altKey) {
      return "";
    }

    const key = event.key?.toLowerCase();
    if (key === "f" && !event.shiftKey) {
      return "open";
    }
    if (key === "g") {
      return event.shiftKey ? "previous" : "next";
    }
    return "";
  }

  function handleFindShortcut(event) {
    const action = getFindShortcutAction(event);
    if (!action) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    window.pakeFind[action]();
  }

  window.pakeFind = {
    open,
    close,
    next,
    previous,
    search,
    getState,
    getFindShortcutAction,
  };

  if (state.enabled) {
    document.addEventListener("keydown", handleFindShortcut, true);
  }
})();
