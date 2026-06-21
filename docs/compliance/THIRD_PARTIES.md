# Third-Party Processors & Sub-Processors

**Last reviewed:** June 2026  
**Basis:** UK GDPR Art. 28 — processor obligations

## Sub-Processor Register

| Processor | Service | Data Processed | Location | Safeguard | DPA |
|---|---|---|---|---|---|
| Supabase Inc | Database, Auth, Edge Functions | All user & org data | EU-West (Ireland) | SCCs | Via Supabase ToS |
| Stripe Inc | Payment processing | Billing data, org name, email | EU / USA | SCCs | Via Stripe ToS |
| Google LLC | OAuth login, Google Workspace | Email, name (OAuth users) | USA | SCCs | Via Google ToS |
| Resend Inc | Transactional email | Email address, name | USA | SCCs | Via Resend ToS |

## Obligations When Using Sub-Processors

Under UK GDPR Art. 28, EurekaNow must:
- Use only processors providing sufficient guarantees of GDPR compliance
- Have a written contract with each processor
- Not engage new sub-processors without notifying customers (reasonable notice)
- Remain liable for the processor's compliance

## Customer Notification

If a new sub-processor is added, notify customers via:
1. In-app notification or email (reasonable notice — recommend 30 days)
2. Updated privacy policy on eurekanow.com/privacy
3. Updated version of this document

## Processor Obligations Passed Down

Our customer contracts (ToS) must state that:
- We are the data processor when processing customer's end-user data
- We use the sub-processors listed above
- Customers (as controllers) consent to these sub-processors
