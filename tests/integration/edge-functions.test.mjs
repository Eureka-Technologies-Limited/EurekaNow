// ─────────────────────────────────────────────────────────────────────────────
// INTEGRATION TESTS — Supabase Edge Functions (live)
//
// These tests hit the REAL deployed edge functions. They are not Jest tests —
// run them with Node directly:
//
//   node tests/integration/edge-functions.test.mjs
//
// Requirements:
//   • All 4 functions must be deployed
//   • SUPABASE_ANON_KEY must be set in .env (or exported in shell)
//   • A valid test user JWT is needed for authenticated tests
//     (grab one via: supabase auth sign-in or from the browser dev tools)
//
// These are SAFE read-only or intentionally-rejected tests.
// No Stripe charges, no DB writes (except the checkout session which is
// blocked at the Stripe side because no card is supplied).
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT  = join(__dir, "../..");

// ── Load .env if present ──────────────────────────────────────────────────────
const envPath = join(ROOT, ".env");
if (existsSync(envPath)) {
  readFileSync(envPath, "utf8").split("\n").forEach((line) => {
    const [k, ...v] = line.split("=");
    if (k && v.length) process.env[k.trim()] = v.join("=").trim().replace(/^["']|["']$/g, "");
  });
}

const BASE      = "https://anhsumvnxmxosdjclfss.supabase.co/functions/v1";
const ANON_KEY  = process.env.SUPABASE_ANON_KEY || "";
const TEST_JWT  = process.env.TEST_USER_JWT     || ""; // optional, for auth tests

// ── Tiny test runner ──────────────────────────────────────────────────────────
let passed = 0, failed = 0, skipped = 0;
const results = [];

async function test(name, fn, skip = false) {
  if (skip) {
    console.log(`  ⏭   SKIP  ${name}`);
    skipped++;
    results.push({ name, status: "skip" });
    return;
  }
  try {
    await fn();
    console.log(`  ✅  PASS  ${name}`);
    passed++;
    results.push({ name, status: "pass" });
  } catch (err) {
    console.log(`  ❌  FAIL  ${name}`);
    console.log(`           ${err.message}`);
    failed++;
    results.push({ name, status: "fail", error: err.message });
  }
}

function expect(val) {
  return {
    toBe(exp)          { if (val !== exp)   throw new Error(`Expected ${exp}, got ${val}`); },
    toBeOneOf(...vals) { if (!vals.flat().includes(val)) throw new Error(`Expected one of [${vals.flat()}], got ${val}`); },
    toBeGreaterThan(n) { if (!(val > n))    throw new Error(`Expected ${val} > ${n}`); },
    toMatch(re)        { if (!re.test(val)) throw new Error(`Expected "${val}" to match ${re}`); },
    toHaveProperty(k)  { if (!(k in val))  throw new Error(`Expected object to have property "${k}"`); },
    toBeNull()         { if (val !== null)  throw new Error(`Expected null, got ${val}`); },
    toBeTruthy()       { if (!val)          throw new Error(`Expected truthy, got ${val}`); },
    toBeFalsy()        { if (val)           throw new Error(`Expected falsy, got ${val}`); },
    toContain(str)     { if (!String(val).includes(str)) throw new Error(`Expected "${val}" to contain "${str}"`); },
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function options(fn) {
  return fetch(`${BASE}/${fn}`, {
    method: "OPTIONS",
    headers: { "Content-Type": "application/json" },
  });
}

async function post(fn, body, jwt) {
  const headers = { "Content-Type": "application/json" };
  if (jwt)      headers["Authorization"] = `Bearer ${jwt}`;
  if (ANON_KEY) headers["apikey"]        = ANON_KEY;
  return fetch(`${BASE}/${fn}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 1: Deployment check (OPTIONS / CORS preflight)
// ─────────────────────────────────────────────────────────────────────────────

console.log("\n╔══════════════════════════════════════════════════════════╗");
console.log("║     EurekaNow — Edge Function Integration Tests          ║");
console.log("╚══════════════════════════════════════════════════════════╝\n");
console.log("── Suite 1: Deployment checks ──────────────────────────────\n");

await test("create-checkout-session is deployed (OPTIONS returns 2xx/4xx not 404)", async () => {
  const res = await options("create-checkout-session");
  // 404 body from Supabase is "Not Found" — a deployed fn returns something else
  const body = await res.text();
  const isDeployed = res.status !== 404 || !body.toLowerCase().includes("not found");
  if (!isDeployed) throw new Error(`Got 404 Not Found — function not deployed`);
});

await test("create-billing-portal-session is deployed", async () => {
  const res = await options("create-billing-portal-session");
  const body = await res.text();
  const isDeployed = res.status !== 404 || !body.toLowerCase().includes("not found");
  if (!isDeployed) throw new Error(`Got 404 Not Found — function not deployed`);
});

await test("get-billing-data is deployed", async () => {
  const res = await options("get-billing-data");
  const body = await res.text();
  const isDeployed = res.status !== 404 || !body.toLowerCase().includes("not found");
  if (!isDeployed) throw new Error(`Got 404 Not Found — function not deployed`);
});

await test("stripe-webhook is deployed", async () => {
  const res = await options("stripe-webhook");
  const body = await res.text();
  const isDeployed = res.status !== 404 || !body.toLowerCase().includes("not found");
  if (!isDeployed) throw new Error(`Got 404 Not Found — function not deployed`);
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 2: Unauthenticated requests (all JWT-protected fns should reject)
// ─────────────────────────────────────────────────────────────────────────────

console.log("\n── Suite 2: Auth enforcement ───────────────────────────────\n");

await test("create-checkout-session rejects request with no JWT", async () => {
  const res = await post("create-checkout-session", { priceId: "price_test" }, null);
  expect(res.status).toBeOneOf(400, 401, 403);
});

await test("create-billing-portal-session rejects request with no JWT", async () => {
  const res = await post("create-billing-portal-session", {}, null);
  expect(res.status).toBeOneOf(400, 401, 403);
});

await test("get-billing-data rejects request with no JWT", async () => {
  const res = await post("get-billing-data", {}, null);
  expect(res.status).toBeOneOf(400, 401, 403);
});

await test("stripe-webhook rejects POST with no Stripe signature (returns 400)", async () => {
  const res = await fetch(`${BASE}/stripe-webhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "test" }),
  });
  expect(res.status).toBe(400);
  const text = await res.text();
  expect(text).toContain("stripe-signature");
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 3: Authenticated requests (requires TEST_USER_JWT)
// ─────────────────────────────────────────────────────────────────────────────

const hasJWT = Boolean(TEST_JWT);
console.log("\n── Suite 3: Authenticated calls (" + (hasJWT ? "JWT present" : "⚠️  no TEST_USER_JWT — skipping") + ") ──\n");

await test(
  "get-billing-data returns 200 with { subscription, invoices }",
  async () => {
    const res  = await post("get-billing-data", {}, TEST_JWT);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveProperty("subscription");
    expect(json).toHaveProperty("invoices");
    if (!Array.isArray(json.invoices)) throw new Error("invoices must be an array");
  },
  !hasJWT,
);

await test(
  "get-billing-data invoices are all valid invoice objects",
  async () => {
    const res  = await post("get-billing-data", {}, TEST_JWT);
    const json = await res.json();
    for (const inv of json.invoices) {
      if (!inv.id)     throw new Error(`Invoice missing id: ${JSON.stringify(inv)}`);
      if (!inv.status) throw new Error(`Invoice missing status: ${JSON.stringify(inv)}`);
    }
  },
  !hasJWT,
);

await test(
  "create-checkout-session with valid priceId returns { url }",
  async () => {
    const res  = await post("create-checkout-session", {
      priceId:     "price_1TdZmTJzWbyeb81A8OaC9A9S",
      successUrl:  "https://app.eurekanow.com?billing=success",
      cancelUrl:   "https://app.eurekanow.com?billing=cancel",
    }, TEST_JWT);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveProperty("url");
    expect(json.url).toMatch(/^https:\/\//);
  },
  !hasJWT,
);

await test(
  "create-checkout-session with invalid priceId returns 400",
  async () => {
    const res = await post("create-checkout-session", {
      priceId:    "price_INVALID",
      successUrl: "https://app.eurekanow.com",
      cancelUrl:  "https://app.eurekanow.com",
    }, TEST_JWT);
    expect(res.status).toBeOneOf(400, 422, 500);
  },
  !hasJWT,
);

await test(
  "create-billing-portal-session returns { url } (org with customer only)",
  async () => {
    const res  = await post("create-billing-portal-session", {
      returnUrl: "https://app.eurekanow.com",
    }, TEST_JWT);
    // Returns 400 if org has no stripe_customer_id yet — that's also acceptable
    const json = await res.json();
    const ok = res.status === 200 || json.error?.includes("No billing customer");
    if (!ok) throw new Error(`Unexpected status ${res.status}: ${JSON.stringify(json)}`);
  },
  !hasJWT,
);

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 4: Stripe webhook event routing
// ─────────────────────────────────────────────────────────────────────────────

console.log("\n── Suite 4: Webhook signature enforcement ──────────────────\n");

await test("stripe-webhook rejects empty body", async () => {
  const res = await fetch(`${BASE}/stripe-webhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "",
  });
  expect(res.status).toBe(400);
});

await test("stripe-webhook rejects invalid signature", async () => {
  const res = await fetch(`${BASE}/stripe-webhook`, {
    method: "POST",
    headers: {
      "Content-Type":    "application/json",
      "stripe-signature": "t=1234,v1=fakesignature",
    },
    body: JSON.stringify({ type: "checkout.session.completed" }),
  });
  expect(res.status).toBe(400);
});

await test("stripe-webhook rejects GET method", async () => {
  const res = await fetch(`${BASE}/stripe-webhook`, { method: "GET" });
  // Deno serve will still respond, but must not be 200 OK for GET
  expect(res.status).toBeOneOf(400, 404, 405);
});

// ─────────────────────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────────────────────

const total = passed + failed + skipped;
console.log(`\n╔══════════════════════════════════════════════════════════╗`);
console.log(`║  Results: ${passed}/${total - skipped} passed  |  ${failed} failed  |  ${skipped} skipped         ║`);
console.log(`╚══════════════════════════════════════════════════════════╝\n`);

if (failed > 0) {
  console.log("❌ Failed tests:");
  results.filter((r) => r.status === "fail").forEach((r) => {
    console.log(`   • ${r.name}`);
    console.log(`     ${r.error}`);
  });
  process.exit(1);
} else {
  console.log("🎉 All tests passed!\n");
}
