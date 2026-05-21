# MISSING ACCOUNTS, API KEYS & CREDENTIALS
### Everything still needed before store launch
### Owner: Jacob Levy

---

## PRIORITY 1 — BLOCKS EVERYTHING (Get these first)

| # | What | Where to get it | Cost | Notes |
|---|------|----------------|------|-------|
| 1 | **Apple Developer Account** | developer.apple.com | $99/year | Takes 24–48h to verify. Start NOW. |
| 2 | **Google Play Console Account** | play.google.com/console | $25 one-time | Instant activation |
| 3 | **Microsoft Partner Center Account** | partner.microsoft.com | Free | For PWA submission |
| 4 | **PostgreSQL database** (prod) | Supabase.com (free tier) or Railway.app | Free–$5/mo | `DATABASE_URL` env var |
| 5 | **Redis** (prod) | Upstash.com (free tier) | Free | `REDIS_URL` env var |

---

## PRIORITY 2 — BLOCKS CORE FEATURES

### AI Generation (nothing generates without these)

| Key | Env Var | Where | Cost | What breaks without it |
|-----|---------|-------|------|----------------------|
| OpenAI API Key | `MARKETER_OPENAI_API_KEY` | platform.openai.com | Pay-per-use (~$0.01/req) | All AI generation returns stub templates. Campaign planner, brief generator, sentiment analysis all fake. |

### Authentication

| Key | Env Var | Where | Cost | Notes |
|-----|---------|-------|------|-------|
| JWT Secret | `MARKETER_JWT_SECRET` | Generate it yourself | Free | Any 64-char random string: `openssl rand -hex 32` |

### Email (password reset, invites, notifications)

| Key | Env Var | Where | Cost | What breaks without it |
|-----|---------|-------|------|----------------------|
| SMTP Host | `SMTP_HOST` | Resend.com or SendGrid (free tier) | Free | Password reset sends no email. Team invites never arrive. Notifications silent. |
| SMTP Port | `SMTP_PORT` | Same | Free | |
| SMTP User | `SMTP_USER` | Same | Free | |
| SMTP Password | `SMTP_PASS` | Same | Free | |
| SMTP From address | `SMTP_FROM` | Same | Free | e.g. `noreply@marketerpro.com` |

**Recommended:** Sign up at resend.com — free tier is 100 emails/day, 5 min setup.

---

## PRIORITY 3 — BLOCKS BILLING

| Key | Env Var | Where | Cost | Notes |
|-----|---------|-------|------|-------|
| Stripe Secret Key | `STRIPE_SECRET_KEY` | dashboard.stripe.com | Free to create | Goes live when you activate account |
| Stripe Webhook Secret | `STRIPE_WEBHOOK_SECRET` | Stripe dashboard → Webhooks | Free | Create webhook pointing to your API |
| Stripe Publishable Key | `VITE_STRIPE_PUBLISHABLE_KEY` | Stripe dashboard | Free | Frontend key, safe to expose |
| Stripe Price ID — Pro Monthly | `STRIPE_PRICE_PRO_MONTHLY` + `VITE_STRIPE_PRICE_PRO_MONTHLY` | Create product in Stripe | Free | e.g. $29/mo |
| Stripe Price ID — Pro Annual | `STRIPE_PRICE_PRO_ANNUAL` + `VITE_STRIPE_PRICE_PRO_ANNUAL` | Create product in Stripe | Free | e.g. $290/yr |
| Stripe Price ID — Ent Monthly | `STRIPE_PRICE_ENT_MONTHLY` + `VITE_STRIPE_PRICE_ENT_MONTHLY` | Create product in Stripe | Free | |
| Stripe Price ID — Ent Annual | `STRIPE_PRICE_ENT_ANNUAL` + `VITE_STRIPE_PRICE_ENT_ANNUAL` | Create product in Stripe | Free | |

**Steps:**
1. Go to stripe.com → create account
2. Dashboard → Products → Add Product → "Marketer Pro" → Add Price (recurring, monthly)
3. Copy price ID (starts with `price_`)
4. Repeat for annual, enterprise monthly, enterprise annual

---

## PRIORITY 4 — BLOCKS LIVE PUBLISHING

### Meta (Facebook + Instagram)

| Key | Env Var | Where | Cost | Notes |
|-----|---------|-------|------|-------|
| Meta App ID | `MARKETER_META_APP_ID` + `META_APP_ID` | developers.facebook.com | Free | Create a new app, type: Business |
| Meta App Secret | `MARKETER_META_APP_SECRET` + `META_APP_SECRET` | Same | Free | |
| Meta Redirect URI | `META_REDIRECT_URI` | Your own server | Free | e.g. `https://api.marketerpro.com/oauth/meta/callback` |
| Meta Page ID | `MARKETER_META_PAGE_ID` | Your Facebook Page | Free | The numeric ID of your FB Page |
| Instagram User ID | `MARKETER_INSTAGRAM_USER_ID` | Instagram Graph API | Free | Connected to the Facebook Page |

**Steps:** developers.facebook.com → My Apps → Create App → Business → Add "Instagram Graph API" and "Pages API" products.

### X (Twitter)

| Key | Env Var | Where | Cost | Notes |
|-----|---------|-------|------|-------|
| X Client ID | `MARKETER_X_CLIENT_ID` + `X_CLIENT_ID` | developer.twitter.com | Free (Basic tier) | Create app in Developer Portal |
| X Client Secret | `MARKETER_X_CLIENT_SECRET` + `X_CLIENT_SECRET` | Same | Free | |
| X Redirect URI | `X_REDIRECT_URI` | Your server | Free | |

**Steps:** developer.twitter.com → Create a project → Create an app → OAuth 2.0 settings → add callback URL.

### LinkedIn

| Key | Env Var | Where | Cost | Notes |
|-----|---------|-------|------|-------|
| LinkedIn Client ID | `MARKETER_LINKEDIN_CLIENT_ID` + `LINKEDIN_CLIENT_ID` | linkedin.com/developers | Free | Create app |
| LinkedIn Client Secret | `MARKETER_LINKEDIN_CLIENT_SECRET` + `LINKEDIN_CLIENT_SECRET` | Same | Free | |
| LinkedIn Redirect URI | `LINKEDIN_REDIRECT_URI` | Your server | Free | |
| LinkedIn Author URN | `MARKETER_LINKEDIN_AUTHOR_URN` | From OAuth response | Free | Format: `urn:li:person:XXXXXX` |

### YouTube

| Key | Env Var | Where | Cost | Notes |
|-----|---------|-------|------|-------|
| YouTube Client ID | `MARKETER_YOUTUBE_CLIENT_ID` + `YOUTUBE_CLIENT_ID` | console.cloud.google.com | Free | Enable YouTube Data API v3 |
| YouTube Client Secret | `MARKETER_YOUTUBE_CLIENT_SECRET` + `YOUTUBE_CLIENT_SECRET` | Same | Free | |
| YouTube Redirect URI | `YOUTUBE_REDIRECT_URI` | Your server | Free | |
| YouTube Channel ID | `MARKETER_YOUTUBE_CHANNEL_ID` | From OAuth | Free | |

**Steps:** console.cloud.google.com → New Project → Enable "YouTube Data API v3" → Create OAuth credentials.

### TikTok

| Key | Env Var | Where | Cost | Notes |
|-----|---------|-------|------|-------|
| TikTok Client Key | `TIKTOK_CLIENT_KEY` | developers.tiktok.com | Free | Apply for Content Posting API access |
| TikTok Client Secret | `TIKTOK_CLIENT_SECRET` | Same | Free | |
| TikTok Redirect URI | `TIKTOK_REDIRECT_URI` | Your server | Free | |

**Note:** TikTok Content Posting API requires app review. Submit early — can take 1–2 weeks.

### Pinterest

No OAuth keys extracted yet — check `apps/api/src/social/oauth/` for Pinterest provider.

---

## PRIORITY 5 — ENHANCES FUNCTIONALITY

### SERP Research

| Key | Env Var | Where | Cost | Notes |
|-----|---------|-------|------|-------|
| SerpAPI Key | `SERPAPI_KEY` | serpapi.com | $50/mo (100 searches free trial) | Without this, SERP returns fake hardcoded results |

### File Storage (images, media uploads)

| Key | Env Var | Where | Cost | Notes |
|-----|---------|-------|------|-------|
| AWS Access Key ID | `AWS_ACCESS_KEY_ID` | aws.amazon.com → IAM | Free account, pay per GB | For image/media storage |
| AWS Secret Access Key | `AWS_SECRET_ACCESS_KEY` | Same | | |
| AWS S3 Bucket | `AWS_S3_BUCKET` | Create in S3 console | ~$0.02/GB/mo | |
| AWS S3 Region | `AWS_S3_REGION` | e.g. `us-east-1` | | |

**Alternative:** Cloudflare R2 (free 10GB/mo, S3-compatible, just change endpoint).

---

## PRIORITY 6 — STORE-SPECIFIC ACCOUNTS

### App Store (Apple)

| Item | Where | Cost | Notes |
|------|-------|------|-------|
| Apple Developer Program | developer.apple.com | $99/year | ENROLL NOW — takes 48h |
| Bundle ID registered | developer.apple.com → Identifiers | Free | `com.marketerpro.app` |
| App Store Connect listing | appstoreconnect.apple.com | Free | Create app shell: name, category, age rating |
| TestFlight access | Same | Free | Set up before first build |
| Privacy Policy URL | Your own domain | Free | Must be a real live URL |
| Support URL | Your own domain | Free | |

### Google Play

| Item | Where | Cost | Notes |
|------|-------|------|-------|
| Google Play Console | play.google.com/console | $25 one-time | |
| App listing created | Same | Free | App name, category, content rating |
| Signing keystore | Generate locally | Free | `keytool -genkey` — BACK THIS UP, losing it locks you out forever |
| Privacy Policy URL | Your own domain | Free | Same URL as Apple |

### Microsoft Store

| Item | Where | Cost | Notes |
|------|-------|------|-------|
| Partner Center account | partner.microsoft.com | Free | |
| App listing created | Same | Free | |
| PWABuilder MSIX package | pwabuilder.com | Free | Generates from your live URL |

---

## DOMAIN & HOSTING (needed before store submission)

| Item | What it's for | Notes |
|------|--------------|-------|
| `marketerpro.com` domain | Privacy policy URL, API endpoint | Check if available. Alternatives: `getmarketerpro.com`, `marketer.pro` |
| Hosting for API | Production API servers | Railway.app or Fly.io — $5–20/mo |
| Hosting for web app | Production frontend | Vercel (free) or Cloudflare Pages (free) |
| Privacy Policy page | Required by all 3 stores | Already built in app at `#/privacy` — just needs a domain |
| Terms of Service page | Required by stores | Already built at `#/terms` |

---

## APP ASSETS STILL MISSING

| Asset | Spec | Notes |
|-------|------|-------|
| App icon 192×192 PNG | `apps/web/public/icons/icon-192.png` | Export from favicon.svg |
| App icon 512×512 PNG | `apps/web/public/icons/icon-512.png` | Export from favicon.svg |
| App icon 1024×1024 PNG | `apps/web/public/icons/icon-1024.png` | No rounded corners, opaque background |
| Apple touch icon | `apps/web/public/apple-touch-icon.png` | 180×180 PNG |
| App Store screenshots | `apps/web/public/screenshots/` | See SETUP.md for sizes per store |
| App preview video | Optional but strongly recommended | 15–30 sec screen recording |
| Feature graphic | Google Play only | 1024×500 PNG |

---

## SUMMARY — MINIMUM TO GO LIVE

These are the absolute minimum to submit to all three stores:

```
✅ Apple Developer Account ($99)
✅ Google Play Console ($25)
✅ Microsoft Partner Center (free)
✅ Domain name + basic hosting
✅ DATABASE_URL (Supabase free)
✅ REDIS_URL (Upstash free)
✅ MARKETER_JWT_SECRET (generate yourself)
✅ SMTP credentials (Resend free)
✅ STRIPE_SECRET_KEY + prices (Stripe free)
✅ MARKETER_OPENAI_API_KEY (pay-per-use)
✅ App icon PNGs (192, 512, 1024)
✅ At least 3 App Store screenshots per device size
✅ Privacy Policy live at a public URL
✅ Terms of Service live at a public URL
```

Everything else (social OAuth, SerpAPI, AWS) can be added post-launch.
