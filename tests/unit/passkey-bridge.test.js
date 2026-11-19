import fs from "fs";
import path from "path";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

// passkey.js hands a page's WebAuthn request to the native authenticator in a
// macOS app and turns the answer back into a PublicKeyCredential.
const source = fs.readFileSync(
  path.join(process.cwd(), "src-tauri/src/inject/passkey.js"),
  "utf-8",
);

const b64url = (bytes) =>
  Buffer.from(bytes)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

function load({ reply, handler = true, top = true } = {}) {
  class PublicKeyCredential {
    static isUserVerifyingPlatformAuthenticatorAvailable() {
      return Promise.resolve(false);
    }
    static isConditionalMediationAvailable() {
      return Promise.resolve(true);
    }
    get id() {
      throw new TypeError("Illegal invocation");
    }
  }
  class AuthenticatorAttestationResponse {}
  class AuthenticatorAssertionResponse {}
  const nativeCalls = [];
  class CredentialsContainer {
    create(options) {
      nativeCalls.push(["create", options]);
      return Promise.resolve("native");
    }
    get(options) {
      nativeCalls.push(["get", options]);
      return Promise.resolve("native");
    }
  }
  const posted = [];
  const page = new EventTarget();
  const window = {
    addEventListener: page.addEventListener.bind(page),
    removeEventListener: page.removeEventListener.bind(page),
    dispatchEvent: page.dispatchEvent.bind(page),
    PublicKeyCredential,
    CredentialsContainer,
    AuthenticatorAttestationResponse,
    AuthenticatorAssertionResponse,
    webkit: handler
      ? {
          messageHandlers: {
            pakePasskey: {
              postMessage(text) {
                const request = JSON.parse(text);
                posted.push(request);
                const answer = reply(request);
                return Promise.resolve(answer).then((value) =>
                  JSON.stringify(value),
                );
              },
            },
          },
        }
      : undefined,
  };
  window.top = top ? window : {};
  runInNewContext(source, {
    window,
    btoa,
    atob,
    DOMException,
    Promise,
    Uint8Array,
    ArrayBuffer,
    setTimeout,
    clearTimeout,
  });
  return {
    window,
    credentials: new CredentialsContainer(),
    posted,
    nativeCalls,
  };
}

const created = {
  id: b64url([1, 2, 3]),
  authenticatorAttachment: "platform",
  clientExtensionResults: { credProps: { rk: true } },
  response: {
    clientDataJSON: b64url(Buffer.from('{"type":"webauthn.create"}')),
    attestationObject: b64url([0xa3]),
    authenticatorData: b64url([9, 9]),
    publicKey: b64url([4, 5]),
    publicKeyAlgorithm: -7,
    transports: ["internal"],
  },
};

const signedIn = {
  id: b64url([1, 2, 3]),
  authenticatorAttachment: "platform",
  clientExtensionResults: {},
  response: {
    clientDataJSON: b64url(Buffer.from('{"type":"webauthn.get"}')),
    authenticatorData: b64url([7]),
    signature: b64url([0x30, 0x44]),
    userHandle: b64url([42]),
  },
};

const createOptions = {
  publicKey: {
    challenge: new Uint8Array([250, 251, 252]),
    rp: { id: "example.com", name: "Example" },
    user: { id: new Uint8Array([1]).buffer, name: "me", displayName: "Me" },
    pubKeyCredParams: [{ type: "public-key", alg: -7 }],
    excludeCredentials: [{ type: "public-key", id: new Uint8Array([5]) }],
    extensions: { credProps: true },
  },
};

describe("passkey bridge", () => {
  it("sends a create's buffers as base64url and answers with a real-looking credential", async () => {
    const { window, credentials, posted } = load({ reply: () => created });
    const credential = await credentials.create(createOptions);
    expect(posted[0].kind).toBe("create");
    expect(posted[0].publicKey.challenge).toBe("-vv8");
    expect(posted[0].publicKey.user.id).toBe("AQ");
    expect(posted[0].publicKey.excludeCredentials).toEqual([
      { type: "public-key", id: "BQ" },
    ]);
    expect(credential instanceof window.PublicKeyCredential).toBe(true);
    expect(
      credential.response instanceof window.AuthenticatorAttestationResponse,
    ).toBe(true);
    expect(credential.id).toBe(created.id);
    expect([...new Uint8Array(credential.rawId)]).toEqual([1, 2, 3]);
    expect(credential.response.getTransports()).toEqual(["internal"]);
    expect(credential.response.getPublicKeyAlgorithm()).toBe(-7);
    expect([
      ...new Uint8Array(credential.response.getAuthenticatorData()),
    ]).toEqual([9, 9]);
    expect(credential.getClientExtensionResults()).toEqual({
      credProps: { rk: true },
    });
    expect(credential.toJSON().response.attestationObject).toBe(
      created.response.attestationObject,
    );
  });

  it("lets a page replace a credential's methods, as GitHub's webauthn-json does", async () => {
    const { credentials } = load({ reply: () => created });
    const credential = await credentials.create(createOptions);
    // GitHub: `let t = await navigator.credentials.create(e); return t.toJSON = () => ..., t`
    const assign = new Function(
      "credential",
      '"use strict"; credential.toJSON = () => "page"; return credential.toJSON();',
    );
    expect(assign(credential)).toBe("page");
    expect(() =>
      new Function("credential", '"use strict"; credential.id = "x";')(
        credential,
      ),
    ).toThrow(TypeError);
    expect(credential.id).toBe(created.id);
    // Assigning made `toJSON` an own key, as on a browser; a fresh one has none.
    const fresh = await credentials.create(createOptions);
    expect(Object.keys(fresh)).toEqual([]);
    // FIDO's webauthn-demo serialises a credential with `for (key in credential)`.
    const listed = [];
    for (const key in fresh) listed.push(key);
    expect(listed).toEqual(
      expect.arrayContaining(["id", "rawId", "type", "response"]),
    );
    const fields = [];
    for (const key in fresh.response) fields.push(key);
    expect(fields).toEqual(
      expect.arrayContaining(["clientDataJSON", "attestationObject"]),
    );
  });

  it("answers a sign-in with an assertion carrying the user handle", async () => {
    const { window, credentials, posted } = load({ reply: () => signedIn });
    const credential = await credentials.get({
      publicKey: { challenge: new Uint8Array([1]), rpId: "example.com" },
    });
    expect(posted[0]).toEqual({
      id: 1,
      kind: "get",
      publicKey: { challenge: "AQ", rpId: "example.com", allowCredentials: [] },
    });
    expect(
      credential.response instanceof window.AuthenticatorAssertionResponse,
    ).toBe(true);
    expect([...new Uint8Array(credential.response.userHandle)]).toEqual([42]);
    expect(credential.toJSON().response.signature).toBe(
      signedIn.response.signature,
    );
  });

  it("raises the native side's failure as the DOMException a browser would", async () => {
    const { credentials } = load({
      reply: () => ({ error: "NotAllowedError", message: "" }),
    });
    await expect(
      credentials.get({ publicKey: { challenge: new Uint8Array([1]) } }),
    ).rejects.toMatchObject({
      name: "NotAllowedError",
    });
    const typed = load({
      reply: () => ({ error: "TypeError", message: "bad" }),
    });
    await expect(typed.credentials.create(createOptions)).rejects.toMatchObject(
      { name: "TypeError" },
    );
  });

  it("leaves requests without publicKey to the engine", async () => {
    const { credentials, nativeCalls, posted } = load({ reply: () => created });
    expect(await credentials.get({ password: true })).toBe("native");
    expect(nativeCalls).toHaveLength(1);
    expect(posted).toHaveLength(0);
  });

  it("holds a conditional request until the page aborts it, and asks nothing", async () => {
    const { window, credentials, posted } = load({ reply: () => signedIn });
    const controller = new AbortController();
    const pending = credentials.get({
      mediation: "conditional",
      signal: controller.signal,
      publicKey: { challenge: new Uint8Array([1]) },
    });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(posted).toHaveLength(0);
    expect(
      await window.PublicKeyCredential.isConditionalMediationAvailable(),
    ).toBe(false);
  });

  it("reports the platform authenticator from the native side", async () => {
    let ready = false;
    const { window, posted } = load({
      reply: () => (ready ? { available: true } : { error: "NotAllowedError" }),
    });
    // A call before the native side answers is not remembered as "no".
    expect(
      await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable(),
    ).toBe(false);
    ready = true;
    expect(
      await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable(),
    ).toBe(true);
    await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    expect(posted).toHaveLength(2);
  });

  it("refuses when the native handler is missing, and stays out of frames", async () => {
    const { credentials } = load({ handler: false, reply: () => created });
    await expect(credentials.create(createOptions)).rejects.toMatchObject({
      name: "NotAllowedError",
    });
    const framed = load({ top: false, reply: () => created });
    expect(await framed.credentials.create(createOptions)).toBe("native");
  });

  it("tells the native side to close its prompt when the page aborts", async () => {
    const { credentials, posted } = load({
      reply: (request) =>
        request.kind === "cancel" ? {} : new Promise(() => {}),
    });
    const controller = new AbortController();
    const pending = credentials.get({
      signal: controller.signal,
      publicKey: { challenge: new Uint8Array([1]) },
    });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(posted.map((request) => request.kind)).toEqual(["get", "cancel"]);
    expect(posted[1].id).toBe(posted[0].id);
  });

  it("tells the native side to close its prompt when the page goes away", async () => {
    const { window, credentials, posted } = load({
      reply: (request) =>
        request.kind === "cancel" ? {} : new Promise(() => {}),
    });
    const pending = credentials.create(createOptions);
    window.dispatchEvent(new Event("pagehide"));
    await expect(pending).rejects.toMatchObject({ name: "NotAllowedError" });
    expect(posted.map((request) => request.kind)).toEqual(["create", "cancel"]);
    expect(posted[1].id).toBe(posted[0].id);
  });

  it("gives up after the site's timeout, never below the browser's floor", async () => {
    vi.useFakeTimers();
    try {
      const { credentials, posted } = load({
        reply: (request) =>
          request.kind === "cancel" ? {} : new Promise(() => {}),
      });
      let settled = null;
      credentials
        .get({ publicKey: { challenge: new Uint8Array([1]), timeout: 1000 } })
        .catch((error) => (settled = error.name));
      await vi.advanceTimersByTimeAsync(1000);
      expect(settled).toBe(null);
      await vi.advanceTimersByTimeAsync(29000);
      expect(settled).toBe("NotAllowedError");
      expect(posted.map((request) => request.kind)).toEqual(["get", "cancel"]);
      let unbounded = null;
      credentials
        .get({ publicKey: { challenge: new Uint8Array([1]) } })
        .catch((error) => (unbounded = error.name));
      await vi.advanceTimersByTimeAsync(299000);
      expect(unbounded).toBe(null);
      await vi.advanceTimersByTimeAsync(1000);
      expect(unbounded).toBe("NotAllowedError");
    } finally {
      vi.useRealTimers();
    }
  });

  it("declines a conditional create without asking the user", async () => {
    const { credentials, posted } = load({ reply: () => created });
    await expect(
      credentials.create({ ...createOptions, mediation: "conditional" }),
    ).rejects.toMatchObject({ name: "NotAllowedError" });
    expect(posted).toHaveLength(0);
  });
});
