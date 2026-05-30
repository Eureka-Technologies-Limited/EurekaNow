# EurekaNow — Packaging & Deployment Guide

This document covers how to build, run, and distribute EurekaNow across all supported platforms.

## Tech Stack Overview

| Layer    | Tool                        | Platforms             |
| -------- | --------------------------- | --------------------- |
| Frontend | React (CRA / react-scripts) | All                   |
| Desktop  | Tauri                       | macOS, Windows, Linux |
| Mobile   | Capacitor                   | iOS, Android          |

---

## Prerequisites

### All Platforms

- **Node.js** v18+ and npm
- **Rust** (required by Tauri)

Install Rust:

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source ~/.cargo/env
```

Verify:

```bash
rustc --version
```

### macOS (Desktop + iOS)

- **Xcode** (latest, from the App Store)
- **Xcode Command Line Tools:**

```bash
xcode-select --install
sudo xcode-select --switch /Applications/Xcode.app
```

- **CocoaPods** (required for iOS/Capacitor):

```bash
brew install ruby
echo 'export PATH="/opt/homebrew/opt/ruby/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
gem install cocoapods
```

### Android

- **Android Studio** — [developer.android.com/studio](https://developer.android.com/studio)
- During install, ensure the following are checked:
  - Android SDK
  - Android SDK Platform
  - Android Virtual Device (for emulator)

---

## Project Structure

```
EurekaNow/
├── src/                  # React source code
├── build/                # React production build output (CRA)
├── src-tauri/            # Tauri desktop config and Rust code
│   └── tauri.conf.json   # Tauri configuration
├── android/              # Capacitor Android project
├── ios/                  # Capacitor iOS project
├── capacitor.config.ts   # Capacitor configuration
└── package.json
```

---

## Local Development

### React only (browser)

```bash
npm start
```

### Desktop (Tauri dev window)

```bash
npx tauri dev
```

This starts the React dev server (`npm start`) and opens the app in a native Tauri window simultaneously.

---

## Building for Production

### Step 1 — Build the React app

Always run this first before any platform build or sync:

```bash
npm run build
```

Output goes to `build/`.

### Step 2 — Desktop (macOS / Windows / Linux)

```bash
npx tauri build
```

Output is placed in:

```
src-tauri/target/release/bundle/
├── macos/Eureka Now.app
├── dmg/Eureka Now_x.x.x_aarch64.dmg     # macOS installer
├── msi/                                   # Windows installer
└── deb/                                   # Linux package
```

### Step 3 — Mobile (iOS & Android)

Sync the React build to both mobile projects:

```bash
npx cap sync
```

Then open in the relevant IDE to run or archive (see platform sections below).

---

## iOS

### Open in Xcode

```bash
npx cap open ios
```

### Run on Simulator

1. Select a simulator (e.g. iPhone 15) from the device dropdown in Xcode
2. Hit ▶ **Run**

### Run on Physical Device

1. On your iPhone: **Settings → About Phone → tap Build Number 7 times** to enable Developer Mode
2. Enable **Settings → Developer Options → USB Debugging**
3. Plug in via USB
4. In Xcode go to **Signing & Capabilities → select your Team**
   - A free Apple ID works for sideloading
   - A paid Apple Developer account ($99/year) is required for App Store distribution
5. Select your device from the dropdown and hit ▶ **Run**

### CocoaPods issues

If Xcode throws dependency errors:

```bash
cd ios/App
pod install
cd ../..
npx cap open ios
```

---

## Android

### Open in Android Studio

```bash
npx cap open android
```

### Run on Emulator

1. In Android Studio open **Device Manager** (right panel)
2. Click **Create Device**, pick a phone model, download a system image
3. Hit ▶ **Run**

### Run on Physical Device

1. On your Android phone: **Settings → About Phone → tap Build Number 7 times**
2. **Settings → Developer Options → enable USB Debugging**
3. Plug in via USB
4. Select your device from the dropdown in Android Studio and hit ▶ **Run**

---

## Full Rebuild Workflow (all platforms)

Use this whenever you make code changes and want to update all platforms:

```bash
npm run build       # 1. Build React
npx cap sync        # 2. Sync to iOS and Android
npx tauri build     # 3. Build desktop app
```

For mobile, after `npx cap sync` open the respective IDE:

```bash
npx cap open ios      # then Run in Xcode
npx cap open android  # then Run in Android Studio
```

---

## Command Reference

| Command                | Description                                              |
| ---------------------- | -------------------------------------------------------- |
| `npm start`            | Start React dev server (browser)                         |
| `npm run build`        | Production build of React app                            |
| `npx tauri dev`        | Run app in Tauri desktop window (dev mode)               |
| `npx tauri build`      | Build desktop app (macOS .dmg, Windows .msi, Linux .deb) |
| `npx cap sync`         | Sync React build to iOS and Android projects             |
| `npx cap open ios`     | Open iOS project in Xcode                                |
| `npx cap open android` | Open Android project in Android Studio                   |

---

## Bundle Identifier

The app uses a consistent bundle ID across platforms:

| Platform  | Config file                 | Field               |
| --------- | --------------------------- | ------------------- |
| Tauri     | `src-tauri/tauri.conf.json` | `bundle.identifier` |
| Capacitor | `capacitor.config.ts`       | `appId`             |

Both should be set to the same value: `com.eurekatechnologies.eurekanow`

---

## Notes

- iOS builds **require a Mac** — Apple mandates Xcode for all iOS compilation
- Minimum iOS version supported: **iOS 16.0**
- The `build/` folder must exist before running `npx cap sync` or `npx tauri build` — always run `npm run build` first
- CRA uses `npm start` (not `npm run dev`) — this is reflected in `src-tauri/tauri.conf.json` under `beforeDevCommand`
