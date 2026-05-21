# 🚀 STORE LAUNCH — THE ONLY GOAL

> **App Store · Google Play · Microsoft Store**
> Everything else is secondary. Ship to stores first.

---

## TOP 3 THINGS. IN ORDER. DO NOT SKIP.

---

## #1 — FINISH THE CAPACITOR BUILD

**This is the blocker. Nothing else matters until this ships.**

The web app (React/Vite) must be wrapped in a native shell via Capacitor
so it can compile to iOS `.ipa` and Android `.aab`. Capacitor-readiness
was started (`apps/marketer-pro-mobile` mentioned in eslint ignore) but is
not complete.

**What needs to happen:**
- `apps/marketer-pro-mobile/` — fully configured Capacitor project
- `npx cap add ios` + `npx cap add android` wired to the Vite build output
- `npx cap sync` producing a working Xcode project and Android Studio project
- Both build without errors on their respective platforms
- Microsoft Store: publish as a **PWA** via Partner Center (no Capacitor needed — the web app qualifies directly once HTTPS + manifest are solid)

**Done when:** You can open the app on a real iPhone and a real Android device.

---

## #2 — OPEN THREE DEVELOPER ACCOUNTS TODAY

**None of these can be skipped. All three cost money or time to verify.**

| Store | Account | Cost | URL |
|---|---|---|---|
| Apple App Store | Apple Developer Program | $99 / year | developer.apple.com |
| Google Play | Google Play Console | $25 one-time | play.google.com/console |
| Microsoft Store | Microsoft Partner Center | Free (individual) | partner.microsoft.com |

**Apple specifically:** enrollment takes 24–48 hours for verification.
Start it NOW, not after the build is done.

**What needs to happen:**
- Enroll in all three under the business entity (not a personal account)
- Create the app listing shells in each console (name, bundle ID, package name)
- Apple bundle ID: `com.marketer-pro.app` (or equivalent — lock this in, it cannot change)
- Google package name: `com.marketer_pro.app`

---

## #3 — HIT EVERY MANDATORY STORE REQUIREMENT

**Each store will reject you without these. No exceptions.**

### All Three Stores Require:
- ✅ **Privacy Policy** — hosted at a public URL, covers data collection, AI use, social OAuth
- ✅ **Terms of Service** — hosted at a public URL
- ✅ **App icon** — 1024×1024 px, no rounded corners (stores apply their own masking)
- ✅ **Screenshots** — multiple device sizes per store (they are strict about this)
- ✅ **Age rating** — fill out the questionnaire (this app = 4+ / Everyone)

### Apple-Specific (hardest):
- ✅ **App Review Guidelines compliance** — social login must use "Sign in with Apple" if any other OAuth is offered
- ✅ **In-App Purchase** — if subscriptions are purchased inside the iOS app, Apple takes 30% and requires StoreKit. **Option:** lock purchasing to web only, app = free download, upsell to web. This sidesteps the 30% cut entirely.
- ✅ **Privacy Nutrition Label** — declare every data type collected (email, usage data, social tokens, etc.)
- ✅ **NSAppTransportSecurity** — all API calls must be HTTPS

### Google-Specific:
- ✅ **Data Safety form** — equivalent of Apple's nutrition label
- ✅ **Target API level** — must target Android 14+ (API 34+) for new apps in 2025
- ✅ **64-bit support** — Capacitor handles this automatically

### Microsoft-Specific (easiest path):
- ✅ **PWA submission** — submit the web app URL directly via PWABuilder (pwabuilder.com)
- ✅ **Web App Manifest** — `manifest.json` with name, icons, `start_url`, `display: standalone`
- ✅ **Service Worker** — required for PWA certification; handles offline state

---

## THE ORDER IS NON-NEGOTIABLE

```
Week 1:  Open all 3 developer accounts. Start Capacitor setup.
Week 2:  Capacitor iOS + Android builds working on real devices.
Week 3:  Privacy Policy + ToS live. App icons + screenshots done.
Week 4:  Submit all three stores for review.
```

Apple review: 1–3 days average.
Google review: 1–7 days average.
Microsoft review: 1–3 days average.

---

## WHAT WE ARE NOT DOING UNTIL WE ARE IN ALL THREE STORES

- No new features
- No refactoring
- No new phases from `docs/full-build-plan.md`
- No performance work
- No analytics dashboards

**Ship. Then build.**
