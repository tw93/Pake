// Pake's own handle on the native side, for the injected scripts that follow.
//
// The app is built without Tauri's global API object: a site can see that
// object and some treat its presence as an unofficial client (DeepSeek showed
// "Abnormal usage environment" on every packaged app). This keeps what the
// capability allows a page to call anyway, `invoke`, the window commands and
// opening a link in the system browser, under Pake's name and in the shape
// the global API had, so the user's own code can be handed it under the old
// name.
(function () {
  if (window.__PAKE_NATIVE__) return;

  function internals() {
    return window.__TAURI_INTERNALS__;
  }

  function invoke(command, args, options) {
    const native = internals();
    if (!native || typeof native.invoke !== "function") {
      return Promise.reject(new Error("[Pake] native bridge unavailable"));
    }
    return native.invoke(command, args, options);
  }

  // The commands and argument names Tauri's own window API sends.
  function windowCommand(name, value) {
    const native = internals();
    const label =
      native && native.metadata && native.metadata.currentWindow
        ? native.metadata.currentWindow.label
        : undefined;
    const args = { label };
    if (value !== undefined) args.value = value;
    return invoke("plugin:window|" + name, args);
  }

  const currentWindow = Object.freeze({
    close: () => windowCommand("close"),
    startDragging: () => windowCommand("start_dragging"),
    isFullscreen: () => windowCommand("is_fullscreen"),
    setFullscreen: (fullscreen) => windowCommand("set_fullscreen", fullscreen),
    toggleMaximize: () => windowCommand("toggle_maximize"),
    maximize: () => windowCommand("maximize"),
    minimize: () => windowCommand("minimize"),
    setResizable: (resizable) => windowCommand("set_resizable", resizable),
    theme: () => windowCommand("theme"),
  });

  Object.defineProperty(window, "__PAKE_NATIVE__", {
    value: Object.freeze({
      core: Object.freeze({ invoke }),
      window: Object.freeze({ getCurrentWindow: () => currentWindow }),
      shell: Object.freeze({
        open: (path, openWith) =>
          invoke("plugin:shell|open", { path, with: openWith }),
      }),
    }),
  });
})();
