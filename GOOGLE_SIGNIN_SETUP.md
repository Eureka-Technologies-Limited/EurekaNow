# Google Sign-In Setup Guide

This guide walks you through setting up Google OAuth 2.0 authentication for EureakNow.

## Prerequisites

- A Google Cloud account
- Your Supabase project URL and API keys already configured
- Access to Supabase dashboard

## Step 1: Enable Google OAuth in Supabase

1. Go to your **Supabase Dashboard**
2. Navigate to **Authentication** → **Providers**
3. Find **Google** in the list and click to expand
4. Toggle **Enable Google provider** ON
5. You'll see two fields:
   - **Client ID** (from Google Cloud Console)
   - **Client Secret** (from Google Cloud Console)
6. Leave these empty for now; we'll fill them after setting up Google Cloud

## Step 2: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click the project dropdown at the top
3. Click **NEW PROJECT**
4. Enter a project name (e.g., "EureakNow")
5. Click **CREATE**
6. Wait for the project to be created, then select it

## Step 3: Enable Google+ API

1. In Google Cloud Console, go to **APIs & Services** → **Library**
2. Search for **"Google+ API"**
3. Click on it and press **ENABLE**
4. Wait for it to enable (this may take a moment)

## Step 4: Create OAuth 2.0 Credentials

1. Go to **APIs & Services** → **Credentials**
2. Click **+ CREATE CREDENTIALS** → **OAuth client ID**
3. If prompted, click **Configure Consent Screen** first:
   - Select **External** user type
   - Click **CREATE**
   - Fill in the required fields:
     - **App name**: EureakNow
     - **User support email**: your-email@example.com
     - **Developer contact emails**: your-email@example.com
   - Click **SAVE AND CONTINUE**
   - Skip scopes, click **SAVE AND CONTINUE**
   - Skip optional info, click **SAVE AND CONTINUE**
   - Review and click **BACK TO DASHBOARD**

4. Now create credentials:
   - Go back to **Credentials**
   - Click **+ CREATE CREDENTIALS** → **OAuth client ID**
   - Select **Web application**
   - Name: "EureakNow Login"
   - Under **Authorized JavaScript origins**, click **ADD URI** and enter:
     ```
     https://anhsumvnxmxosdjclfss.supabase.co
     ```
   - Under **Authorized redirect URIs**, click **ADD URI** and enter:
     ```
     https://anhsumvnxmxosdjclfss.supabase.co/auth/v1/callback
     ```
   - Click **CREATE**

5. You'll see a popup with your credentials:
   - Copy the **Client ID**
   - Copy the **Client Secret**
   - Click **OK**

## Step 5: Add Credentials to Supabase

1. Go back to your **Supabase Dashboard**
2. Navigate to **Authentication** → **Providers** → **Google**
3. Paste your Google Cloud credentials:
   - **Client ID**: [paste from Google Cloud Console]
   - **Client Secret**: [paste from Google Cloud Console]
4. Click **Save**

## Step 6: Test Google Sign-In

1. Start your app: `npm start`
2. Go to the login page
3. Click **Sign in with Google**
4. You should be redirected to Google's login
5. After successful login, you should be redirected back to the app

## Troubleshooting

### "Redirect URI mismatch" error
- Make sure the redirect URI in Google Cloud Console exactly matches what's in Supabase
- For this project, use: `https://anhsumvnxmxosdjclfss.supabase.co/auth/v1/callback`

### User not found in database
- The app automatically creates a new user in the database when signing in with Google
- The user's name and email from Google are used

### OAuth session not persisting
- Check browser DevTools → Application → Cookies to ensure Supabase session cookie is saved
- Clear browser cache if issues persist

## Security Notes

- Never commit your `.env` file with real credentials
- The `REACT_APP_SUPABASE_ANON_KEY` is meant to be public (it's the anonymous key)
- Supabase handles token generation and session management securely

## Additional Resources

- [Supabase Google OAuth Documentation](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
