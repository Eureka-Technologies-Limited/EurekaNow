# End-to-End Billing Test Checklist

Manual test checklist for the EurekaNow billing system. Work through these in order — each section builds on the previous one being green.

---

## Prerequisites

- [ ] All 4 edge functions deployed (run `node tests/integration/edge-functions.test.mjs` — all green)
- [ ] Database schema correct (run `node tests/integration/database.test.mjs` — all green)
- [ ] Stripe webhook registered with signing secret set as Supabase secret
- [ ] App running locally (`npm start`) or on staging

**Test card numbers (Stripe test mode):**
- Success: `4242 4242 4242 4242`  exp: any future date  cvc: any 3 digits
- Decline: `4000 0000 0000 9995`

---

## Section 1 — Admin gate

| # | Test | Expected | Pass? |
|---|------|----------|-------|
| 1.1 | Log in as a non-Admin user (Agent or End User role) | Billing is NOT in the sidebar | ☐ |
| 1.2 | Navigate directly to `?view=billing` as a non-Admin | See "Admin Access Required" screen, plan cards are not visible | ☐ |
| 1.3 | Log in as an Admin | Billing link appears in the sidebar footer as "Plans & Billing" | ☐ |
| 1.4 | Click "Plans & Billing" as Admin | Billing page loads with 3 plan cards | ☐ |

---

## Section 2 — Plan cards (Free tier)

| # | Test | Expected | Pass? |
|---|------|----------|-------|
| 2.1 | View billing page as Admin on Free plan | Free card shows "Current" badge, Basic and Pro show "Upgrade" buttons | ☐ |
| 2.2 | Free card button | Button reads "Current plan" and is disabled | ☐ |
| 2.3 | Basic card button | Button reads "Upgrade to Basic" | ☐ |
| 2.4 | Pro card button | Button reads "Upgrade to Pro" | ☐ |
| 2.5 | "Manage Billing" button is NOT visible | Not present on Free plan | ☐ |

---

## Section 3 — Subscribe (Basic)

| # | Test | Expected | Pass? |
|---|------|----------|-------|
| 3.1 | Click "Upgrade to Basic" | Loading spinner appears on button | ☐ |
| 3.2 | Stripe Checkout opens | Page redirects to `checkout.stripe.com` | ☐ |
| 3.3 | Checkout shows correct product | "EurekaNow Basic" at £29/month | ☐ |
| 3.4 | Enter success card `4242 4242 4242 4242` and complete payment | Redirected back to app with `?billing=success` | ☐ |
| 3.5 | Success banner shown | "Subscription activated — welcome to Basic!" (or similar) | ☐ |
| 3.6 | Wait ~5 seconds then refresh billing page | Plan card now shows "Basic" as current | ☐ |
| 3.7 | Check Supabase DB | `organizations.plan = 'Basic'` and `stripe_customer_id = 'cus_...'` set | ☐ |

---

## Section 4 — Subscribe (cancel flow)

| # | Test | Expected | Pass? |
|---|------|----------|-------|
| 4.1 | Click "Upgrade to Pro" | Redirects to Stripe Checkout | ☐ |
| 4.2 | Click "Back" / cancel in Stripe Checkout | Redirected back to app with `?billing=cancel` | ☐ |
| 4.3 | No success banner shown | Plan unchanged | ☐ |
| 4.4 | Plan in DB unchanged | Still "Basic" in `organizations` | ☐ |

---

## Section 5 — Manage Billing portal

| # | Test | Expected | Pass? |
|---|------|----------|-------|
| 5.1 | With active subscription, billing page shows "Manage Billing" button | Button visible in subscription status section | ☐ |
| 5.2 | Click "Manage Billing" | Redirects to Stripe Customer Portal | ☐ |
| 5.3 | Stripe Portal shows payment method, next invoice, plan options | Portal displays correctly | ☐ |
| 5.4 | Switch from Basic to Pro in portal | Plan shown changes in portal | ☐ |
| 5.5 | Return to app after portal switch | `?return=1` param handled cleanly | ☐ |
| 5.6 | Wait ~5 seconds, refresh billing page | Plan card now shows "Pro" as current | ☐ |
| 5.7 | DB updated | `organizations.plan = 'Pro'` | ☐ |

---

## Section 6 — Invoice history

| # | Test | Expected | Pass? |
|---|------|----------|-------|
| 6.1 | View billing page after at least one payment | Invoice table shows rows (not "No invoices yet") | ☐ |
| 6.2 | Invoice row shows invoice number | e.g. `INV-0001` | ☐ |
| 6.3 | Invoice row shows correct amount | £29.00 for Basic | ☐ |
| 6.4 | Invoice row shows "Paid" status badge (green) | Paid badge rendered | ☐ |
| 6.5 | PDF download link works | Clicking "PDF" opens the invoice in a new tab | ☐ |
| 6.6 | Multiple invoices | All historical invoices listed in reverse chronological order | ☐ |

---

## Section 7 — Subscription cancellation

| # | Test | Expected | Pass? |
|---|------|----------|-------|
| 7.1 | In Stripe Portal, cancel subscription (cancel at period end) | Portal confirms cancellation | ☐ |
| 7.2 | Return to app | Subscription status section shows "Cancels on [date]" | ☐ |
| 7.3 | Wait for period to end (or trigger `customer.subscription.deleted` webhook manually via Stripe CLI) | Plan reverts to "Free" | ☐ |
| 7.4 | DB updated | `organizations.plan = 'Free'` | ☐ |

---

## Section 8 — Error handling

| # | Test | Expected | Pass? |
|---|------|----------|-------|
| 8.1 | Disconnect network, click "Upgrade to Basic" | Error banner: "Network error" or similar | ☐ |
| 8.2 | Use declined card `4000 0000 0000 9995` in Checkout | Stripe Checkout shows card decline error (handled by Stripe, not our code) | ☐ |
| 8.3 | Use invalid JWT (edit cookie), open billing page | `get-billing-data` fails, error banner shown | ☐ |

---

## Section 9 — Webhook events (Stripe CLI)

Use the Stripe CLI to fire test events directly:

```bash
# Install CLI if needed: https://stripe.com/docs/stripe-cli
stripe login

# Listen and forward to your local Supabase (or use ngrok)
stripe listen --forward-to https://anhsumvnxmxosdjclfss.supabase.co/functions/v1/stripe-webhook

# Fire test events:
stripe trigger checkout.session.completed
stripe trigger customer.subscription.updated
stripe trigger customer.subscription.deleted
```

| # | Test | Expected | Pass? |
|---|------|----------|-------|
| 9.1 | `checkout.session.completed` event | DB: `plan` and `stripe_customer_id` updated | ☐ |
| 9.2 | `customer.subscription.updated` event | DB: `plan` updated to match new price | ☐ |
| 9.3 | `customer.subscription.deleted` event | DB: `plan` set to `'Free'` | ☐ |
| 9.4 | Event with unknown type | Webhook returns 200 (handled gracefully) | ☐ |
| 9.5 | Webhook with wrong signing secret | Returns 400 (signature invalid) | ☐ |

---

## Section 10 — Regression (existing features unaffected)

| # | Test | Expected | Pass? |
|---|------|----------|-------|
| 10.1 | Log in as non-Admin | No billing link in sidebar | ☐ |
| 10.2 | Plan limits still enforced | Free users still hit their ticket/user limits | ☐ |
| 10.3 | "Plans & Billing" modal still works for non-admins | Non-admins still see the PlansModal from the sidebar footer | ☐ |
| 10.4 | Admin can access all other views | Other views unaffected | ☐ |

---

## Sign-off

| Tester | Date | Environment | Result |
|--------|------|-------------|--------|
|        |      | Local / Staging / Prod | ☐ Pass / ☐ Fail |

Notes:
