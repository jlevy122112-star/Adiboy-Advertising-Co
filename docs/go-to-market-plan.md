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

**Checkpoint 3:** Run the app on a real phone. Every action shows a response. No blank screens in production. No crashes on tap.

---

## PHASE 4 — Production Config

> Nothing works in production until env vars point at real services.

### Slice 4.1 — Backend env vars

- Set production `DATABASE_URL` (currently pointing to Supabase dev)
- Set production `MARKETER_JWT_SECRET` — rotate to a new strong secret (min 32 chars)
- Set `MARKETER_FRONTEND_URL` to actual domain
- Update all `MARKETER_*_HTTP_CORS` to production frontend domain

### Slice 4.2 — Frontend env vars

- Update all `VITE_*_API_ORIGIN` variables to production server URLs
- Set `VITE_PUBLIC_URL` to production domain
- Remove dev-server token from `VITE_TENANT_ID` — production tenants come from auth

### Slice 4.3 — Register social API apps

- Register app with Meta (Facebook + Instagram) — get `META_APP_ID` / `META_APP_SECRET`
- Register app on X (Twitter) API — get `X_CLIENT_ID` / `X_CLIENT_SECRET`
- Get `LINKEDIN_CLIENT_ID` / `LINKEDIN_CLIENT_SECRET`
- Register app on YouTube (Google) API — get `YOUTUBE_CLIENT_ID` / `YOUTUBE_CLIENT_SECRET`
- Set `MARKETER_*_REDIRECT_URI` to the OAuth redirect URI in each platform's developer console

### Slice 4.4 — Email / password reset

- Configure SMTP provider (SendGrid, Resend, or AWS SES)
- Wire SMTP credentials to `auth-route.ts` password reset handler (currently logs only)

**Checkpoint 4:** Deploy to production server. Tap sign up with a real email. Reset password — email arrives. Connect a real social account.

---

## PHASE 5 — Pre-Launch Polish

> The difference between a 1-star and 5-star first impression.

### Slice 5.1 — UX fixes

- Add "Retry" button to every error state
- Show "Last updated X minutes ago" timestamps on analytics/sentiment data
- Fix mislabeled/confusing strings in SERP panel and social connections
- UI field validation on forms/inputs (don't wait for submit)

### Slice 5.2 — Auth UX

- Live field validation on login/signup forms (don't wait for server)
- Password strength meter on signup
- Branded loading screen on auth (replace bare spinner)
- Clear "session expired" message when token refresh fails

### Slice 5.3 — Final QA pass

- Test all 16 servers start from a fresh shell
- Test login → create campaign → schedule post → publish end-to-end
- Test on iPhone and Android
- Test with slow network (Chrome DevTools throttling)
- Verify no console errors during normal usage

**Checkpoint 5:** Full demo walkthrough with no rough edges. Ready for app store submission.

---

## PHASE 6 — Submission

### Slice 6.1 — App Store assets

- App icon (1024×1024px)
- Screenshots for every required device size
- App description and keywords
- Privacy policy URL
- Terms of service URL

### Slice 6.2 — Google Play submission

- Create Play Console listing
- Upload signed APK/AAB
- Complete content rating questionnaire
- Submit for review

### Slice 6.3 — Apple App Store submission

- Create App Store Connect listing
- Complete export compliance and content rights
- Submit for review

---

## Summary by urgency

| Priority | Phase |
|----------|-------|
| 1 | Security |
| 2 | Database & Build |
| 3 | App Store Requirements |
| 4 | Production Config |
| 5 | Polish |
| 6 | Submission |
