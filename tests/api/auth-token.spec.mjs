import assert from "node:assert/strict";
import crypto from "node:crypto";
import { test } from "node:test";

process.env.IDENTITY_PLATFORM_PROJECT_ID = "public-spending-test";

const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
const certificate = publicKey.export({ type: "spki", format: "pem" });
globalThis.fetch = async () => new Response(JSON.stringify({ "test-key": certificate }), {
  status: 200,
  headers: { "content-type": "application/json", "cache-control": "max-age=3600" },
});

const { verifyIdToken } = await import("../../server/auth.mjs");
const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");

function token(claims) {
  const header = encode({ alg: "RS256", kid: "test-key" });
  const payload = encode(claims);
  const signature = crypto.sign("RSA-SHA256", Buffer.from(`${header}.${payload}`), privateKey).toString("base64url");
  return `${header}.${payload}.${signature}`;
}

function claims(overrides = {}) {
  const now = Math.floor(Date.now() / 1000);
  return {
    aud: "public-spending-test",
    iss: "https://securetoken.google.com/public-spending-test",
    sub: "developer-1",
    user_id: "developer-1",
    email: "developer@example.test",
    email_verified: true,
    iat: now - 1,
    exp: now + 3600,
    ...overrides,
  };
}

test("accepts a correctly signed token for a verified email", async () => {
  const verified = await verifyIdToken(token(claims()));
  assert.equal(verified.email, "developer@example.test");
});

test("rejects an unverified email", async () => {
  await assert.rejects(() => verifyIdToken(token(claims({ email_verified: false }))), { code: "email_not_verified", status: 403 });
});

test("rejects expired and wrong-project tokens", async () => {
  const now = Math.floor(Date.now() / 1000);
  await assert.rejects(() => verifyIdToken(token(claims({ exp: now - 120 }))), { code: "token_expired", status: 401 });
  await assert.rejects(() => verifyIdToken(token(claims({ aud: "another-project" }))), { code: "invalid_token", status: 401 });
});

