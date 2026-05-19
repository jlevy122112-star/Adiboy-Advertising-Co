# Launch Checklist

Everything you must do before going live. Work top to bottom.

---

## 1. Database — run migrations

```bash
npm run db:migrate -w @home-link/marketer-api
```

This applies all pending SQL migrations including:
- `034_billing.sql` — adds `plan`, `stripe_customer_id`, `stripe_subscription_id`, `plan_expires_at` to `workspaces`

Run this against your **production** `DATABASE_URL` before starting any servers.

---

## 2. Environment variables

### Auth server (`AUTH_PORT` 8798)
| Variable | Required | Notes |
|---|---|---|
| `MARKETER_JWT_SECRET` | ✅ | **already have this** |
| `DATABASE_URL` | ✅ | `postgresql://...` |
| `MARKETER_AUTH_HTTP_CORS` | ✅ | `https://app.marketer-pro.com` |
| `AUTH_PORT` | optional | default 8798 |

### Billing server (`BILLING_PORT` 8806)
| Variable | Required | Notes |
|---|---|---|
| `STRIPE_SECRET_KEY` | ✅ | `sk_live_...` from Stripe dashboard |
| `STRIPE_WEBHOOK_SECRET` | ✅ | `whsec_...` from Stripe → Webhooks |
| `STRIPE_PRICE_PRO_MONTHLY` | ✅ | Stripe price ID, e.g. `price_1ABC...` |
| `STRIPE_PRICE_PRO_ANNUAL` | ✅ | Stripe price ID |
| `STRIPE_PRICE_ENT_MONTHLY` | ✅ | Stripe price ID |
| `STRIPE_PRICE_ENT_ANNUAL` | ✅ | Stripe price ID |
| `APP_URL` | ✅ | `https://app.marketer-pro.com` |
| `BILLING_CORS` | optional | defaults to `APP_URL` |
| `DATABASE_URL` | ✅ | same Postgres |
| `MARKETER_JWT_SECRET` | ✅ | **already have this** |
| `BILLING_PORT` | optional | default 8806 |

### Frontend (Vite — set in `.env.production`)
| Variable | Required | Notes |
|---|---|---|
| `VITE_AUTH_API_ORIGIN` | ✅ | `https://auth.marketer-pro.com` |
| `VITE_BILLING_API_ORIGIN` | ✅ | `https://billing.marketer-pro.com` |
| `VITE_TENANT_ID` | ✅ (SaaS mode) | your workspace tenant ID |
| `VITE_BRAND_API_ORIGIN` | optional | `https://brand.marketer-pro.com` |
| `VITE_SERP_API_ORIGIN` | optional | `https://serp.marketer-pro.com` |
| `VITE_AUTONOMOUS_API_ORIGIN` | optional | `https://autonomous.marketer-pro.com` |
| `VITE_PREDICTIVE_API_ORIGIN` | optional | `https://predictive.marketer-pro.com` |
| `VITE_SENTIMENT_API_ORIGIN` | optional | `https://sentiment.marketer-pro.com` |
| `VITE_STRIPE_PRICE_PRO_MONTHLY` | ✅ | same price ID as server |
| `VITE_STRIPE_PRICE_PRO_ANNUAL` | ✅ | same price ID as server |
| `VITE_STRIPE_PRICE_ENT_MONTHLY` | ✅ | same price ID as server |
| `VITE_STRIPE_PRICE_ENT_ANNUAL` | ✅ | same price ID as server |

---

## 3. DNS — point these subdomains to your servers

| Subdomain | Points to | Purpose |
|---|---|---|
| `app.marketer-pro.com` | frontend host / CDN | Main app |
| `auth.marketer-pro.com` | API server | Auth server port 8798 |
| `billing.marketer-pro.com` | API server | Billing server port 8806 |
| `brand.marketer-pro.com` | API server | Brand server (optional) |
| `serp.marketer-pro.com` | API server | SERP server (optional) |
| `autonomous.marketer-pro.com` | API server | Autonomous agent (optional) |
| `predictive.marketer-pro.com` | API server | Predictive schedule (optional) |
| `sentiment.marketer-pro.com` | API server | Sentiment server (optional) |

---

## 4. Stripe setup

1. Go to [dashboard.stripe.com](https://dashboard.stripe.com) → Products → Create 4 prices:
   - Pro Monthly: $39/mo recurring
   - Pro Annual: $348/yr recurring (= $29/mo)
   - Enterprise Monthly: $129/mo recurring
   - Enterprise Annual: $1,188/yr recurring (= $99/mo)
2. Copy each price ID (`price_...`) into env vars above.
3. Go to Stripe → Webhooks → Add endpoint:
   - URL: `https://billing.marketer-pro.com/billing/webhook`
   - Events to listen for:
     - `checkout.session.completed`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_failed`
4. Copy the webhook signing secret (`whsec_...`) → `STRIPE_WEBHOOK_SECRET`.
5. Enable the **Customer Portal** at Stripe → Customer Portal (Settings) — required for `POST /billing/portal` to work.

---

## 5. Start all servers

```bash
# In separate processes / PM2 / Docker containers:
npm run api:auth          # Auth — port 8798
npm run start:billing -w @home-link/marketer-api   # Billing — port 8806

# Plus any feature servers you've enabled:
npm run api:brand
npm run api:campaign
npm run api:scheduler
# etc.
```

---

## 6. Build and deploy frontend

```bash
cd apps/web
npm run build
# Deploy dist/ to your CDN / static host → app.marketer-pro.com
```

---

## 7. Store submission prerequisites

### All stores
- [ ] Privacy Policy publicly accessible at `https://app.marketer-pro.com/#/privacy`
- [ ] Terms of Service publicly accessible at `https://app.marketer-pro.com/#/terms`
- [ ] Support email `support@marketer-pro.com` is monitored
- [ ] App icon 1024×1024 PNG (no alpha for iOS)
- [ ] At least 2 screenshots per device size

### Apple App Store (iOS via Capacitor)
- [ ] Apple Developer account ($99/yr)
- [ ] App built with Capacitor: `npx cap add ios && npx cap sync`
- [ ] Xcode: set Bundle ID, version, signing certificate
- [ ] TestFlight build uploaded and tested
- [ ] App Privacy nutrition label filled in (collects: email, usage data)
- [ ] Age rating completed (likely 4+)

### Google Play (Android via Capacitor)
- [ ] Google Play Developer account ($25 one-time)
- [ ] App built: `npx cap add android && npx cap sync`
- [ ] Signed AAB (`./gradlew bundleRelease`)
- [ ] Data safety section filled in
- [ ] Target API level ≥ 34 (Android 14)

### Microsoft Store
- [ ] Microsoft Partner Center account (free)
- [ ] Capacitor Electron or PWA package
- [ ] Age rating via IARC questionnaire

### Amazon Appstore
- [ ] Amazon Developer account (free)
- [ ] Same signed APK/AAB as Google Play
- [ ] Content rating questionnaire

---

## 8. Post-launch

- [ ] Monitor Stripe webhook delivery (dashboard → Webhooks → Recent deliveries)
- [ ] Set up error alerting (Sentry or similar) on API servers
- [ ] Confirm `npm run db:migrate` ran cleanly (check `schema_migrations` table)
- [ ] Send yourself a test purchase end-to-end in Stripe test mode before switching to live keys
