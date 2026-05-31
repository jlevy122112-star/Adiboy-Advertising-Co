# Cookie Policy

**Effective date:** 1 January 2026
**Last updated:** 1 January 2026

---

## 1. Who We Are

This Cookie Policy is published by **Marketer Pro Office** ("we", "us", "our"). It explains how we use cookies and similar technologies in our mobile application and any associated web properties (collectively, "the Service").

For general privacy questions, please refer to our [Privacy Policy](./privacy-policy.md).

---

## 2. What Are Cookies and Similar Technologies

**Cookies** are small text files placed on your device by a website or application. They are widely used to make services work, improve performance, and provide information to the owners of the service.

In our mobile application, we use equivalent technologies including:

- **Local storage** — key-value data stored in the app's sandboxed storage on your device
- **Session tokens** — short-lived authentication tokens stored in secure, sandboxed app storage
- **Analytics identifiers** — anonymous, rotating identifiers used to aggregate usage data

We do **not** use third-party advertising cookies or cross-site tracking technologies.

---

## 3. What We Use and Why

### 3.1 Strictly Necessary

These technologies are required for the Service to function. They cannot be disabled.

| Technology | Purpose | Storage location | Duration |
|---|---|---|---|
| Session token | Authenticates your login session with our API | Secure app keychain (iOS) / EncryptedSharedPreferences (Android) | Until logout or token expiry (30 days) |
| `auth_refresh` token | Silently refreshes your session without requiring re-login | Secure app keychain | 90 days |
| `brand_id` | Remembers which brand workspace was last active | App local storage | Persistent until cleared |
| `onboarding_complete` | Prevents the onboarding flow from repeating | App local storage | Persistent |

### 3.2 Functional

These technologies improve your experience. They are enabled by default but can be cleared by logging out or clearing app data.

| Technology | Purpose | Storage location | Duration |
|---|---|---|---|
| `desk_layout_prefs` | Remembers your panel open/closed state on the Desk | App local storage | Persistent |
| `calendar_view_month` | Remembers the last month viewed in the Calendar Drawer | App local storage | Session |
| `artifact_vault_filter` | Remembers your last selected artifact filter | App local storage | Session |
| `theme_preference` | Stores your selected office cosmetic theme | App local storage | Persistent |

### 3.3 Analytics (Anonymous)

We collect anonymous, aggregated usage data to understand how the Service is used and to improve it. No data collected under this category is linked to your identity or shared with advertising networks.

| Technology | Purpose | Storage location | Duration |
|---|---|---|---|
| Anonymous session ID | Aggregates feature usage without identifying you personally | App memory only | Session (never persisted) |
| Feature interaction counts | Counts how often features are used (e.g. number of generations per session) | Our analytics backend | 90 days, then aggregated |

We do **not** use Google Analytics, Meta Pixel, or any advertising analytics SDK.

---

## 4. What We Do Not Use

We explicitly confirm we do **not** use:

- Third-party advertising cookies or SDKs
- Cross-app tracking identifiers (IDFA on iOS, AAID on Android)
- Social media tracking pixels
- Browser fingerprinting
- Behavioural profiling for advertising

---

## 5. Your Choices

### Clearing functional data
You can clear all functional local storage by going to **Settings → Account → Clear App Data** in the app, or by uninstalling and reinstalling the application.

### Revoking session tokens
You can invalidate all active session tokens by going to **Settings → Security → Sign Out All Devices**.

### Opting out of anonymous analytics
You can disable anonymous analytics at any time by going to **Settings → Privacy → Analytics** and toggling off "Share anonymous usage data".

---

## 6. Changes to This Policy

We may update this Cookie Policy from time to time. We will notify you of any material changes via an in-app notification at least 14 days before they take effect. The "Last updated" date at the top of this page will always reflect the most recent revision.

---

## 7. Contact

For questions about this Cookie Policy:

**Email:** privacy@marketerprooffice.com
**Address:** Available upon request
