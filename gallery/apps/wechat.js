// Many accounts are refused by WeChat on the web ("此微信号不能登录网页微信").
// Tencent still signs them in on the page its UOS desktop client loads: the
// page switches to that mode when `window.__target` is "t" (the same switch as
// `?target=t`), and the server expects the client's extspam and client-version
// headers on the one request that turns a scanned QR code into a session,
// webwxnewloginpage. Only that request carries them, as in the open-source
// clients wechat4u and wechat-need-web. Desktop mode drops the page's own
// Copy item from the message menu; Cmd+C still copies a selection.
(() => {
  if (
    !/^(wx\d?\.qq\.com|web\d?\.wechat\.com|web\.weixin\.qq\.com)$/.test(
      location.hostname,
    )
  )
    return;
  window.__target = "t";

  const HEADERS = {
    "client-version": "2.0.0",
    extspam:
      "Go8FCIkFEokFCggwMDAwMDAwMRAGGvAESySibk50w5Wb3uTl2c2h64jVVrV7gNs06GFlWplHQbY/5FfiO++1yH4ykCyNPWKXmco+wfQzK5R98D3so7rJ5LmGFvBLjGceleySrc3SOf2Pc1gVehzJgODeS0lDL3/I/0S2SSE98YgKleq6Uqx6ndTy9yaL9qFxJL7eiA/R3SEfTaW1SBoSITIu+EEkXff+Pv8NHOk7N57rcGk1w0ZzRrQDkXTOXFN2iHYIzAAZPIOY45Lsh+A4slpgnDiaOvRtlQYCt97nmPLuTipOJ8Qc5pM7ZsOsAPPrCQL7nK0I7aPrFDF0q4ziUUKettzW8MrAaiVfmbD1/VkmLNVqqZVvBCtRblXb5FHmtS8FxnqCzYP4WFvz3T0TcrOqwLX1M/DQvcHaGGw0B0y4bZMs7lVScGBFxMj3vbFi2SRKbKhaitxHfYHAOAa0X7/MSS0RNAjdwoyGHeOepXOKY+h3iHeqCvgOH6LOifdHf/1aaZNwSkGotYnYScW8Yx63LnSwba7+hESrtPa/huRmB9KWvMCKbDThL/nne14hnL277EDCSocPu3rOSYjuB9gKSOdVmWsj9Dxb/iZIe+S6AiG29Esm+/eUacSba0k8wn5HhHg9d4tIcixrxveflc8vi2/wNQGVFNsGO6tB5WF0xf/plngOvQ1/ivGV/C1Qpdhzznh0ExAVJ6dwzNg7qIEBaw+BzTJTUuRcPk92Sn6QDn2Pu3mpONaEumacjW4w6ipPnPw+g2TfywJjeEcpSZaP4Q3YV5HG8D6UjWA4GSkBKculWpdCMadx0usMomsSS/74QgpYqcPkmamB4nVv1JxczYITIqItIKjD35IGKAUwAA==",
  };
  const LOGIN = Symbol("pakeWechatLogin");
  const { open, send } = XMLHttpRequest.prototype;

  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    try {
      this[LOGIN] = new URL(url, location.href).pathname.endsWith(
        "/webwxnewloginpage",
      );
    } catch {
      this[LOGIN] = false;
    }
    return open.call(this, method, url, ...rest);
  };

  XMLHttpRequest.prototype.send = function (body) {
    if (this[LOGIN]) {
      for (const [name, value] of Object.entries(HEADERS)) {
        this.setRequestHeader(name, value);
      }
    }
    return send.call(this, body);
  };
})();
