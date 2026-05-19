# Complete Setup Guide

Step-by-step instructions for every service you need to go live.
Work through each section in order.

---

## Step 1 — Stripe Account & Products

### 1.1 Create your Stripe account
1. Go to [stripe.com](https://stripe.com) and click **Start now**
2. Enter your email, name, country, password
3. Verify your email
4. Fill in your business details (business name: Marketer Pro, business type: your choice)
5. Add your bank account so you can receive payouts

### 1.2 Create your 4 products & prices
1. In the Stripe dashboard, click **Product catalog** in the left sidebar
2. Click **+ Add product**
3. Create **Pro Monthly**:
   - Name: `Marketer Pro — Pro`
   - Click **Add a price**
   - Pricing model: Standard pricing
   - Price: `39.00` USD
   - Billing period: Monthly
   - Click **Save product**
   - Copy the price ID shown (starts with `price_`) — save it somewhere
4. On the same product, click **Add another price**:
   - Price: `348.00` USD
   - Billing period: Yearly
   - Click **Save**
   - Copy this price ID too
5. Click **+ Add product** again for **Enterprise**:
   - Name: `Marketer Pro — Enterprise`
   - Add price: `129.00` USD monthly → copy ID
   - Add another price: `1188.00` USD yearly → copy ID

You now have 4 price IDs. Keep them somewhere — you'll need them in `.env`.

### 1.3 Register your webhook endpoint
1. In Stripe dashboard → **Developers** → **Webhooks**
2. Click **+ Add endpoint**
3. Endpoint URL: `https://billing.marketer-pro.com/billing/webhook`
4. Click **Select events** and add these 4:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
5. Click **Add endpoint**
6. On the endpoint page, click **Reveal** under "Signing secret"
7. Copy the `whsec_...` value — this is your `STRIPE_WEBHOOK_SECRET`

### 1.4 Enable the Customer Portal
1. Stripe dashboard → **Settings** → **Billing** → **Customer portal**
2. Toggle it **on**
3. Configure what customers can do (recommended: cancel, update payment method)
4. Save

### 1.5 Get your secret key
1. Stripe dashboard → **Developers** → **API keys**
2. Copy the **Secret key** (`sk_live_...`)
3. Never share or commit this

---

## Step 2 — Hosting (API Servers)

You have 18+ Node.js servers. The easiest way to host them is **Railway**.

### 2.1 Create a Railway account
1. Go to [railway.app](https://railway.app) and sign up with GitHub
2. Click **New Project**

### 2.2 Deploy each server
For each server you need (start with Auth and Billing):

1. Click **Deploy from GitHub repo** → select your repo
2. Railway will detect it's a Node.js project
3. Set the **Start command** for Auth:
   ```
   npm run build -w @home-link/marketer-api && node apps/api/dist/auth-server.js
   ```
4. For Billing:
   ```
   npm run build -w @home-link/marketer-api && node apps/api/dist/billing-server.js
   ```
5. Go to **Settings** → **Networking** → **Generate Domain** — Railway gives you a public URL
6. Later you'll point your custom subdomain at this URL

Repeat for each server you want to run.

### 2.3 Add environment variables in Railway
For each deployed service:
1. Click on the service → **Variables** tab
2. Click **Raw Editor** and paste all your env vars (see Step 5 below)

---

## Step 3 — Redis (for BullMQ queue)

### Option A — Railway Redis (easiest)
1. In your Railway project, click **+ New**
2. Select **Database** → **Redis**
3. Railway creates it instantly
4. Click on the Redis service → **Connect** tab
5. Copy the `REDIS_URL` — add it to your API server env vars

### Option B — Upstash (free tier available)
1. Go to [upstash.com](https://upstash.com) → sign up
2. Create a Redis database, pick the region closest to your server
3. Copy the Redis URL from the dashboard

---

## Step 4 — Frontend Hosting (CDN)

### Option A — Vercel (recommended, free tier)
1. Go to [vercel.com](https://vercel.com) → sign up with GitHub
2. Click **Add New Project** → import your repo
3. Set **Root Directory** to `apps/web`
4. Set **Build Command** to `npm run build`
5. Set **Output Directory** to `dist`
6. Add environment variables (see Step 5)
7. Click **Deploy**
8. Vercel gives you a URL like `marketer-pro-web.vercel.app`

### Option B — Netlify
1. Go to [netlify.com](https://netlify.com) → sign up
2. Click **Add new site** → **Import from Git**
3. Base directory: `apps/web`
4. Build command: `npm run build`
5. Publish directory: `apps/web/dist`
6. Add env vars → Deploy

---

## Step 5 — Environment Files

### `apps/api/.env` (never commit this file)

```env
# Database
DATABASE_URL=postgresql://postgres:YourPassword@db.xxxx.supabase.co:5432/postgres?sslmode=require

# Auth
MARKETER_JWT_SECRET=your_existing_jwt_secret
MARKETER_AUTH_HTTP_CORS=https://app.marketer-pro.com

# Stripe
STRIPE_SECRET_KEY=sk_live_xxxxxxxxxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxx
STRIPE_PRICE_PRO_MONTHLY=price_xxxxxxxxxxxxxxxxxxxx
STRIPE_PRICE_PRO_ANNUAL=price_xxxxxxxxxxxxxxxxxxxx
STRIPE_PRICE_ENT_MONTHLY=price_xxxxxxxxxxxxxxxxxxxx
STRIPE_PRICE_ENT_ANNUAL=price_xxxxxxxxxxxxxxxxxxxx

# App
APP_URL=https://app.marketer-pro.com
BILLING_CORS=https://app.marketer-pro.com

# Redis
REDIS_URL=redis://default:xxxx@xxxx.railway.app:6379

# Ports (Railway sets PORT automatically, these are fallbacks)
AUTH_PORT=8798
BILLING_PORT=8806
```

### `apps/web/.env.production` (safe to commit — no secrets)

```env
VITE_AUTH_API_ORIGIN=https://auth.marketer-pro.com
VITE_BILLING_API_ORIGIN=https://billing.marketer-pro.com
VITE_BRAND_API_ORIGIN=https://brand.marketer-pro.com
VITE_SERP_API_ORIGIN=https://serp.marketer-pro.com
VITE_AUTONOMOUS_API_ORIGIN=https://autonomous.marketer-pro.com
VITE_PREDICTIVE_API_ORIGIN=https://predictive.marketer-pro.com
VITE_SENTIMENT_API_ORIGIN=https://sentiment.marketer-pro.com
VITE_TENANT_ID=your_tenant_uuid_here

VITE_STRIPE_PRICE_PRO_MONTHLY=price_xxxxxxxxxxxxxxxxxxxx
VITE_STRIPE_PRICE_PRO_ANNUAL=price_xxxxxxxxxxxxxxxxxxxx
VITE_STRIPE_PRICE_ENT_MONTHLY=price_xxxxxxxxxxxxxxxxxxxx
VITE_STRIPE_PRICE_ENT_ANNUAL=price_xxxxxxxxxxxxxxxxxxxx
```

### `apps/web/.env.local` (local dev — never commit)

```env
VITE_AUTH_API_ORIGIN=http://localhost:8798
VITE_BILLING_API_ORIGIN=http://localhost:8806
VITE_BRAND_API_ORIGIN=http://localhost:8800
VITE_SERP_API_ORIGIN=http://localhost:8801
VITE_AUTONOMOUS_API_ORIGIN=http://localhost:8805
VITE_PREDICTIVE_API_ORIGIN=http://localhost:8804
VITE_SENTIMENT_API_ORIGIN=http://localhost:8803
VITE_TENANT_ID=your_tenant_uuid_here

# Use TEST keys locally — never live keys
VITE_STRIPE_PRICE_PRO_MONTHLY=price_test_xxxx
VITE_STRIPE_PRICE_PRO_ANNUAL=price_test_xxxx
VITE_STRIPE_PRICE_ENT_MONTHLY=price_test_xxxx
VITE_STRIPE_PRICE_ENT_ANNUAL=price_test_xxxx
```

---

## Step 6 — DNS Setup

Your domain registrar is where you manage DNS (GoDaddy, Namecheap, Cloudflare, etc.).

1. Log in to your registrar
2. Find DNS settings for `marketer-pro.com`
3. Add a **CNAME record** for each subdomain pointing to your Railway/Vercel URL:

| Type | Name | Value |
|---|---|---|
| CNAME | `app` | `marketer-pro-web.vercel.app` |
| CNAME | `auth` | `your-auth-service.railway.app` |
| CNAME | `billing` | `your-billing-service.railway.app` |
| CNAME | `brand` | `your-brand-service.railway.app` |
| CNAME | `serp` | `your-serp-service.railway.app` |
| CNAME | `autonomous` | `your-autonomous-service.railway.app` |
| CNAME | `predictive` | `your-predictive-service.railway.app` |
| CNAME | `sentiment` | `your-sentiment-service.railway.app` |

4. In Vercel: **Project Settings** → **Domains** → add `app.marketer-pro.com`
5. In Railway: each service → **Settings** → **Networking** → **Custom Domain** → add the subdomain
6. SSL certificates are issued automatically by both Vercel and Railway

DNS propagation takes 5–30 minutes, sometimes up to 24 hours.

---

## Step 7 — Run the Database Migration

Once your server is running with `DATABASE_URL` set:

```bash
npm run db:migrate -w @home-link/marketer-api
```

Or if running it from Railway's shell / your local machine pointed at prod:

```bash
DATABASE_URL=postgresql://... npm run db:migrate -w @home-link/marketer-api
```

This must be run **once** before anyone can sign up or subscribe.

---

## Step 8 — SMTP (Transactional Email)

The app sends password reset and notification emails via nodemailer.

### Option A — Resend (recommended, generous free tier)
1. Go to [resend.com](https://resend.com) → sign up
2. Add and verify your domain (`marketer-pro.com`)
3. Get your API key
4. Add to `apps/api/.env`:
   ```env
   SMTP_HOST=smtp.resend.com
   SMTP_PORT=465
   SMTP_USER=resend
   SMTP_PASS=re_xxxxxxxxxxxxxxxxxxxx
   SMTP_FROM=noreply@marketer-pro.com
   ```

### Option B — SendGrid
1. Go to [sendgrid.com](https://sendgrid.com) → sign up (free up to 100/day)
2. Settings → API Keys → Create API Key
3. Add to env:
   ```env
   SMTP_HOST=smtp.sendgrid.net
   SMTP_PORT=587
   SMTP_USER=apikey
   SMTP_PASS=SG.xxxxxxxxxxxxxxxxxxxx
   SMTP_FROM=noreply@marketer-pro.com
   ```

---

## Step 9 — Test Everything Before Going Live

Run through this in order with **Stripe test keys** (`sk_test_...`):

1. Sign up for an account in the app
2. Verify you can log in
3. Click "Free plan" badge → Pricing page loads
4. Click "Start Pro" → redirects to Stripe Checkout (test mode)
5. Use Stripe test card `4242 4242 4242 4242`, any future date, any CVC
6. Complete checkout → lands back on `/#/pricing`
7. Refresh the app → plan badge should now show "Pro"
8. Verify Stripe dashboard shows the subscription
9. Verify Railway logs show webhook received successfully

Only switch to live keys after this works end-to-end.

---

## Step 10 — Go Live

1. Replace `sk_test_...` with `sk_live_...` in Railway env vars
2. Replace test price IDs with live price IDs
3. Update Stripe webhook to point at production URL (already done in Step 1.3)
4. Redeploy all services in Railway
5. Run `npm run db:migrate` one final time against production DB

You're live. 🚀
