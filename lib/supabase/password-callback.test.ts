import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { createBrowserClient } from "@supabase/ssr";
import {
  authCallbackPathWithoutSecrets,
  beginPasswordCallback,
  establishPasswordSession,
  readPasswordCallback,
  type PasswordCallbackAuth,
} from "./password-callback.ts";

const ACCESS = "header.payload.access-token-fixture";
const REFRESH = "refresh-token-fixture";
const CODE = "pkce-code-fixture";

function hrefHash() {
  return `https://jcxj.cc/auth/set-password#access_token=${ACCESS}&refresh_token=${REFRESH}&type=recovery`;
}

function mockAuth(opts: {
  sessionAfterExchange?: boolean;
  exchangeError?: boolean;
  exchangeThrows?: boolean;
  setSessionError?: boolean;
  setSessionThrows?: boolean;
  existing?: boolean;
}): PasswordCallbackAuth & {
  calls: { exchange: number; setSession: number };
} {
  let session: { id: string } | null = opts.existing ? { id: "existing" } : null;
  const calls = { exchange: 0, setSession: 0 };
  return {
    calls,
    async exchangeCodeForSession() {
      calls.exchange += 1;
      if (opts.exchangeThrows) throw new Error("exchange failed");
      if (opts.exchangeError) return { error: { message: "exchange failed" } };
      if (opts.sessionAfterExchange) session = { id: "from-code" };
      return { error: null };
    },
    async setSession() {
      calls.setSession += 1;
      if (opts.setSessionThrows) throw new Error("setSession failed");
      if (opts.setSessionError) return { data: { session: null }, error: { message: "invalid" } };
      session = { id: "from-hash" };
      return { data: { session }, error: null };
    },
    async getSession() {
      return { data: { session } };
    },
  };
}

describe("readPasswordCallback", () => {
  it("reads implicit hash tokens and ignores them in the cleaned path", () => {
    const href = hrefHash();
    const params = readPasswordCallback(href);
    assert.equal(params.code, null);
    assert.equal(params.accessToken, ACCESS);
    assert.equal(params.refreshToken, REFRESH);
    const cleaned = authCallbackPathWithoutSecrets(href);
    assert.equal(cleaned, "/auth/set-password");
    assert.equal(cleaned.includes(ACCESS), false);
    assert.equal(cleaned.includes(REFRESH), false);
  });

  it("reads a PKCE code and drops only that query param", () => {
    const href = `https://jcxj.cc/auth/set-password?code=${CODE}&next=%2F`;
    const params = readPasswordCallback(href);
    assert.equal(params.code, CODE);
    assert.equal(params.accessToken, null);
    assert.equal(params.refreshToken, null);
    assert.equal(authCallbackPathWithoutSecrets(href), "/auth/set-password?next=%2F");
  });

  it("treats an error fragment without tokens as empty", () => {
    const href =
      "https://jcxj.cc/auth/set-password#error=access_denied&error_code=otp_expired&error_description=expired";
    const params = readPasswordCallback(href);
    assert.equal(params.accessToken, null);
    assert.equal(params.refreshToken, null);
    assert.equal(params.code, null);
  });
});

describe("establishPasswordSession", () => {
  it("sets the session from a recovery or invite hash", async () => {
    for (const type of ["recovery", "invite"]) {
      const auth = mockAuth({});
      const phase = await establishPasswordSession(
        auth,
        `https://jcxj.cc/auth/set-password#access_token=${ACCESS}&refresh_token=${REFRESH}&type=${type}`,
      );
      assert.equal(phase, "ready");
      assert.equal(auth.calls.exchange, 0);
      assert.equal(auth.calls.setSession, 1);
    }
  });

  it("uses the PKCE code when exchange yields a session", async () => {
    const auth = mockAuth({ sessionAfterExchange: true });
    const phase = await establishPasswordSession(
      auth,
      `https://jcxj.cc/auth/set-password?code=${CODE}`,
    );
    assert.equal(phase, "ready");
    assert.equal(auth.calls.exchange, 1);
    assert.equal(auth.calls.setSession, 0);
  });

  it("falls through to the hash when code exchange fails", async () => {
    const auth = mockAuth({ exchangeThrows: true });
    const phase = await establishPasswordSession(
      auth,
      `https://jcxj.cc/auth/set-password?code=${CODE}#access_token=${ACCESS}&refresh_token=${REFRESH}&type=recovery`,
    );
    assert.equal(phase, "ready");
    assert.equal(auth.calls.exchange, 1);
    assert.equal(auth.calls.setSession, 1);
  });

  it("stays invalid when the link has no usable session", async () => {
    const missing = mockAuth({});
    assert.equal(
      await establishPasswordSession(missing, "https://jcxj.cc/auth/set-password"),
      "invalid",
    );
    const expired = mockAuth({});
    assert.equal(
      await establishPasswordSession(
        expired,
        "https://jcxj.cc/auth/set-password#error_code=otp_expired",
      ),
      "invalid",
    );
    assert.equal(expired.calls.setSession, 0);
    const rejected = mockAuth({ setSessionError: true });
    assert.equal(await establishPasswordSession(rejected, hrefHash()), "invalid");
  });

  it("keeps an existing session without touching the hash", async () => {
    const auth = mockAuth({ existing: true });
    const phase = await establishPasswordSession(auth, hrefHash());
    assert.equal(phase, "ready");
    assert.equal(auth.calls.setSession, 0);
  });

  it("shares one in-flight attempt across the double mount", async () => {
    const auth = mockAuth({});
    let release: (() => void) | null = null;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const original = auth.setSession;
    auth.setSession = async (tokens) => {
      await gate;
      return original(tokens);
    };
    const first = beginPasswordCallback(auth, hrefHash());
    const second = beginPasswordCallback(auth, hrefHash());
    release?.();
    assert.equal(await first, "ready");
    assert.equal(await second, "ready");
    assert.equal(auth.calls.setSession, 1);
  });
});

function b64url(value: object | string) {
  const raw = typeof value === "string" ? value : JSON.stringify(value);
  return Buffer.from(raw).toString("base64url");
}

function makeJwt(sub: string) {
  return [
    b64url({ alg: "HS256", typ: "JWT" }),
    b64url({
      exp: Math.floor(Date.now() / 1000) + 3600,
      sub,
      role: "authenticated",
    }),
    b64url("signature"),
  ].join(".");
}

const USER = {
  id: "11111111-1111-1111-1111-111111111111",
  aud: "authenticated",
  role: "authenticated",
  email: "boss@example.com",
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: {},
  created_at: "2026-01-01T00:00:00.000Z",
};

type BrowserEnv = {
  jar: Map<string, string>;
  fetchPaths: string[];
  restore: () => void;
};

function installBrowser(href: string, secrets: string[]): BrowserEnv {
  const jar = new Map<string, string>();
  const logs: string[] = [];
  const fetchPaths: string[] = [];
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    fetch: globalThis.fetch,
    BroadcastChannel: globalThis.BroadcastChannel,
    log: console.log,
    warn: console.warn,
    error: console.error,
    info: console.info,
    debug: console.debug,
  };

  const capture = (args: unknown[]) => {
    const text = args
      .map((item) => {
        if (typeof item === "string") return item;
        if (item instanceof Error) return `${item.name} ${item.message}`;
        try {
          return JSON.stringify(item);
        } catch {
          return String(item);
        }
      })
      .join(" ");
    logs.push(text);
    for (const secret of secrets) {
      if (secret && text.includes(secret)) {
        throw new Error("callback test logged a credential");
      }
    }
  };

  console.log = (...args: unknown[]) => capture(args);
  console.warn = (...args: unknown[]) => capture(args);
  console.error = (...args: unknown[]) => capture(args);
  console.info = (...args: unknown[]) => capture(args);
  console.debug = (...args: unknown[]) => capture(args);

  const location = {
    get href() {
      return href;
    },
    set href(next: string) {
      href = next;
    },
  };
  const history = {
    state: null,
    replaceState(_state: unknown, _title: string, next?: string | URL | null) {
      if (next) href = new URL(String(next), href).toString();
    },
  };
  const document = {
    addEventListener() {},
    removeEventListener() {},
    get cookie() {
      return [...jar.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
    },
    set cookie(header: string) {
      const first = header.split(";")[0] ?? "";
      const eq = first.indexOf("=");
      const name = first.slice(0, eq).trim();
      const value = first.slice(eq + 1);
      if (/Max-Age=0(?:;|$)/i.test(header)) jar.delete(name);
      else jar.set(name, value);
    },
  };
  const window = {
    location,
    history,
    document,
    addEventListener() {},
    removeEventListener() {},
    setTimeout,
    clearTimeout,
  };

  Object.assign(globalThis, { window, document });
  class SilentChannel {
    postMessage() {}
    close() {}
    addEventListener() {}
    removeEventListener() {}
  }
  globalThis.BroadcastChannel = SilentChannel as unknown as typeof BroadcastChannel;

  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url);
    fetchPaths.push(url.pathname);
    const authHeader = new Headers(init?.headers).get("authorization");
    if (authHeader) {
      for (const secret of secrets) {
        if (secret && authHeader.includes(secret)) {
          // present, but never record the header value
        }
      }
    }
    if (url.pathname.endsWith("/token")) {
      const access = makeJwt(USER.id);
      return Response.json({
        access_token: access,
        refresh_token: "rotated-refresh-fixture",
        token_type: "bearer",
        expires_in: 3600,
        user: USER,
      });
    }
    if (url.pathname.endsWith("/user")) {
      return Response.json(USER);
    }
    return new Response("not found", { status: 404 });
  };

  return {
    jar,
    fetchPaths,
    restore() {
      console.log = previous.log;
      console.warn = previous.warn;
      console.error = previous.error;
      console.info = previous.info;
      console.debug = previous.debug;
      globalThis.fetch = previous.fetch;
      globalThis.BroadcastChannel = previous.BroadcastChannel;
      if (previous.window === undefined) delete (globalThis as { window?: unknown }).window;
      else globalThis.window = previous.window;
      if (previous.document === undefined) delete (globalThis as { document?: unknown }).document;
      else globalThis.document = previous.document;
    },
  };
}

describe("createBrowserClient callback", { concurrency: 1 }, () => {
  let env: BrowserEnv | null = null;

  afterEach(() => {
    env?.restore();
    env = null;
  });

  it("does not adopt a hash session until setSession", async () => {
    const access = makeJwt(USER.id);
    const refresh = "implicit-refresh-fixture";
    const href = `http://127.0.0.1:54321/auth/set-password#access_token=${encodeURIComponent(access)}&refresh_token=${encodeURIComponent(refresh)}&token_type=bearer&type=recovery`;
    env = installBrowser(href, [access, refresh]);
    const supabase = createBrowserClient("http://127.0.0.1:54321", "anon-test-key", {
      isSingleton: false,
    });
    const before = await supabase.auth.getSession();
    assert.equal(before.data.session, null);

    const phase = await establishPasswordSession(supabase.auth, href);
    assert.equal(phase, "ready");
    const after = await supabase.auth.getSession();
    assert.ok(after.data.session);
    assert.equal(env.fetchPaths.some((path) => path.endsWith("/user")), true);
    assert.equal(env.fetchPaths.some((path) => path.endsWith("/token")), false);
    await supabase.auth.stopAutoRefresh();
  });

  it("accepts a PKCE code when the verifier is already stored", async () => {
    const code = "pkce-auth-code-fixture";
    const verifier = "pkce-verifier-fixture";
    const href = `http://127.0.0.1:54321/auth/set-password?code=${code}`;
    env = installBrowser(href, [code, verifier]);
    const stored = JSON.stringify(`${verifier}/recovery`);
    env.jar.set(
      "sb-127-auth-token-code-verifier",
      `base64-${Buffer.from(stored).toString("base64url")}`,
    );
    const supabase = createBrowserClient("http://127.0.0.1:54321", "anon-test-key", {
      isSingleton: false,
    });
    const phase = await establishPasswordSession(supabase.auth, href);
    assert.equal(phase, "ready");
    const after = await supabase.auth.getSession();
    assert.ok(after.data.session);
    assert.equal(env.fetchPaths.some((path) => path.endsWith("/token")), true);
    await supabase.auth.stopAutoRefresh();
  });
});
