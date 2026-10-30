import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { encodeAuthEmail, readAuthHint, AUTH_EMAIL_HEADER, AUTH_UID_HEADER } from "./request-auth.ts";

const UID = "11111111-1111-4111-8111-111111111111";

function headers(map: Record<string, string | undefined>) {
  return (name: string) => map[name] ?? null;
}

describe("readAuthHint", () => {
  it("reads a proxy-stamped user id and email", () => {
    const email = encodeAuthEmail("boss@example.com");
    assert.equal(email, "boss%40example.com");
    assert.deepEqual(
      readAuthHint(
        headers({
          [AUTH_UID_HEADER]: UID,
          [AUTH_EMAIL_HEADER]: email ?? undefined,
        })
      ),
      { id: UID, email: "boss@example.com" }
    );
  });

  it("rejects missing, malformed, and injected ids", () => {
    assert.equal(readAuthHint(headers({})), null);
    assert.equal(readAuthHint(headers({ [AUTH_UID_HEADER]: "not-a-uuid" })), null);
    assert.equal(readAuthHint(headers({ [AUTH_UID_HEADER]: `${UID}\r\nSet-Cookie` })), null);
  });

  it("drops a bad email but keeps a valid id", () => {
    assert.deepEqual(
      readAuthHint(headers({ [AUTH_UID_HEADER]: UID, [AUTH_EMAIL_HEADER]: "%E0%A4%A" })),
      { id: UID, email: null }
    );
  });
});
