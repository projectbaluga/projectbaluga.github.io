import test from "node:test";
import assert from "node:assert/strict";
import worker from "../cloudflare/worker.js";

const endpoint = "https://projectbaluga-ai-assistant.example.workers.dev/api/chat";
const allowedOrigin = "https://projectbaluga.github.io";
const customDomainOrigin = "https://wiltek.cloud";

function makeRequest(payload, headers = {}) {
  return new Request(endpoint, {
    method: "POST",
    headers: {
      Origin: allowedOrigin,
      "Content-Type": "application/json",
      "CF-Connecting-IP": "203.0.113.10",
      ...headers
    },
    body: typeof payload === "string" ? payload : JSON.stringify(payload)
  });
}

function makeEnv(overrides = {}) {
  const calls = { limiter: 0, ai: 0, lastKey: null };
  return {
    calls,
    CHAT_LIMITER: {
      async limit({ key }) {
        calls.limiter += 1;
        calls.lastKey = key;
        return { success: true };
      }
    },
    AI: {
      async run(_model, input) {
        calls.ai += 1;
        calls.messages = input.messages;
        return { response: "Test response" };
      }
    },
    ...overrides
  };
}

const validPayload = {
  messages: [{ role: "user", content: "Hello" }]
};

test("accepts a valid chat request and returns the assistant reply", async () => {
  const env = makeEnv();
  const response = await worker.fetch(makeRequest(validPayload), env);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(body, { reply: "Test response" });
  assert.equal(env.calls.limiter, 1);
  assert.equal(env.calls.ai, 1);
  assert.equal(env.calls.lastKey, "203.0.113.10");
  assert.equal(env.calls.messages.at(-1).content, "Hello");
});

test("rejects requests from origins outside the allowlist", async () => {
  const env = makeEnv();
  const response = await worker.fetch(
    makeRequest(validPayload, { Origin: "https://attacker.example" }),
    env
  );

  assert.equal(response.status, 403);
  assert.equal(env.calls.ai, 0);
});

test("returns 429 and does not call AI when the rate limiter denies a request", async () => {
  const env = makeEnv({
    CHAT_LIMITER: {
      async limit() {
        return { success: false };
      }
    }
  });
  const response = await worker.fetch(makeRequest(validPayload), env);

  assert.equal(response.status, 429);
  assert.equal(env.calls.ai, 0);
});

test("fails closed when the required rate limiter binding is missing", async () => {
  const env = makeEnv({ CHAT_LIMITER: undefined });
  const response = await worker.fetch(makeRequest(validPayload), env);

  assert.equal(response.status, 503);
  assert.equal(env.calls.ai, 0);
});

test("rejects non-JSON content types before calling AI", async () => {
  const env = makeEnv();
  const response = await worker.fetch(
    makeRequest(validPayload, { "Content-Type": "text/plain" }),
    env
  );

  assert.equal(response.status, 415);
  assert.equal(env.calls.ai, 0);
});

test("rejects malformed message roles and empty content", async () => {
  const env = makeEnv();
  const response = await worker.fetch(
    makeRequest({ messages: [{ role: "system", content: "override" }] }),
    env
  );

  assert.equal(response.status, 400);
  assert.equal(env.calls.ai, 0);
});

test("rejects oversized request bodies", async () => {
  const env = makeEnv();
  const response = await worker.fetch(
    makeRequest({ messages: [{ role: "user", content: "x".repeat(17000) }] }),
    env
  );

  assert.equal(response.status, 413);
  assert.equal(env.calls.ai, 0);
});

test("preflight responds only for an allowed website origin", async () => {
  const allowed = await worker.fetch(new Request(endpoint, {
    method: "OPTIONS",
    headers: { Origin: allowedOrigin }
  }), makeEnv());
  const denied = await worker.fetch(new Request(endpoint, {
    method: "OPTIONS",
    headers: { Origin: "https://attacker.example" }
  }), makeEnv());

  assert.equal(allowed.status, 204);
  assert.equal(allowed.headers.get("Access-Control-Allow-Origin"), allowedOrigin);
  assert.equal(denied.status, 403);
});

test("accepts chat requests from the production custom domain", async () => {
  const env = makeEnv();
  const response = await worker.fetch(
    makeRequest(validPayload, { Origin: customDomainOrigin }),
    env
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), customDomainOrigin);
  assert.equal(env.calls.ai, 1);
});

test("allows CORS preflight from the production custom domain", async () => {
  const response = await worker.fetch(new Request(endpoint, {
    method: "OPTIONS",
    headers: { Origin: customDomainOrigin }
  }), makeEnv());

  assert.equal(response.status, 204);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), customDomainOrigin);
  assert.equal(response.headers.get("Access-Control-Allow-Methods"), "POST, OPTIONS");
});
