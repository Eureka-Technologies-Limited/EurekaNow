# EurekaNow — Code Signing & Certificates Guide

This document covers where to get, how to set up, and how to maintain code signing certificates across all platforms. Set this up once and every future project slots straight in.

---

## Overview

| Platform    | Provider                                      | Cost                   | Expires                             |
| ----------- | --------------------------------------------- | ---------------------- | ----------------------------------- |
| macOS + iOS | Apple Developer Program                       | $99/year               | Certs yearly, profiles tied to cert |
| Windows     | DigiCert / Sectigo or Azure Trusted Signing   | $200–400/yr or ~$10/mo | 1–3 years                           |
| Android     | Self-generated keystore + Google Play Console | $25 one-time           | ~10,000 days (effectively never)    |

---

## Apple — macOS & iOS

One account covers both platforms.

### Sign Up

- [developer.apple.com](https://developer.apple.com) — $99/year
- Sign in with your Apple ID and enrol as an individual or organisation

### Certificates You Need

| Certificate              | Used For                                          |
| ------------------------ | ------------------------------------------------- |
| Developer ID Application | Distributing macOS apps **outside** the App Store |
| Apple Distribution       | App Store submissions (iOS and macOS)             |
| Apple Development        | Local dev and device testing                      |

### How to Generate

1. Open **Xcode → Settings → Accounts**
2. Sign in with your Apple ID
3. Select your team and click **Manage Certificates**
4. Hit **+** to create the cert types you need — Xcode handles the CSR and installation automatically

### Provisioning Profiles

- Profiles tie a **bundle ID** to a **certificate**
- Each app (bundle ID) needs its own profile
- The same certificate covers all your apps
- Manage at [developer.apple.com/account/resources/profiles](https://developer.apple.com/account/resources/profiles)
- Xcode can manage these automatically if you enable **Automatically manage signing** in **Signing & Capabilities**

### Backups

Export your certificate from Keychain Access as a `.p12` file and store it securely:

1. Open **Keychain Access** on your Mac
2. Find your certificate under **My Certificates**
3. Right-click → **Export** → save as `.p12` with a strong password
4. Store the `.p12` and password in your password manager

### Renewal

- Certificates expire after **1 year**
- Xcode will prompt you when renewal is needed
- Provisioning profiles automatically update when you renew the cert

---

## Windows

### Option A — Azure Trusted Signing (Recommended, Modern)

- ~$10/month via Microsoft Azure
- No hardware token required
- Works natively with Tauri's build pipeline
- Sign up at [azure.microsoft.com](https://azure.microsoft.com) and search **Trusted Signing**

### Option B — Traditional Code Signing Certificate

- Purchased from a Certificate Authority (CA):
  - [DigiCert](https://www.digicert.com) — industry standard
  - [Sectigo](https://sectigo.com) — cheaper alternative
  - [GlobalSign](https://www.globalsign.com)
- Cost: ~$200–400/year
- You receive a `.pfx` file with a password

### Adding to Tauri

In `src-tauri/tauri.conf.json`:

```json
"bundle": {
  "windows": {
    "certificateThumbprint": "YOUR_CERT_THUMBPRINT",
    "digestAlgorithm": "sha256",
    "timestampUrl": "http://timestamp.digicert.com"
  }
}
```

### Backups

- Store your `.pfx` file and its password in your password manager
- **Never commit `.pfx` files to git**

---

## Android

Google does not issue certificates — you generate your own keystore file.

### Generate a Keystore

Run once per app:

```bash
keytool -genkey -v -keystore eurekanow.jks \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -alias eurekanow
```

You'll be prompted for a password and some organisation details. The output is a `.jks` file.

### Google Play Console

- One-time $25 registration at [play.google.com/console](https://play.google.com/console)
- Covers all apps you publish under that account

### Google Play App Signing (Recommended)

Let Google manage your distribution signing key:

1. In Play Console go to **Setup → App Signing**
2. Upload your keystore — Google stores it securely
3. You keep a local **upload key** to submit builds
4. If your upload key is ever compromised, Google can replace it — your app listing is safe

### Backups

- Back up your `.jks` file and password in **multiple places**
- If you lose your keystore and are not using Google Play App Signing, you **cannot update your app on the Play Store — ever**
- Treat it like a password to a bank account

---

## Managing Across Multiple Projects

### Apple

- **One account, one certificate, many apps**
- Create a new **provisioning profile** for each new bundle ID
- No need for a new cert per project

### Windows

- **One certificate, many apps**
- The same `.pfx` signs every Windows app you build

### Android

- **One keystore per app** — do not reuse keystores across different apps
- Name them clearly: `projectname.jks`

---

## Secure Storage

Store all of the following in a password manager (e.g. 1Password, Bitwarden):

- Apple `.p12` export + password
- Apple Team ID (found at developer.apple.com/account)
- Windows `.pfx` + password
- Android `.jks` files + passwords + key aliases
- Any provisioning profile UUIDs

---

## CI/CD (GitHub Actions)

Never store certificate files in your repository. Use GitHub Secrets instead:

### General approach

1. Base64-encode your cert file:

```bash
base64 -i eurekanow.jks | pbcopy   # copies to clipboard on macOS
```

2. Add the base64 string as a secret in **GitHub → Repo Settings → Secrets and Variables → Actions**
3. In your workflow, decode it back to a file:

```yaml
- name: Decode keystore
  run: echo "${{ secrets.ANDROID_KEYSTORE }}" | base64 --decode > eurekanow.jks
```

### Secrets to store per platform

**Apple:**

- `APPLE_CERTIFICATE` — base64 `.p12`
- `APPLE_CERTIFICATE_PASSWORD`
- `APPLE_TEAM_ID`
- `APPLE_PROVISIONING_PROFILE` — base64 `.mobileprovision`

**Windows:**

- `WINDOWS_CERTIFICATE` — base64 `.pfx`
- `WINDOWS_CERTIFICATE_PASSWORD`

**Android:**

- `ANDROID_KEYSTORE` — base64 `.jks`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

---

## Renewal Checklist

Run through this annually (set a calendar reminder):

- [ ] Renew Apple Developer Program membership ($99)
- [ ] Check Apple certificate expiry in Keychain Access — renew if within 30 days
- [ ] Update provisioning profiles after cert renewal
- [ ] Check Windows cert expiry — renew with your CA
- [ ] Verify Android keystore backups are still accessible
- [ ] Confirm all secrets in GitHub Actions / CI are still valid
