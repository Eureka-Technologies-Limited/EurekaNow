# EurekaNow — Auth Email Templates

Branded HTML email templates for Supabase Auth, delivered via **Resend** SMTP.

## Templates

| File | Supabase Template | Trigger |
|---|---|---|
| `confirm-signup.html` | Confirm signup | New user registers |
| `reset-password.html` | Reset password | User clicks "Forgot password" |
| `invite-user.html` | Magic Link | Admin invites team member |
| `change-email.html` | Change email address | User updates their email |

## Step 1 — Get Resend SMTP credentials

1. Sign in at [resend.com](https://resend.com)
2. Go to **Settings → SMTP** (or **API Keys**)
3. Create an API key with Send access
4. Note your credentials:
   - **Host:** `smtp.resend.com`
   - **Port:** `465` (TLS) or `587` (STARTTLS)
   - **Username:** `resend`
   - **Password:** your Resend API key (`re_xxxx...`)

## Step 2 — Configure Supabase SMTP

1. Go to your Supabase project → **Project Settings → Auth**
2. Scroll to **SMTP Settings**
3. Enable **Custom SMTP**
4. Enter:
   - **Host:** `smtp.resend.com`
   - **Port:** `465`
   - **Username:** `resend`
   - **Password:** your Resend API key
   - **Sender name:** `EurekaNow`
   - **Sender email:** `noreply@eurekanow.com` *(must be a verified domain in Resend)*
5. Save

## Step 3 — Verify your sending domain in Resend

1. In Resend → **Domains → Add domain**
2. Add `eurekanow.com`
3. Add the DNS records Resend shows you (SPF, DKIM, DMARC)
4. Wait for verification (usually under 10 minutes)

This is required for reliable delivery and avoids spam folders.

## Step 4 — Configure Supabase Auth email templates

1. Go to **Authentication → Email Templates**
2. For each template listed below, paste the corresponding HTML file contents:

| Supabase template | File to paste |
|---|---|
| Confirm signup | `confirm-signup.html` |
| Reset password | `reset-password.html` |
| Magic Link | `invite-user.html` |
| Change email address | `change-email.html` |

3. For the **Subject line**, use:
   - Confirm signup: `Confirm your EurekaNow account`
   - Reset password: `Reset your EurekaNow password`
   - Magic Link: `You've been invited to EurekaNow`
   - Change email: `Confirm your new email address — EurekaNow`

## Step 5 — Raise the email rate limit

Supabase free tier sends a maximum of **2 emails per hour** per user by default. Since you're using Resend (which has no such restriction), update this:

1. Go to **Authentication → Rate Limits**
2. Set **Email rate limit** to `10` (or higher as needed)

## Template Variables

All templates use Supabase's built-in Go template variables:

| Variable | Description |
|---|---|
| `{{ .ConfirmationURL }}` | The action link (confirm / reset / invite / change) |
| `{{ .Email }}` | The user's email address (used in change-email template) |
| `{{ .SiteURL }}` | Your site URL (set in Auth → URL Configuration) |
| `{{ .Token }}` | 6-digit OTP (if using OTP flow instead of link) |

## Updating the templates

To change branding colours, search for:
- `#F57A55` — orange accent
- `#0b1a30` — dark navy background
- `#1D3557` — card background
- `#B0BEC5` — secondary text

To change links in the footer, update `href="https://eurekanow.com/..."` throughout each template.
