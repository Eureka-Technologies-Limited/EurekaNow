# EurekaNow — Billing Test Suite

Tests for the Stripe billing integration: plan cards, admin gate, edge functions, DB schema, and end-to-end subscription flows.

---

## Structure

```
tests/
├── README.md                         ← you are here
│
├── unit/                             ← Jest tests (npm test)
│   ├── billing-helpers.test.js       ← pure function tests (isAdmin, fmt, fmtDate, PLANS)
│   └── BillingView.test.jsx          ← React component tests (all network calls mocked)
│
├── integration/                      ← Node scripts (hit real endpoints)
│   ├── edge-functions.test.mjs       ← tests all 4 deployed edge functions
│   └── database.test.mjs             ← checks DB schema and data integrity
│
└── e2e/
    └── billing-checklist.md          ← manual test checklist for full subscription flows
```

---

## Unit tests

Run with the standard `npm test` command. No network calls, no Supabase, no Stripe.

```bash
# All unit tests
npm test

# Billing helpers only (fast — ~0.1s)
npm test -- --testPathPattern=tests/unit/billing-helpers --watchAll=false

# BillingView component only
npm test -- --testPathPattern=tests/unit/BillingView --watchAll=false
```

### What's covered

**`billing-helpers.test.js`** — 20 tests

| Suite | What it tests |
|-------|---------------|
| `isAdmin()` | role string, roles array, case-insensitivity, null/undefined, empty roles |
| `fmt()` | pence→GBP formatting, odd amounts, currency codes, decimal places |
| `fmtDate()` | Stripe unix timestamp → readable UK date |
| `PLANS` config | 3 plans, priceId formats, price ordering, key consistency |

**`BillingView.test.jsx`** — 26 tests

| Suite | What it tests |
|-------|---------------|
| Admin gate | non-admin blocked, admin access, roles array, lowercase "admin" |
| Plan cards | all 3 cards rendered, prices, current plan badge, button labels |
| Success banner | `?billing=success` param shows/hides banner |
| Invoice table | empty state, rows, amounts, PDF links, column headers |
| Subscription status | shown on paid plans, hidden on Free |
| Manage Billing | shown on paid plans, hidden on Free, calls correct edge fn |
| Error handling | network errors surfaced in UI |
| Org info | org name and plan shown |

### Mocking strategy

The Jest tests mock:
- `src/core/hooks.js` — `useTokens()` returns a static tokens object
- `src/core/icons.jsx` — `I` renders a `<span>` with `data-testid`
- `src/core/supabase.js` — `getSession()` returns a fake JWT
- `global.fetch` — returns controlled JSON responses per test

Real modules not mocked (tested as-is): React, `@testing-library/*`, `process.env`.

---

## Integration tests

These hit the **real deployed endpoints**. Run them with Node directly.

### Requirements

- All 4 edge functions must be deployed (see main README)
- Internet access from the machine running the tests
- Optionally: a valid user JWT in `.env` as `TEST_USER_JWT` (enables auth test suite)

### How to get a test JWT

```bash
# Sign in as a test user and copy the access_token:
curl -s -X POST "https://anhsumvnxmxosdjclfss.supabase.co/auth/v1/token?grant_type=password" \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"your@email.com","password":"yourpassword"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])"

# Add to .env:
echo 'TEST_USER_JWT=eyJ...' >> .env
```

### Run

```bash
# Edge function tests (suites 1–4: deployment, auth enforcement, authenticated calls, webhooks)
node tests/integration/edge-functions.test.mjs

# Database schema tests (suites 1–5: connection, schema, data integrity, indexes, summary)
node tests/integration/database.test.mjs
```

### Edge function test suites

| Suite | What it tests |
|-------|---------------|
| 1 — Deployment | All 4 functions respond (not 404) |
| 2 — Auth enforcement | Unauthenticated requests return 401/403 |
| 3 — Authenticated calls | `get-billing-data`, `create-checkout-session`, `create-billing-portal-session` return expected shapes (requires `TEST_USER_JWT`) |
| 4 — Webhook security | `stripe-webhook` rejects missing/invalid signatures |

### Database test suites

| Suite | What it tests |
|-------|---------------|
| 1 — Connection | Service role key is valid |
| 2 — Schema | `stripe_customer_id` and `plan` columns exist |
| 3 — Data integrity | Plan values are valid, no duplicate customer IDs |
| 4 — Indexes | `idx_organizations_stripe_customer_id` exists |
| 5 — Org summary | Prints current state of all orgs |

---

## E2E manual checklist

`tests/e2e/billing-checklist.md` is a step-by-step human checklist for testing real Stripe flows: subscribing, upgrading, cancelling, invoice downloads, webhook events.

Open it and work through each section before a production release.

```bash
# View it:
open tests/e2e/billing-checklist.md
```

---

## Adding the tests to package.json

To make `npm test` also pick up the `tests/unit/` folder, add this to `package.json`:

```json
"jest": {
  "testMatch": [
    "<rootDir>/src/**/*.{test,spec}.{js,jsx}",
    "<rootDir>/tests/unit/**/*.{test,spec}.{js,jsx}"
  ]
}
```

Without this, run the unit tests directly:

```bash
npx react-scripts test --testPathPattern=tests/unit --watchAll=false
```

---

## Quick health check

Run all automated tests in one go:

```bash
# Unit tests
npm test -- --watchAll=false

# Integration: DB
node tests/integration/database.test.mjs

# Integration: edge functions
node tests/integration/edge-functions.test.mjs
```

All three should exit 0 before every deployment.

---

## Test data notes

- No test creates a real Stripe charge — authenticated edge function tests create Checkout sessions which expire without payment
- The database tests are read-only
- Use Stripe's test card `4242 4242 4242 4242` for E2E flows (does not charge real money)
- Stripe test events can be fired via `stripe trigger <event>` using the Stripe CLI
