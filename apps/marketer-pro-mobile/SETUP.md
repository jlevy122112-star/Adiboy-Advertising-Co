# Marketer Pro — Mobile Setup

## Prerequisites

- Node.js 18+
- For iOS: macOS + Xcode 15+ + Apple Developer account
- For Android: Android Studio + JDK 17+

## First-time setup

```bash
# From repo root
npm install --ignore-scripts

# Move into mobile workspace
cd apps/marketer-pro-mobile
npm install

# Add native platforms (run once)
npx cap add ios
npx cap add android

# Build web app and sync to native
npm run build:ios      # builds web + syncs to Xcode project
npm run build:android  # builds web + syncs to Android Studio project
```

## Daily workflow

```bash
# From repo root — build web + sync both platforms
npm run mobile:sync

# Open in Xcode (then run on simulator or device)
npm run mobile:open:ios

# Open in Android Studio (then run on emulator or device)
npm run mobile:open:android
```

## Bundle IDs

| Platform | Bundle ID |
|----------|-----------|
| iOS      | `com.marketerpro.app` |
| Android  | `com.marketerpro.app` |

## After `npx cap add ios`

Copy the keys from `ios-privacy.json` into `ios/App/App/Info.plist`.
Required for App Store submission — Apple rejects apps missing usage descriptions.

## After `npx cap add android`

Copy the permissions from `android-permissions.xml` into
`android/app/src/main/AndroidManifest.xml` inside the `<manifest>` tag.

## Microsoft Store

No Capacitor needed. Submit via PWABuilder:
1. Run `npm run build -w apps/web` from repo root
2. Go to pwabuilder.com and enter your deployed URL
3. Download the MSIX package and submit to Partner Center

## Web App Manifest

`apps/web/public/manifest.json` must exist for PWA compliance.
See `apps/web/public/` — add it if missing before Microsoft Store submission.
