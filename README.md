# Marketer Pro - Office Edition

> Just like the Real World, But Digital.

Run your entire advertising & marketing campaign from one digital HQ.

---

## Mono-Repo Structure

```
Office-Edition/
├── package.json
├── tsconfig.json
├── pnpm-workspace.yaml
├── apps/
│   ├── backend/
│   │   ├── src/
│   │   │   ├── app.ts
│   │   │   ├── server.ts
│   │   │   ├── config/
│   │   │   │   ├── env.ts
│   │   │   │   └── db.ts
│   │   │   ├── common/
│   │   │   │   ├── types.ts
│   │   │   │   ├── errors.ts
│   │   │   │   ├── logger.ts
│   │   │   │   └── middleware/
│   │   │   │       ├── errorHandler.ts
│   │   │   │       ├── authGuard.ts
│   │   │   │       └── requestLogger.ts
│   │   │   ├── auth/
│   │   │   ├── users/
│   │   │   ├── brands/
│   │   │   ├── campaigns/
│   │   │   ├── content/
│   │   │   ├── calendar/
│   │   │   ├── analytics/
│   │   │   ├── integrations/
│   │   │   │   ├── meta/
│   │   │   │   ├── tiktok/
│   │   │   │   ├── linkedin/
│   │   │   │   └── googleads/
│   │   │   ├── progression/
│   │   │   ├── ppc/
│   │   │   ├── notifications/
│   │   │   └── jobs/
│   │   │       └── workers/
│   │   ├── prisma/
│   │   └── tests/
│   └── frontend/
│       └── src/
│           ├── pages/
│           │   ├── index.tsx
│           │   ├── login.tsx
│           │   ├── signup.tsx
│           │   ├── forgot-password.tsx
│           │   ├── reset-password.tsx
│           │   ├── onboarding/
│           │   ├── office/
│           │   ├── campaigns/
│           │   ├── analytics/
│           │   └── settings/
│           ├── components/
│           │   ├── auth/
│           │   ├── layout/
│           │   ├── office/
│           │   ├── calendar/
│           │   ├── campaigns/
│           │   ├── content/
│           │   ├── studios/
│           │   ├── analytics/
│           │   └── common/
│           ├── modules/
│           │   ├── auth/
│           │   ├── api/
│           │   ├── office/
│           │   ├── calendar/
│           │   ├── campaigns/
│           │   └── analytics/
│           ├── lib/
│           └── styles/
└── infra/
    ├── docker/
    ├── k8s/
    └── scripts/
```

---

## Tech Stack

- **Backend:** Node.js + Express + TypeScript
- **Frontend:** Next.js (React) + TypeScript
- **Database:** PostgreSQL via Supabase
- **Auth:** JWT + refresh tokens
- **Storage:** Supabase Storage

---

## Build Phases (from document)

### Phase 1 — Foundation
- Supabase schema + RLS
- Auth flows (login/signup)
- Basic OfficeScene with Desk only
- Calendar + tasks basic

### Phase 2 — Office & Campaigns
- WallPanel (campaign wall)
- BoardPanel (whiteboards)
- CampaignScene
- TaskScene

### Phase 3 — Studios & AI
- ContentForgeScene
- Instagram Studio
- ai-content, ai-tasks, ai-analytics Edge Functions

### Phase 4 — Analytics & Exports
- AnalyticsScene
- generate-report function
- Export flows

### Phase 5 — Polish & Stores
- Gestures tuned
- Animations refined
- Haptics wired
- App Store / Play Store submission

---

## Getting Started

```bash
# 1. Install dependencies
pnpm install

# 2. Set up environment variables
cp apps/backend/.env.example apps/backend/.env
cp apps/frontend/.env.example apps/frontend/.env.local

# 3. Create Supabase project at https://supabase.com
#    Run infra/scripts/migrate.sql in the Supabase SQL editor

# 4. Fill in your Supabase credentials in both .env files

# 5. Run development servers
pnpm dev
```

---

## API Surface

### Auth
- `POST /auth/signup`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `POST /auth/forgot-password`
- `POST /auth/reset-password`

### User / Brand
- `GET /me`
- `PATCH /me`
- `GET /brands`
- `POST /brands`
- `PATCH /brands/:id`

### Campaigns
- `GET /campaigns`
- `GET /campaigns/:id`
- `POST /campaigns`
- `PATCH /campaigns/:id`
- `DELETE /campaigns/:id`

### Content
- `GET /campaigns/:id/content`
- `POST /campaigns/:id/content`
- `GET /content/:id`
- `PATCH /content/:id`
- `POST /content/:id/schedule`

### Calendar
- `GET /calendar`
- `POST /calendar/drag`

### Analytics
- `GET /analytics/overview`
- `GET /analytics/campaigns`
- `GET /analytics/content`
- `GET /analytics/campaigns/:id`

### Integrations
- `GET /integrations`
- `POST /integrations/:provider/connect`
- `GET /integrations/:provider/status`

### Progression
- `GET /progression`
- `POST /progression/event`
