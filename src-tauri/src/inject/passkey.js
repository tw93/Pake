// Passkeys for the page in a macOS app (src/app/passkey). WKWebView refuses
// WebAuthn in an app without Apple's browser entitlement, so a publicKey
// request goes to the runtime's own authenticator instead: a Secure Enclave
// key behind Touch ID, kept in this app. The native side takes the page's
// origin from WebKit and builds the client data; this script only carries the
// options over as JSON and turns the answer back into a PublicKeyCredential.
// Every other credential request keeps the engine's own path.
(function () {
  "use strict";
  if (window.top !== window || window.__PAKE_PASSKEYS__) return;
  if (
    typeof window.PublicKeyCredential !== "function" ||
    typeof window.CredentialsContainer !== "function"
  ) {
    return;
  }
  Object.defineProperty(window, "__PAKE_PASSKEYS__", { value: true });

  const HANDLER = "pakePasskey";
  const container = window.CredentialsContainer.prototype;
  const nativeCreate = container.create;
  const nativeGet = container.get;

  // Added by the native side right after the webview is built, so looked up at call time.
  const handler = () => {
    const handlers = window.webkit && window.webkit.messageHandlers;
    return handlers && handlers[HANDLER];
  };

  const bytesOf = (source) => {
    // By tag, so a buffer made in another frame is taken too.
    if (Object.prototype.toString.call(source) === "[object ArrayBuffer]") {
      return new Uint8Array(source);
    }
    if (ArrayBuffer.isView(source)) {
      return new Uint8Array(
        source.buffer,
        source.byteOffset,
        source.byteLength,
      );
    }
    throw new TypeError("Expected an ArrayBuffer or a view of one");
  };

  const toBase64Url = (source) => {
    const bytes = bytesOf(source);
    let binary = "";
    for (let index = 0; index < bytes.length; index += 1) {
      binary += String.fromCharCode(bytes[index]);
    }
    return btoa(binary)
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  };

  const fromBase64Url = (text) => {
    const base = text.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(base + "===".slice((base.length + 3) % 4));
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes.buffer;
  };

  const descriptors = (list) =>
    Array.from(list || [], (descriptor) => ({
      type: descriptor.type,
      id: toBase64Url(descriptor.id),
    }));

  const createRequest = (options) => {
    const selection = options.authenticatorSelection;
    const extensions = options.extensions;
    return {
      kind: "create",
      publicKey: {
        challenge: toBase64Url(options.challenge),
        rp: { id: options.rp && options.rp.id },
        user: {
          id: toBase64Url(options.user.id),
          name: String(options.user.name || ""),
          displayName: String(options.user.displayName || ""),
        },
        pubKeyCredParams: Array.from(
          options.pubKeyCredParams || [],
          (param) => ({
            type: param.type,
            alg: param.alg,
          }),
        ),
        excludeCredentials: descriptors(options.excludeCredentials),
        authenticatorSelection: selection
          ? { authenticatorAttachment: selection.authenticatorAttachment }
          : undefined,
        extensions: extensions
          ? { credProps: Boolean(extensions.credProps) }
          : undefined,
      },
    };
  };

  const getRequest = (options) => ({
    kind: "get",
    publicKey: {
      challenge: toBase64Url(options.challenge),
      rpId: options.rpId,
      allowCredentials: descriptors(options.allowCredentials),
    },
  });

  const call = (request) => {
    const target = handler();
    if (!target) return Promise.reject(notAllowed());
    return target.postMessage(JSON.stringify(request)).then((text) => {
      const reply = JSON.parse(text);
      if (reply.error === "TypeError")
        throw new TypeError(reply.message || "Invalid options");
      if (reply.error) {
        throw new DOMException(
          reply.message || "The operation either timed out or was not allowed.",
          reply.error,
        );
      }
      return reply;
    });
  };

  // An object that reads as the engine's own: the values sit one step up as
  // enumerable getters and methods on the engine's prototype, so `instanceof`
  // holds, `Object.keys` is empty and `for...in` lists the fields, as on a
  // browser's credential (FIDO's webauthn-demo serialises it that way). A field
  // has no setter, and a method may be replaced, as GitHub's webauthn-json does
  // with `credential.toJSON = ...` in strict mode.
  const shaped = (Engine, values) => {
    const shape = Object.create(Engine ? Engine.prototype : Object.prototype);
    for (const key of Object.keys(values)) {
      const value = values[key];
      Object.defineProperty(
        shape,
        key,
        typeof value === "function"
          ? { value, writable: true, enumerable: true, configurable: true }
          : { get: () => value, enumerable: true, configurable: true },
      );
    }
    return Object.create(shape);
  };

  const credentialFrom = (reply) => {
    const answer = reply.response;
    const created = typeof answer.attestationObject === "string";
    const Response = created
      ? window.AuthenticatorAttestationResponse
      : window.AuthenticatorAssertionResponse;
    const values = { clientDataJSON: fromBase64Url(answer.clientDataJSON) };
    if (created) {
      const authenticatorData = fromBase64Url(answer.authenticatorData);
      const publicKey = fromBase64Url(answer.publicKey);
      values.attestationObject = fromBase64Url(answer.attestationObject);
      values.getTransports = () => answer.transports.slice();
      values.getAuthenticatorData = () => authenticatorData.slice(0);
      values.getPublicKey = () => publicKey.slice(0);
      values.getPublicKeyAlgorithm = () => answer.publicKeyAlgorithm;
    } else {
      values.authenticatorData = fromBase64Url(answer.authenticatorData);
      values.signature = fromBase64Url(answer.signature);
      values.userHandle = answer.userHandle
        ? fromBase64Url(answer.userHandle)
        : null;
    }
    const response = shaped(Response, values);

    const json = created
      ? {
          clientDataJSON: answer.clientDataJSON,
          attestationObject: answer.attestationObject,
          authenticatorData: answer.authenticatorData,
          publicKey: answer.publicKey,
          publicKeyAlgorithm: answer.publicKeyAlgorithm,
          transports: answer.transports.slice(),
        }
      : {
          clientDataJSON: answer.clientDataJSON,
          authenticatorData: answer.authenticatorData,
          signature: answer.signature,
          userHandle: answer.userHandle || null,
        };
    return shaped(window.PublicKeyCredential, {
      id: reply.id,
      rawId: fromBase64Url(reply.id),
      type: "public-key",
      authenticatorAttachment: "platform",
      response,
      getClientExtensionResults: () =>
        Object.assign({}, reply.clientExtensionResults),
      toJSON: () => ({
        id: reply.id,
        rawId: reply.id,
        type: "public-key",
        authenticatorAttachment: "platform",
        clientExtensionResults: Object.assign({}, reply.clientExtensionResults),
        response: json,
      }),
    });
  };

  const abortReason = (signal) =>
    signal.reason !== undefined
      ? signal.reason
      : new DOMException("The operation was aborted.", "AbortError");

  const notAllowed = () =>
    new DOMException(
      "The operation either timed out or was not allowed.",
      "NotAllowedError",
    );

  // A browser keeps a ceremony between these bounds whatever the site asks,
  // and gives one that asks nothing five minutes.
  const MIN_TIMEOUT = 30000;
  const MAX_TIMEOUT = 600000;
  const DEFAULT_TIMEOUT = 300000;
  const timeoutOf = (value) =>
    typeof value === "number" && value > 0
      ? Math.min(Math.max(value, MIN_TIMEOUT), MAX_TIMEOUT)
      : DEFAULT_TIMEOUT;

  let nextId = 0;

  // One ceremony with the native side. When the page aborts it or its timeout
  // passes, the page's promise settles at once and the native side is told to
  // close its prompt, so a request that follows is not refused as busy.
  const ceremony = (signal, timeout, build) => {
    if (signal && signal.aborted) return Promise.reject(abortReason(signal));
    let request;
    try {
      request = build();
    } catch (error) {
      return Promise.reject(error);
    }
    const id = (nextId += 1);
    request.id = id;
    return new Promise((resolve, reject) => {
      let timer = 0;
      const settle = () => {
        if (signal) signal.removeEventListener("abort", onAbort);
        window.removeEventListener("pagehide", onHide);
        clearTimeout(timer);
      };
      const stop = (error) => {
        settle();
        const target = handler();
        if (target)
          target
            .postMessage(JSON.stringify({ kind: "cancel", id }))
            .catch(() => {});
        reject(error);
      };
      const onAbort = () => stop(abortReason(signal));
      // A page that goes away mid-prompt never learns a key made after it.
      const onHide = () => stop(notAllowed());
      if (signal) signal.addEventListener("abort", onAbort, { once: true });
      window.addEventListener("pagehide", onHide, { once: true });
      timer = setTimeout(() => stop(notAllowed()), timeoutOf(timeout));
      call(request).then(
        (reply) => {
          settle();
          resolve(credentialFrom(reply));
        },
        (error) => {
          settle();
          reject(error);
        },
      );
    });
  };

  // A request that asks nothing of the user waits until the page aborts it.
  const waiting = (signal) => {
    if (signal && signal.aborted) return Promise.reject(abortReason(signal));
    return new Promise((_, reject) => {
      if (signal) {
        signal.addEventListener("abort", () => reject(abortReason(signal)), {
          once: true,
        });
      }
    });
  };

  const override = (target, name, value) => {
    try {
      Object.defineProperty(target, name, {
        value,
        writable: true,
        configurable: true,
      });
    } catch (_) {
      // A page that froze the API keeps the engine's.
    }
  };

  override(container, "create", function create(options) {
    if (!options || !options.publicKey)
      return nativeCreate.apply(this, arguments);
    // A conditional create is the site's quiet upgrade after a password
    // sign-in; a browser declines it unless its own conditions hold, and here
    // it would raise an unasked-for Touch ID prompt.
    if (options.mediation === "conditional")
      return Promise.reject(notAllowed());
    const publicKey = options.publicKey;
    return ceremony(options.signal, publicKey.timeout, () =>
      createRequest(publicKey),
    );
  });

  override(container, "get", function get(options) {
    if (!options || !options.publicKey) return nativeGet.apply(this, arguments);
    // No autofill list to fill: a conditional request waits, as a browser
    // with nothing to suggest does, until the page aborts it.
    if (options.mediation === "conditional") return waiting(options.signal);
    const publicKey = options.publicKey;
    return ceremony(options.signal, publicKey.timeout, () =>
      getRequest(publicKey),
    );
  });

  // Only an answer is kept: a call before the native side is ready asks again next time.
  let available;
  const isAvailable = () => {
    if (available !== undefined) return Promise.resolve(available);
    return call({ kind: "available" }).then(
      (reply) => (available = Boolean(reply.available)),
      () => false,
    );
  };

  const PublicKeyCredential = window.PublicKeyCredential;
  override(
    PublicKeyCredential,
    "isUserVerifyingPlatformAuthenticatorAvailable",
    isAvailable,
  );
  override(PublicKeyCredential, "isConditionalMediationAvailable", () =>
    Promise.resolve(false),
  );
  if (typeof PublicKeyCredential.getClientCapabilities === "function") {
    override(PublicKeyCredential, "getClientCapabilities", () =>
      isAvailable().then((platform) => ({
        conditionalCreate: false,
        conditionalGet: false,
        hybridTransport: false,
        passkeyPlatformAuthenticator: platform,
        userVerifyingPlatformAuthenticator: platform,
        relatedOrigins: false,
        signalAllAcceptedCredentials: false,
        signalCurrentUserDetails: false,
        signalUnknownCredential: false,
        "extension:credProps": true,
      })),
    );
  }
})();
