# Data Retention Policy

**Last reviewed:** June 2026  
**Regulation:** UK GDPR Art. 5(1)(e) — storage limitation

## Retention Schedule

| Data Category | Retention Period | Basis | Deletion Method |
|---|---|---|---|
| User account data | Account lifetime + 30 days post-deletion | Contract | Supabase DB delete |
| Auth credentials (hashes) | Account lifetime + 30 days | Contract | Supabase Auth purge |
| Support ticket content | Organisation subscription + 90 days | Contract | DB cascade delete |
| Ticket comments | Ticket lifetime + 90 days | Contract | DB cascade delete |
| Audit/security logs | 12 months | Legitimate interests | Supabase log rotation |
| Billing records / invoices | 7 years from invoice date | Legal (UK Companies Act / HMRC) | Stripe + manual |
| Stripe customer data | 7 years from last transaction | Legal | Stripe data export + delete |
| Marketing consent records | Duration of consent + 3 years | Legal (enforcement) | Manual |
| Session tokens | 1 hour (auto-expiry) | Technical necessity | Auto-expired by Supabase |
| IP address logs | 30 days | Legitimate interests | Supabase auto-rotation |

## Deletion Procedures

### Account Deletion (user request)
1. Remove user from `auth.users` (Supabase Auth dashboard)
2. Delete or anonymise row in `public.users`
3. Remove user from all team memberships
4. Retain billing records in Stripe for 7 years (legal obligation)

### Organisation Deletion (subscription cancelled)
1. Export billing records for retention
2. Delete `organizations`, `teams`, `tickets`, `users` cascade
3. Remove Stripe customer after 7-year billing retention expires

### Automated Deletion (to implement)
- Build a scheduled function to purge deleted-user records 30 days after `deleted_at`
- Build a scheduled function to purge ticket data 90 days after org cancellation

## Right to Erasure Exceptions

The following data cannot be deleted before its retention period, even on request:
- Billing records required for tax/audit (7 years)
- Records required for active legal proceedings
- Data required to prevent fraud or protect legitimate interests
