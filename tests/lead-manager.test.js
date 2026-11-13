import test from "node:test";
import assert from "node:assert/strict";
import worker from "../cloudflare/lead-manager/worker.js";

const endpoint = "https://lead-manager.example.workers.dev/api/intake";
const origin = "https://wiltek.cloud";

function makeRequest(body, headers = {}) {
  return new Request(endpoint, {
    method: "POST",
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
      "CF-Connecting-IP": "203.0.113.9",
      ...headers
    },
    body: JSON.stringify(body)
  });
}

function makeEnv(overrides = {}) {
  const calls = { inserted: null, limited: 0 };
  const db = {
    prepare(sql) {
      assert.match(sql, /^INSERT INTO leads/);
      return {
        bind(...values) {
          return { async run() { calls.inserted = values; return { success: true }; } };
        }
      };
    }
  };
  return {
    calls,
    LEADS_DB: db,
    LEAD_INTAKE_LIMITER: {
      async limit({ key }) {
        calls.limited += 1;
        calls.key = key;
        return { success: true };
      }
    },
    ...overrides
  };
}

const validLead = {
  name: "Juan Dela Cruz",
  email: "juan@example.com",
  phone: "+639000000000",
  business: "Example Store",
  service: "Custom Business Systems",
  details: "I need an inventory system.",
  budget: "Below ₱10,000",
  timeline: "Within 1 month"
};

test("stores a valid lead using a prepared statement", async () => {
  const env = makeEnv();
  const response = await worker.fetch(makeRequest(validLead), env);
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { ok: true });
  assert.equal(env.calls.limited, 1);
  assert.equal(env.calls.key, "203.0.113.9");
  assert.equal(env.calls.inserted[0], validLead.name);
  assert.equal(env.calls.inserted[1], validLead.email);
  assert.equal(env.calls.inserted[8], "New");
});

test("rejects origins outside the website allowlist", async () => {
  const env = makeEnv();
  const response = await worker.fetch(
    makeRequest(validLead, { Origin: "https://attacker.example" }),
    env
  );
  assert.equal(response.status, 403);
  assert.equal(env.calls.inserted, null);
});

test("rejects invalid email and missing required fields", async () => {
  const env = makeEnv();
  const response = await worker.fetch(
    makeRequest({ ...validLead, email: "not-an-email" }),
    env
  );
  assert.equal(response.status, 400);
  assert.equal(env.calls.inserted, null);
});

test("rejects requests when the intake rate limit is exceeded", async () => {
  const env = makeEnv({
    LEAD_INTAKE_LIMITER: { async limit() { return { success: false }; } }
  });
  const response = await worker.fetch(makeRequest(validLead), env);
  assert.equal(response.status, 429);
  assert.equal(env.calls.inserted, null);
});

test("rejects non-POST requests to intake", async () => {
  const env = makeEnv();
  const response = await worker.fetch(new Request(endpoint, {
    method: "GET",
    headers: { Origin: origin }
  }), env);
  assert.equal(response.status, 405);
});
