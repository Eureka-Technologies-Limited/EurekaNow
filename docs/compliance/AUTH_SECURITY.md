# Authentication Security Architecture

**Last reviewed:** June 2026  
**Status:** Implemented

---

## 1. Overview

EurekaNow uses **Supabase Auth** as the sole authentication provider. All passwords are hashed by Supabase using **bcrypt** — the application database never stores plaintext or weakly-hashed credentials.

## 2. Authentication Methods

| Method | Implementation | Session Type |
|---|---|---|
| Email + Password | `supabase.auth.signInWithPassword()` | JWT (1h) + refresh token |
| Google OAuth | `supabase.auth.signInWithOAuth({ provider: 'google' })` | JWT (1h) + refresh token |

## 3. Password Security

| Control | Standard | Implementation |
|---|---|---|
| Password hashing | bcrypt (cost factor 10+) | Supabase Auth — never in app DB |
| Minimum length | 8 characters | Enforced client + server side |
| Breach detection | Planned: HaveIBeenPwned API | Not yet implemented |
| Password reset | Supabase Auth magic link | `supabase.auth.resetPasswordForEmail()` |
| Account lockout | Supabase default (5 attempts) | Configured in Supabase dashboard |

## 4. Session Management

| Property | Value |
|---|---|
| Access token lifetime | 3600 seconds (1 hour) |
| Refresh token rotation | Enabled — old token invalidated on use |
| Token storage | Memory only — not localStorage |
| Logout | `supabase.auth.signOut()` — invalidates server session |
| Concurrent sessions | Allowed (per Supabase default) |

## 5. Email Confirmation

New self-registered accounts require email confirmation before access is granted. This:
- Verifies ownership of the email address
- Prevents account enumeration attacks via registration
- Satisfies UK GDPR requirement to verify identity

Admin-created accounts (added by workspace admins) are auto-confirmed — the admin vouches for the user's identity.

## 6. Admin User Creation

When an admin creates a team member with a password:
1. Client calls `admin-create-user` Supabase Edge Function
2. Edge function uses the **service role key** (server-side only) to call `supabase.auth.admin.createUser()`
3. Supabase hashes the password with bcrypt
4. The plaintext password is never stored, logged, or persisted

## 7. Legacy Account Migration

Any accounts created before the June 2026 auth migration (which stored passwords as plaintext in the `users` table) are migrated transparently on first login:

1. `signInWithPassword()` attempted — fails if no Supabase Auth account exists
2. Legacy plaintext password checked against `users.password` column
3. If match: `supabase.auth.signUp()` called to create Supabase Auth account
4. `users.password` immediately set to `NULL`
5. User is signed in with the new secure session

The `users.password` column will be dropped once the migration period is complete.

## 8. API & Edge Function Security

All Supabase Edge Functions verify the caller's JWT before processing:

```
Authorization: Bearer <supabase_access_token>
```

The anon key is **not accepted** for authenticated endpoints. All write operations additionally verify the caller is an admin of the target organisation.

## 9. Alignment with Standards

| Standard | Requirement | Status |
|---|---|---|
| NCSC Cyber Essentials | Strong password policy, MFA | Password ✅, MFA planned |
| OWASP ASVS L1 | Credential storage | ✅ bcrypt via Supabase Auth |
| OWASP ASVS L1 | Session management | ✅ rotating refresh tokens |
| ISO 27001 A.9 | Access control | ✅ role-based (Admin/End User) |
| UK GDPR Art. 32 | Appropriate technical security | ✅ encryption, hashing, TLS |

## 10. Planned Improvements

- [ ] Multi-factor authentication (TOTP) via Supabase Auth MFA
- [ ] HaveIBeenPwned password breach check on registration
- [ ] IP-based anomaly detection / rate limiting
- [ ] Audit log of all authentication events
- [ ] SSO / SAML for enterprise customers
