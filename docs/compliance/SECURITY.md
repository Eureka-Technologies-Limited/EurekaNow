# Security Architecture & Controls

**Last reviewed:** June 2026  
**Framework references:** ISO 27001:2022, NCSC Cyber Essentials, OWASP Top 10

---

## 1. Infrastructure Security

| Control | Implementation | Status |
|---|---|---|
| Hosting provider | Supabase (SOC 2 Type II certified) | ✅ |
| Database encryption at rest | AES-256 (Supabase managed) | ✅ |
| Encryption in transit | TLS 1.2+ enforced on all endpoints | ✅ |
| DDoS protection | Cloudflare (via Supabase) | ✅ |
| Network isolation | Supabase project isolation | ✅ |
| Secret management | Supabase Vault (edge function secrets) | ✅ |

## 2. Application Security

| Control | Implementation | Status |
|---|---|---|
| Authentication | Supabase Auth (bcrypt passwords, JWT sessions) | ✅ |
| Authorisation | Role-based (Admin / End User) checked server-side | ✅ |
| Input validation | Client-side + server-side (edge functions) | Partial |
| SQL injection | Not possible — Supabase client uses parameterised queries | ✅ |
| XSS prevention | React DOM escaping by default | ✅ |
| CSRF protection | JWT auth (not cookie-based) — inherently CSRF-resistant | ✅ |
| Dependency scanning | npm audit / Dependabot (configure in GitHub) | Planned |
| SAST | Planned (ESLint security plugin) | Planned |

## 3. Stripe Payment Security

EurekaNow is **PCI DSS SAQ A** scope — card data never touches our servers.

- Payment UI is hosted by Stripe (Checkout / Portal)
- No card numbers, CVCs, or PANs are processed or stored by EurekaNow
- Stripe is PCI DSS Level 1 certified
- Webhook events are verified via `stripe-signature` HMAC header
- Stripe secret key is stored in Supabase Vault — never in frontend code or `.env` committed to git

See `PCI_DSS.md` for full scope reduction documentation.

## 4. Access Control

| Access Type | Control |
|---|---|
| Application roles | Admin / End User — enforced in AppShell and edge functions |
| Supabase dashboard | MFA required for all team members (enforce in Supabase settings) |
| Stripe dashboard | MFA required — configure in Stripe account settings |
| GitHub repository | Branch protection, required reviews |
| Production secrets | Supabase Vault only — never in `.env` files committed to git |

## 5. Secure Development Lifecycle

| Phase | Control | Status |
|---|---|---|
| Design | Threat modelling for new features | Informal — document process |
| Development | Code review required for all PRs | Planned — enforce via GitHub |
| Testing | Jest unit tests, integration tests | ✅ (see tests/ folder) |
| Deployment | CI/CD via GitHub Actions (planned) | Planned |
| Monitoring | Supabase edge function logs | ✅ |
| Incident response | See INCIDENT_RESPONSE.md | ✅ |

## 6. NCSC Cyber Essentials Checklist

Cyber Essentials is a UK government-backed certification scheme. Self-assessment:

| Control | Requirement | Status |
|---|---|---|
| Boundary firewalls | Network-level access controls | ✅ Supabase managed |
| Secure configuration | Default credentials changed, unnecessary services disabled | ✅ |
| User access control | Least privilege, admin accounts separate | ✅ role-based |
| Malware protection | Browser-based app — server-side managed by Supabase | N/A |
| Patch management | Supabase, Node.js, React kept up to date | Review monthly |
| Password policy | Min 8 chars, bcrypt hashing | ✅ |
| MFA | Planned for admin accounts | Planned |

**Recommendation:** Apply for Cyber Essentials certification (£300–500) — improves trust with enterprise customers and is required for some UK public sector contracts.

## 7. ISO 27001:2022 Alignment

EurekaNow is not yet ISO 27001 certified. Key domain alignment:

| Domain | Control Ref | Status |
|---|---|---|
| A.5 — Information security policies | Policy documented (this document) | Partial |
| A.6 — Organisation of security | Roles assigned informally | Formalise |
| A.8 — Asset management | Data inventory in GDPR.md | ✅ |
| A.9 — Access control | RBAC implemented | ✅ |
| A.10 — Cryptography | TLS, bcrypt, AES-256 | ✅ |
| A.12 — Operations security | Logging, change management | Partial |
| A.13 — Communications security | TLS everywhere | ✅ |
| A.14 — System acquisition/dev | Secure SDLC | Partial |
| A.16 — Incident management | See INCIDENT_RESPONSE.md | ✅ |
| A.18 — Compliance | GDPR, PCI, accessibility | ✅ |

## 8. Vulnerability Disclosure

A responsible disclosure policy should be published at `eurekanow.com/security.txt` before commercial launch. Template:

```
Contact: security@eurekanow.com
Preferred-Languages: en
Policy: https://eurekanow.com/security
```

## 9. Security Review Schedule

| Activity | Frequency | Owner |
|---|---|---|
| Dependency audit (`npm audit`) | Monthly | Lead developer |
| Access rights review | Quarterly | CTO |
| Penetration test | Annually (pre-launch + yearly) | External vendor |
| GDPR compliance review | Annually | Data controller |
| Supplier security review | Annually | CTO |
