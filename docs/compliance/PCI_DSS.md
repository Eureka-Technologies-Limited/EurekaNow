# PCI DSS v4.0 — Scope Reduction Record

**Applicable standard:** PCI DSS v4.0  
**SAQ type:** SAQ A (Card-not-present, fully outsourced)  
**Last reviewed:** June 2026

---

## 1. Scope Summary

EurekaNow **does not** process, store, or transmit cardholder data (CHD) or sensitive authentication data (SAD). All payment functionality is fully outsourced to Stripe, a PCI DSS Level 1 certified service provider.

**EurekaNow's PCI DSS scope is SAQ A — the lowest possible scope.**

---

## 2. How Payments Work

```
User browser → Stripe Hosted Checkout (stripe.com domain)
                        ↓
              Stripe processes card & subscription
                        ↓
              Stripe webhook → EurekaNow edge function
              (only subscription status — no card data)
```

At no point does cardholder data pass through, or be stored by, EurekaNow infrastructure.

---

## 3. Controls in Place

| PCI DSS Requirement | Control | Status |
|---|---|---|
| Req 1 — Network security | Supabase managed firewall | ✅ |
| Req 2 — Secure config | Default credentials changed; unnecessary services off | ✅ |
| Req 3 — Protect stored data | No CHD stored — N/A | ✅ |
| Req 4 — Encrypt in transit | TLS 1.2+ on all endpoints | ✅ |
| Req 5 — Anti-malware | Server-side managed by Supabase/Cloudflare | ✅ |
| Req 6 — Secure development | OWASP practices; no CHD in code | ✅ |
| Req 7 — Access control | RBAC; principle of least privilege | ✅ |
| Req 8 — Identify users | Supabase Auth; unique user IDs | ✅ |
| Req 9 — Physical security | Cloud provider (Supabase/AWS) — N/A for us | ✅ |
| Req 10 — Logging | Supabase edge function logs | ✅ |
| Req 11 — Security testing | Planned pen test | Planned |
| Req 12 — Security policy | This document + SECURITY.md | ✅ |

---

## 4. Stripe Secret Key Security

The Stripe secret key (`sk_live_...`) is:
- Stored in **Supabase Vault** (secrets management) only
- Never committed to source code or `.env` files in git
- Never exposed to the browser / client-side code
- Used only by server-side edge functions
- Rotatable at any time from Stripe Dashboard → API Keys

---

## 5. Webhook Security

Stripe webhook events are verified using the `stripe-signature` HMAC header:
```typescript
event = await stripe.webhooks.constructEventAsync(body, sig, STRIPE_WEBHOOK_SECRET);
```
The webhook secret (`whsec_...`) is stored in Supabase Vault. Any request without a valid signature is rejected with HTTP 400.

---

## 6. Annual Attestation

SAQ A requires annual self-attestation. Complete and retain a copy of the Stripe-provided SAQ A form each year. Stripe's partner portal can assist with this.
