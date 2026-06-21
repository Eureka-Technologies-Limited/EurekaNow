# Security Incident Response Plan

**Last reviewed:** June 2026

## 1. Classification

| Severity | Description | Response Time |
|---|---|---|
| P1 — Critical | Active breach, data exfiltration, service down | < 1 hour |
| P2 — High | Suspected breach, auth compromise, ransomware | < 4 hours |
| P3 — Medium | Suspicious activity, policy violation | < 24 hours |
| P4 — Low | Minor anomaly, failed pen test finding | < 72 hours |

## 2. Response Steps

### Detect → Contain → Assess → Notify → Recover → Review

**1. Detect**
Sources: Supabase logs, user reports, monitoring alerts, third-party notifications.

**2. Contain (immediate)**
- Revoke compromised API keys in Supabase Vault / Stripe Dashboard
- Disable compromised user accounts in Supabase Auth dashboard
- Enable Supabase Row Level Security restrictions if needed
- Take edge functions offline if actively exploited

**3. Assess**
- What data was accessed? (categories, number of records, time window)
- Is the attacker still active?
- Are other systems affected?

**4. Notify**
- ICO within 72 hours if risk to individuals exists (ico.org.uk/make-a-complaint)
- Affected users if high risk (UK GDPR Art. 34)
- Stripe if payment systems involved: stripe.com/contact

**5. Recover**
- Rotate all secrets (Stripe keys, JWT secret, webhook secret)
- Re-deploy edge functions with new secrets
- Force sign-out all active sessions: Supabase Auth → Users → Sign out all
- Confirm no backdoors remain

**6. Review (post-incident)**
- Root cause analysis within 7 days
- Update controls to prevent recurrence
- Document in breach register

## 3. Contact List

| Role | Contact |
|---|---|
| CTO / Lead Developer | Internal — to be documented |
| ICO (reporting) | ico.org.uk / 0303 123 1113 |
| Supabase support | supabase.com/support |
| Stripe support | dashboard.stripe.com → Help |

## 4. Breach Register Template

| Date | Description | Severity | Records Affected | ICO Notified | Users Notified | RCA Complete |
|---|---|---|---|---|---|---|
| | | | | | | |
