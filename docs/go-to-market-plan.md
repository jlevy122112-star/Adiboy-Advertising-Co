# Go-To-Market Readiness Plan — Marketer Pro v1.0

---

## PHASE 1 — Security Lock Down

> Nothing ships until this is done. A single bad actor can read or write any user's data right now.

### Slice 1.1 — Wire JWT auth into every unprotected server

Every server below must replace the static bearer check with `requireAuth`, pulling `tenantId` from the verified JWT:

- `campaign-server.ts`
- `brand-profile-server.ts`
- `image-gen-server.ts`
- `video-gen-server.ts`
- `generation-draft-server.ts`
- `analytics-server.ts`
- `sentiment-server.ts`
- `autonomous-agent-server.ts`
- `team-server.ts`

### Slice 1.2 — Stop trusting client-supplied tenantId

Every route that reads `tenantId` from query params or request body must switch to `auth.tenantId` from the verified JWT.

Affects: campaign routes, brand profile routes, analytics routes, sentiment routes, team routes, autonomous routes, image-gen.

### Slice 1.3 — Auth bug fixes

- Fix refresh token endpoint — verify stored token belongs to the claiming user before issuing new tokens
- Fix password reset — create `verifyPasswordResetToken()` that validates type and token-bound expiry (OAuth state tokens currently valid forever)
- Requirement: a user cannot access another tenant's data
- Manual test: log in as Tenant A, change `tenantId` in a request — must be rejected

---

## PHASE 2 — Database & Build

> Get the backend fully running and migrated.

### Slice 2.1 — Run migrations

```
cd "C:\Users\Jacob N. Levy\Downloads\Marketer Pro v1.0"
npm run db:migrate
```

Applies all 13 migrations to Supabase.

### Slice 2.2 — Rebuild & restart

```
.\start-dev.ps1 -Rebuild
```

Recompiles TypeScript (`auth-route.ts` changed), restarts all 16 servers.

- Verify all server windows show green (no red dots)
- Test login end-to-end: sign up → log in → `/auth/me` returns user

**Checkpoint 2:** All 16 servers running. Login works. JWT returned. `/auth/me` works.

---

## PHASE 3 — App Store Requirements

> Apple and Google will reject the app without these.

### Slice 3.1 — Global error & toast system

- Build a shared `Toast` component (success / error / info)
- Build a shared `useApi` hook that wraps every fetch call — catches errors, shows toast, exposes loading state
- Wire into every panel (replaces all raw fetch calls)

### Slice 3.2 — Loading states

- Video generation — show step progress (Script → Rendering → Uploading)
- SERP brief analysis — show step progress
- Autonomous agent run — translate technical states to plain English with progress
- Analytics dashboard — skeleton loaders while fetching
- Predictive scheduling — show analysis steps

### Slice 3.3 — Confirmation dialogs

- Build shared `ConfirmModal` component
- Delete post → confirm
- Remove team member → confirm
- Disconnect social account → confirm
- Delete pin → confirm
- Account deletion → confirm + type "DELETE"
- Replace all `window.confirm()` calls with `ConfirmModal`

### Slice 3.4 — Empty states

- Campaign list — "No campaigns yet. Create one above."
- Analytics — "Publish content to start seeing metrics."
- Generation history — "No past generations. Create your first above."
- Calendar day view — "No posts planned. Tap + to add one."
- Viral dashboard — "Connect a social account to see viral metrics."

### Slice 3.5 — Mobile responsiveness

- Add responsive CSS breakpoints for screens < 768px
- All modals go full-width on mobile
- Minimum touch target size 44×44px on all buttons
- Minimum font size 16px on all forms/inputs (prevents iOS auto-zoom)
- Stack multi-column layouts vertically on mobile
- Calendar cells usable on small screens

### Slice 3.6 — Accessibility (App Store requirement)

- Add `aria-label` to all icon-only buttons
- Fix color contrast — all opacity text must meet WCAG AA (4.5:1 ratio)
- Add keyboard navigation to modals (trap focus, Escape to close)
- All images/icons get `alt` text or `aria-hidden`

---

_Phases 4+ to be added. See image plan shared 2026-05-18._
