# UK GDPR & Data Protection Act 2018 — Compliance Record

**Document owner:** Eureka Technologies Limited  
**Last reviewed:** June 2026  
**Regulation:** UK GDPR (retained EU law), Data Protection Act 2018

---

## 1. Data Controller Information

| Field | Value |
|---|---|
| Organisation | Eureka Technologies Limited |
| ICO Registration | Required before commercial launch — apply at ico.org.uk |
| DPO | Not currently required (SME threshold); review at 250+ employees |
| Contact | privacy@eurekanow.com |

**Action required:** Register with the ICO before processing personal data commercially. Fee: £40–£60/year depending on size.

---

## 2. Personal Data Inventory (Record of Processing Activities)

### 2.1 End Users / Agents

| Data Element | Source | Purpose | Retention | Location |
|---|---|---|---|---|
| Full name | Registration form | Identity, display | Account lifetime + 30 days | Supabase (EU-West) |
| Email address | Registration form | Authentication, notifications | Account lifetime + 30 days | Supabase (EU-West) |
| Job title | Registration form | Display, routing | Account lifetime + 30 days | Supabase (EU-West) |
| Password hash | Supabase Auth | Authentication | Account lifetime + 30 days | Supabase Auth (EU) |
| Auth session tokens | Supabase Auth | Secure access | Session duration (1 hour) | Client + Supabase |
| IP address | Supabase logs | Security, fraud | 30 days | Supabase (EU-West) |
| Last login timestamp | Supabase Auth | Security audit | Account lifetime | Supabase (EU-West) |

### 2.2 Ticket Data

| Data Element | Source | Purpose | Retention | Location |
|---|---|---|---|---|
| Ticket content | Agent/user input | Service delivery | Organisation lifetime + 90 days | Supabase (EU-West) |
| Attachments (future) | File upload | Evidence / reference | Ticket lifetime + 90 days | TBD |
| Comments | Agent/user input | Collaboration | Ticket lifetime + 90 days | Supabase (EU-West) |

### 2.3 Billing & Payment

| Data Element | Source | Purpose | Retention | Location |
|---|---|---|---|---|
| Organisation name | Registration | Billing | Contract lifetime + 7 years | Supabase + Stripe |
| Billing email | Stripe | Invoicing | Contract lifetime + 7 years | Stripe (EU) |
| Payment method (card) | Stripe | Recurring billing | Card expiry | Stripe (never EurekaNow) |
| Invoice history | Stripe | Legal / tax obligation | 7 years (UK Companies Act) | Stripe |

---

## 3. Legal Basis for Processing

| Activity | Legal Basis | Article |
|---|---|---|
| Account registration | Contract | Art. 6(1)(b) |
| Service delivery | Contract | Art. 6(1)(b) |
| Email confirmation | Contract | Art. 6(1)(b) |
| Billing & invoicing | Legal obligation | Art. 6(1)(c) |
| Security logging | Legitimate interests | Art. 6(1)(f) |
| Marketing emails | Consent | Art. 6(1)(a) |
| Analytics | Legitimate interests | Art. 6(1)(f) |

---

## 4. Data Subject Rights

Under UK GDPR Chapter III, users have the following rights. All must be fulfilled within **30 calendar days**.

| Right | Mechanism | Status |
|---|---|---|
| Right of access (SAR) | Email to privacy@eurekanow.com | Manual process — document procedure |
| Right to rectification | Self-service in profile settings | Partially implemented |
| Right to erasure | Email request — admin deletes account | Manual process — implement self-service |
| Right to restriction | Email request | Manual process |
| Right to portability | CSV export (billing, tickets) | Partial — extend to all user data |
| Right to object | Email request | Manual process |
| Automated decision rights | N/A — no automated profiling | N/A |

**Action items:**
- [ ] Add "Delete my account" self-service option in user profile
- [ ] Build data export (JSON/CSV) covering all personal data
- [ ] Create privacy@eurekanow.com inbox with SLA tracking

---

## 5. Data Transfers

| Processor | Country | Safeguard | Data Transferred |
|---|---|---|---|
| Supabase (database + auth) | EU-West (Ireland) | EU adequacy / SCCs | All user & ticket data |
| Stripe (payments) | EU / USA | SCCs + Privacy Shield successor | Billing data only |
| Google (OAuth) | USA | SCCs | Email + name (OAuth users) |
| Vercel / Netlify (hosting) | USA | SCCs | No personal data stored |

No personal data is transferred to countries without an adequacy decision or appropriate safeguard.

---

## 6. Privacy by Design Controls

- **Password security:** All passwords hashed by Supabase Auth (bcrypt). Plaintext passwords are never stored in application database.
- **Data minimisation:** Only email, name, and job title collected at registration.
- **Email confirmation:** New accounts require email confirmation before access (verifies identity).
- **Session management:** Sessions expire after 1 hour idle; refresh tokens rotated.
- **Encryption in transit:** All data encrypted via TLS 1.2+ (enforced by Supabase and Stripe).
- **Encryption at rest:** Supabase encrypts data at rest (AES-256).

---

## 7. Consent Management

- Marketing emails: require explicit opt-in checkbox at registration (not yet implemented — **add before launch**).
- Analytics cookies: implement cookie consent banner before launch.
- Terms of Service and Privacy Policy must be published and linked from the login page.

---

## 8. Breach Notification

Under UK GDPR Article 33, a personal data breach that is likely to result in risk to individuals must be reported to the **ICO within 72 hours**.

| Step | Action | Owner |
|---|---|---|
| Detection | Security monitoring / user report | On-call engineer |
| Assessment | Determine scope, categories affected, number of records | CTO |
| ICO notification | Report via ico.org.uk/make-a-complaint within 72h if risk exists | DPO / CEO |
| User notification | Notify affected users if high risk (Art. 34) | CEO |
| Documentation | Record all breaches in breach register regardless of notification | CTO |

See `INCIDENT_RESPONSE.md` for the full procedure.

---

## 9. Supplier Due Diligence

All sub-processors must have adequate GDPR protections. Current status:

| Supplier | DPA Signed | SCCs | Review Date |
|---|---|---|---|
| Supabase | Via ToS | Yes | Annual |
| Stripe | Via ToS | Yes | Annual |
| Google Cloud | Via ToS | Yes | Annual |

---

## 10. Outstanding Actions Before Commercial Launch

- [ ] Register with ICO (ico.org.uk) — £40/year
- [ ] Publish Privacy Policy at eurekanow.com/privacy
- [ ] Publish Terms of Service at eurekanow.com/terms
- [ ] Add marketing consent checkbox to signup form
- [ ] Add cookie consent banner
- [ ] Implement account deletion (right to erasure)
- [ ] Implement full data export
- [ ] Create privacy@eurekanow.com and establish SAR response process
- [ ] Document breach register template
