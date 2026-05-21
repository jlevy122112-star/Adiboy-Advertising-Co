# Marketer Pro — Full QA Test Plan
### Version 1.0 | Tomorrow's Full-Day Test Session
### Owner: Jacob Levy | Tester: You + Claude

---

## BEFORE YOU START — ENVIRONMENT CHECKLIST

Run these in order. Nothing below works without all of these green.

```powershell
# 1. Start everything
cd "C:\Users\Jacob N. Levy\Downloads\Marketer Pro v1.0"
.\start-dev.ps1

# 2. Verify each service is alive
curl http://localhost:5173        # Web UI — expect HTML
curl http://localhost:8790/health # Auth server
curl http://localhost:8793/health # Campaign server
curl http://localhost:8794/health # Brand server
curl http://localhost:8805/health # Autonomous server
docker ps                         # Redis + Postgres containers running
```

**Required env vars in `.env` before starting:**
- `DATABASE_URL` — Postgres connection string
- `REDIS_URL` — redis://127.0.0.1:6379
- `JWT_SECRET` — any long random string for dev
- `MARKETER_OPENAI_API_KEY` — needed for real AI generation (not stubs)
- `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` — needed for billing tests
- `VITE_STRIPE_PUBLISHABLE_KEY` — needed for frontend checkout

**Test accounts to create before starting:**
| Role | Email | Password |
|------|-------|----------|
| Free user | free@test.com | Test1234! |
| Pro user | pro@test.com | Test1234! |
| Fresh user (onboarding) | fresh@test.com | Test1234! |

---

## SECTION 1 — AUTHENTICATION

### 1.1 Sign Up — Happy Path
**Where:** http://localhost:5173 → click Sign Up
**Steps:**
1. Enter email: `fresh@test.com`, password: `Test1234!`
2. Submit
3. **Expect:** Redirected to onboarding wizard, NOT dashboard
4. **Expect:** JWT token stored (check browser DevTools → Application → Local Storage)
5. **Expect:** No console errors

### 1.2 Sign Up — Validation
**Steps:**
1. Submit empty form → **Expect:** field-level error messages, not browser alert()
2. Submit invalid email (no @) → **Expect:** "Invalid email" message inline
3. Submit weak password (< 8 chars) → **Expect:** password strength indicator shows weak
4. Submit already-registered email → **Expect:** "Account already exists" error inline, not crash

### 1.3 Login — Happy Path
**Steps:**
1. Enter `free@test.com` / `Test1234!`
2. Submit
3. **Expect:** Redirect to dashboard
4. **Expect:** User name/email visible in header or profile area
5. **Expect:** JWT in local storage

### 1.4 Login — Wrong Password
**Steps:**
1. Enter correct email, wrong password
2. Submit
3. **Expect:** "Invalid credentials" inline error — NOT a browser alert()
4. **Expect:** Form stays filled (email pre-populated for retry)

### 1.5 Login — Rate Limiting
**Steps:**
1. Enter wrong password 6 times in a row
2. **Expect:** Rate limit message appears ("Too many attempts, try again in X minutes")
3. **Note:** In dev this resets on server restart — that's known, document it

### 1.6 Session Expiry
**Steps:**
1. Log in
2. Open DevTools → Application → Local Storage → delete JWT token
3. Try to navigate to a protected page
4. **Expect:** Redirected to login, NOT a broken blank screen
5. **Expect:** "Session expired, please log in again" message — NOT silent redirect

### 1.7 Logout
**Steps:**
1. Log in
2. Find logout button (profile menu or sidebar)
3. Click logout
4. **Expect:** JWT cleared from local storage
5. **Expect:** Redirect to login page
6. **Expect:** Pressing browser Back does NOT return to authenticated state

### 1.8 Password Reset — Request
**Steps:**
1. Click "Forgot password" on login page
2. Enter `free@test.com`
3. Submit
4. **Expect:** "Check your email" confirmation message
5. **KNOWN ISSUE:** Email is NOT actually sent (no SMTP configured) — verify this shows the confirmation UI at minimum, does NOT crash

### 1.9 Persist Login Across Refresh
**Steps:**
1. Log in
2. Hard refresh (Ctrl+Shift+R)
3. **Expect:** Still logged in, NOT redirected to login

---

## SECTION 2 — ONBOARDING WIZARD

### 2.1 First-Time User Full Flow
**Where:** Log in as `fresh@test.com` (never completed onboarding)
**Steps:**
1. **Expect:** Onboarding wizard appears automatically, NOT the main dashboard
2. Step 1 — Business name: enter "Test Business Co."
3. Step 2 — Industry: select from dropdown (verify blank option NOT selectable)
4. Step 3 — Platforms: select Instagram + LinkedIn
5. Step 4 — Brand colors: pick primary color
6. Complete wizard
7. **Expect:** Redirected to main dashboard
8. **Expect:** Onboarding does NOT appear again on next login

### 2.2 Onboarding — Skip / Back Navigation
**Steps:**
1. Start onboarding
2. Fill Step 1, go to Step 2
3. Click Back → **Expect:** Return to Step 1 with data preserved
4. If there's a Skip option → **Expect:** Goes to dashboard with sensible defaults

### 2.3 Onboarding — Refresh Mid-Flow
**Steps:**
1. Start onboarding, fill 2 steps
2. Hard refresh
3. **Expect:** Returns to onboarding (not skipped), ideally at the step you were on

---

## SECTION 3 — CONTENT CALENDAR

### 3.1 Load Calendar — Empty State
**Where:** Dashboard → Calendar tab
**Steps:**
1. Log in as fresh user with no posts
2. Navigate to Calendar
3. **Expect:** Empty state message ("No posts planned. Add one.")
4. **Expect:** No spinner frozen forever
5. **Expect:** Month view is default, current month shown

### 3.2 Load Calendar — With Posts
**Steps:**
1. Log in as user with existing posts
2. Navigate to Calendar
3. **Expect:** Posts appear on correct days
4. **Expect:** Loading indicator visible while fetching, disappears after load
5. **KNOWN ISSUE:** Currently NO loading state — document if spinner is missing

### 3.3 Switch Views — Month / Week / Day
**Steps:**
1. Click Week view button → **Expect:** 7-column week layout, dates correct
2. Click Day view button → **Expect:** Day editor panel with full post details
3. Click Month view button → **Expect:** Back to 6×7 grid
4. Navigate forward/back with arrow buttons in each view
5. **Expect:** Dates update correctly, no off-by-one errors

### 3.4 Create Post — Quick Add
**Steps:**
1. Hover over any day cell (desktop) → **Expect:** "+" button appears
2. Click "+" → Quick add popover appears
3. Enter post title, select platform, set time
4. Save
5. **Expect:** Post chip appears on that day immediately (optimistic UI)
6. Refresh page → **Expect:** Post still there (confirmed saved to API)

### 3.5 Create Post — Full Edit Modal
**Steps:**
1. Click any day → Day editor panel opens OR click existing post chip
2. Click "New post" or open PostEditModal
3. Fill: title, body, platform, scheduled time, hashtags
4. Click Save
5. **Expect:** "Saving…" state on button during save
6. **Expect:** Modal closes on success
7. **Expect:** Post appears in calendar

### 3.6 Edit Existing Post
**Steps:**
1. Click existing post chip
2. Modify the body text
3. Save
4. **Expect:** Updated content reflects in calendar
5. Refresh → **Expect:** Changes persisted

### 3.7 Delete Post — Confirmation Modal
**Steps:**
1. Open a post in edit modal
2. Click Delete button
3. **CRITICAL:** **Expect:** Custom confirmation modal appears — NOT browser `window.confirm()`
4. Click Cancel → **Expect:** Post NOT deleted, modal closes
5. Repeat, click Confirm Delete → **Expect:** Post removed from calendar
6. Refresh → **Expect:** Post gone (deleted from API)

### 3.8 Drag and Drop — Desktop
**Steps:**
1. In Month view: drag a post chip from one day cell to another
2. **Expect:** Post moves visually during drag
3. Drop → **Expect:** Post now on new date
4. Refresh → **Expect:** New date persisted

### 3.9 Drag and Drop — Touch (Mobile Browser)
**Steps:**
1. Open on mobile browser (Chrome on Android or Safari on iPhone)
2. Long-press a post chip → attempt to drag
3. **KNOWN ISSUE:** Touch drag is NOT implemented — document this clearly
4. **Expect:** Tap opens edit modal (fallback behavior)

### 3.10 Reset Calendar — Confirmation Modal
**Steps:**
1. Find the Reset button (settings/gear area of calendar)
2. Click Reset
3. **CRITICAL:** **Expect:** Custom modal — NOT `window.confirm()`
4. Cancel → **Expect:** Nothing happens
5. Confirm → **Expect:** Pins and day notes cleared, posts remain (reset is local only)

### 3.11 Calendar — Keyboard Navigation
**Steps:**
1. Click a day cell to focus it
2. Arrow keys → **Expect:** Focus moves between days
3. Enter → **Expect:** Opens day editor
4. Escape → **Expect:** Closes any open panel

### 3.12 Calendar — API Failure
**Steps:**
1. Stop the campaign server (close that PowerShell window)
2. Reload Calendar
3. **KNOWN ISSUE:** No error UI currently — document what happens (blank? frozen?)
4. Restart campaign server
5. Reload → **Expect:** Calendar loads normally

### 3.13 Post Status Badges
**Steps:**
1. Verify post chips show correct status: `draft` / `scheduled` / `published` / `failed`
2. Change a post status → **Expect:** Badge updates
3. **Expect:** Color coding is consistent (draft=grey, scheduled=blue, published=green, failed=red)

---

## SECTION 4 — CONTENT BRIEF GENERATOR

### 4.1 Generate — Happy Path
**Where:** Dashboard → Content Brief Generator section
**Steps:**
1. Enter topic: "Summer sale — 30% off all products"
2. Select tone: Enthusiastic
3. Select platforms: Instagram, Facebook, LinkedIn, X
4. Click Generate
5. **Expect:** Spinner with "Generating for 4 platforms…"
6. **Expect:** 4 AdaptationCards appear with platform-specific copy
7. **Expect:** Form collapses ("▲ Collapse" button appears)
8. **Expect:** Character counts shown per card
9. **Expect:** Hashtags shown per card

### 4.2 Generate — No Topic
**Steps:**
1. Leave topic blank
2. Click Generate
3. **Expect:** "Enter a topic first." error message inline — NOT browser alert()

### 4.3 Generate — No Platform Selected
**Steps:**
1. Enter topic, deselect all platforms
2. **Expect:** Generate button is disabled OR shows inline error

### 4.4 Platform Toggle
**Steps:**
1. Toggle each platform on/off individually
2. **Expect:** Platform button shows checkmark when selected, color accent
3. Click "Select all" → all 8 platforms selected
4. Click "Deselect all" → back to 2 defaults (Instagram + X)

### 4.5 See More / See Less on Adaptation Cards
**Steps:**
1. Generate content with a long body
2. Cards show truncated preview (120 chars)
3. Click "See more" → full text expands
4. Click "See less" → collapses
5. **Expect:** Toggle works on each card independently

### 4.6 Brief Propagates to Studio Panels
**Steps:**
1. Generate a brief for Instagram
2. Navigate to Instagram Studio
3. **Expect:** Caption field pre-filled with the generated adaptation
4. **Expect:** AI badge visible indicating "AI-Generated"
5. Edit the caption → **Expect:** Edit works, badge updates to "Edited"

### 4.7 Clear Brief
**Steps:**
1. Generate a brief
2. Click "× Clear"
3. **Expect:** Adaptations removed, form resets to empty
4. **Expect:** Studio panels no longer pre-filled

---

## SECTION 5 — STUDIO PANELS (All 7 Platforms)

### Test each studio by navigating to its tab. Run steps 5.1–5.6 for every platform.

**Platforms to test:** Instagram · Facebook · X (Twitter) · YouTube · LinkedIn · Pinterest · Snapchat

### 5.1 Studio Loads Without Errors
**Steps:**
1. Navigate to each studio tab
2. **Expect:** No blank white screens
3. **Expect:** No console errors on load
4. **Expect:** Correct platform name and icon in header

### 5.2 Create New Draft
**Steps:**
1. Fill in the main content field (caption / post text / script)
2. Select format/asset type if applicable
3. Add hashtags
4. **Expect:** Character counter updates in real time
5. **Expect:** Validation warning if over platform limit

### 5.3 AI Assist Button
**Steps:**
1. Click "Generate with AI" / "Suggest with AI" button
2. **Expect:** Loading state on button
3. **Expect:** Content field fills with AI-generated text (or stub if no OpenAI key)
4. **Expect:** AI badge appears
5. Edit the text → **Expect:** Badge changes to "Edited" / provenance tracked

### 5.4 Save Draft
**Steps:**
1. Fill content, click Save/Save Draft
2. **Expect:** "Saving…" state
3. **Expect:** Success confirmation (toast or inline)
4. Refresh → **Expect:** Draft still there

### 5.5 Platform-Specific Fields

| Platform | Specific fields to test |
|----------|------------------------|
| Instagram | Caption, hashtags (max 30), image upload slot, Stories vs Feed toggle |
| Facebook | Post text, link preview, image/video slot, Page vs Profile |
| X (Twitter) | Tweet text (280 char limit enforced), thread mode, hashtags |
| YouTube | Title, description, tags, thumbnail slot, visibility (public/private/unlisted) |
| LinkedIn | Post text, article mode toggle, professional tone indicator |
| Pinterest | Pin title, description, board selector, destination link, image slot |
| Snapchat | Story text, media slot, duration selector |

### 5.6 Publish / Schedule Button
**Steps:**
1. Fill all required fields in each studio
2. Click Publish or Schedule
3. If social account not connected → **Expect:** Prompt to connect account (not a crash)
4. If connected → **Expect:** Job enqueued to BullMQ queue
5. Check queue worker window → **Expect:** Job received log entry
6. **Note:** Without real OAuth tokens, publish will use stub runner — document result

---

## SECTION 6 — SOCIAL CONNECTIONS

### 6.1 Connect a Network — UI Flow
**Where:** Dashboard → Social Connections panel
**Steps:**
1. Click "Connect" on any available network (Facebook, Instagram, X, LinkedIn, YouTube, TikTok, Pinterest)
2. **Expect:** OAuth popup or redirect (not a crash or blank)
3. **Note:** Without real OAuth app credentials in `.env`, flow will fail at provider level — that's expected in dev. Document what error shows.
4. **Expect:** Error is informative ("OAuth not configured") not a blank crash

### 6.2 Coming Soon Networks
**Steps:**
1. Look at Social Connections panel
2. Snapchat, Discord, Threads, Reddit should show "Coming soon" badge
3. **Expect:** These buttons are non-functional / disabled
4. **Expect:** Clear "Coming soon" label visible

### 6.3 Disconnect a Network
**Steps:** (if you have a test account connected)
1. Click disconnect on a connected network
2. **Expect:** Confirmation step (not immediate delete)
3. Confirm → **Expect:** Network shows as disconnected
4. **Expect:** Token removed from server

### 6.4 Reconnect Expired Token
**Steps:**
1. Find a network whose token is expired (or simulate by clearing in DB)
2. **Expect:** "Reconnect" badge / warning visible on connection
3. Click Reconnect → OAuth flow starts

---

## SECTION 7 — CAMPAIGN ORCHESTRATOR

### 7.1 Create Campaign — Volume & Velocity Strategy
**Where:** Dashboard → Campaign Orchestrator
**Steps:**
1. Select "Volume & Velocity" strategy
2. Enter campaign name, target audience, duration
3. Select platforms: Instagram, Facebook, X
4. Click Generate Campaign Plan
5. **Expect:** AI generates multi-platform campaign outline
6. **Expect:** Loading state during generation
7. **Expect:** Plan shows phases, post cadence, content themes

### 7.2 Create Campaign — Authority & Trust Strategy
**Steps:**
1. Select "Authority & Trust" strategy
2. Enter different topic/audience
3. Generate
4. **Expect:** Different content strategy from Volume & Velocity
5. **Expect:** More long-form, thought-leadership oriented suggestions

### 7.3 Campaign → Calendar Integration
**Steps:**
1. Create a campaign plan
2. Click "Add to Calendar" or "Schedule Campaign"
3. **Expect:** Multiple posts appear in Calendar across the campaign timeframe
4. Navigate to Calendar → **Expect:** Posts visible with campaign label/tag

### 7.4 Campaign — No OpenAI Key (Stub Behavior)
**Steps:**
1. Remove `MARKETER_OPENAI_API_KEY` from `.env`, restart servers
2. Create a campaign
3. **Expect:** Stub result returned — a templated campaign, NOT a crash
4. **Expect:** Clear indication it's a stub/template, not real AI output
5. Re-add key, restart

---

## SECTION 8 — AUTONOMOUS AGENT

### 8.1 Start Autonomous Run — Full Flow
**Where:** Dashboard → Autonomous Agent section
**Steps:**
1. Ensure at least one social network connected (or stub is acceptable)
2. Select platforms: Instagram, LinkedIn
3. Select scope: `single_post`
4. Click "Start Run" / "Let AI handle it"
5. **Expect:** Run ID returned in response
6. **Expect:** Status shows `requested` → `validating` → `planning` → `generating` → `scheduling` → `ready_to_publish` → `completed`
7. **Expect:** Progress indicator updates through stages
8. Check autonomous server window → **Expect:** State transition log entries

### 8.2 Monitor Run Progress
**Steps:**
1. Start a run
2. **Expect:** UI polls or live-updates run status
3. **Expect:** Current stage visible to user (e.g. "Planning your campaign…")
4. **Expect:** NOT a blank spinner with no information

### 8.3 Pause a Run
**Steps:**
1. Start a run
2. Immediately click Pause (while in `planning` or `generating` state)
3. **Expect:** Run transitions to `paused`
4. **Expect:** Resume button appears
5. Click Resume → **Expect:** Run continues from where it left off

### 8.4 Cancel a Run
**Steps:**
1. Start a run
2. Click Cancel
3. **Expect:** Run transitions to `cancelled`
4. **Expect:** Cancelled runs appear in history with `cancelled` status
5. **Expect:** Cancelled run cannot be resumed

### 8.5 Run Completes — Posts in Queue
**Steps:**
1. Complete a full autonomous run
2. **Expect:** Scheduled posts appear in Content Calendar
3. Check BullMQ worker window → **Expect:** Publish jobs received and processed
4. **Expect:** Post status updates to `published` (or `failed` with stub runner)

### 8.6 user_only Decision Point — Awaiting User
**Steps:**
1. Start a run that hits a `user_only` decision point (e.g. choosing which social account to publish from when multiple are connected)
2. **Expect:** Run transitions to `awaiting_user`
3. **Expect:** Notification or badge indicating user action required
4. **Expect:** Specific decision point labeled ("Which Instagram account?")
5. User makes selection → **Expect:** Run resumes

---

## SECTION 9 — BRAND PROFILE & MEMORY

### 9.1 Create Brand Profile
**Where:** Dashboard → Brand Profile
**Steps:**
1. Enter business name, tagline, primary color, logo URL
2. Select voice: Professional / Casual / Enthusiastic
3. Save
4. **Expect:** Brand data saved
5. Navigate away and back → **Expect:** Data persisted

### 9.2 Brand Profile Feeds Into Generation
**Steps:**
1. Set brand profile with name "Acme Corp" and voice "Professional"
2. Generate content in Content Brief Generator
3. **Expect:** Generated copy references brand name
4. **Expect:** Tone matches "Professional" setting

### 9.3 Brand Memory — Upload
**Steps:**
1. Navigate to Brand Memory / AI Brand Profile section
2. Upload a brand document (PDF or text)
3. **Expect:** Upload progress shown
4. **Expect:** Document indexed (embedding stored)
5. **Expect:** Success confirmation

### 9.4 Brand Theme Panel
**Steps:**
1. Navigate to Brand Theme
2. Change primary color
3. **Expect:** UI preview updates with new color
4. Change typography settings
5. Save → **Expect:** Settings persisted
6. Navigate away and back → **Expect:** Theme still applied

---

## SECTION 10 — BILLING & SUBSCRIPTIONS

### 10.1 Pricing Page Loads
**Where:** Dashboard → Pricing / Upgrade
**Steps:**
1. Navigate to Pricing page
2. **Expect:** Free, Pro, Enterprise plans displayed with features
3. **Expect:** Current plan highlighted
4. **Expect:** Monthly/Annual toggle works

### 10.2 Upgrade to Pro — Checkout
**Steps:**
1. Click "Upgrade to Pro"
2. **Expect:** UpgradeModal opens
3. Click "Start Pro Plan"
4. **Expect:** Redirects to Stripe Checkout (if `STRIPE_SECRET_KEY` configured)
5. **If no Stripe key:** **Expect:** Toast error "Checkout unavailable — contact support" NOT a browser `alert()`
6. Complete Stripe test checkout (card: `4242 4242 4242 4242`, any future date, any CVC)
7. **Expect:** Redirect back to app with pro plan active

### 10.3 Manage Billing Portal
**Steps:**
1. Log in as Pro user
2. Click "Manage Billing" / "Billing Portal"
3. **Expect:** Redirects to Stripe Customer Portal
4. **If portal fails:** **Expect:** Toast error "Could not open billing portal" NOT a browser `alert()`

### 10.4 Enterprise Contact Button
**Steps:**
1. On Pricing page, click "Contact Sales" on Enterprise plan
2. **Expect:** Opens email client with `enterprise@marketer.pro` pre-filled
3. **Expect:** NOT a browser `alert()` showing the email address

### 10.5 Plan Gates — Free User
**Steps:**
1. Log in as `free@test.com`
2. Try to access Pro-only features (Autonomous Agent, AI Generation, Live Publishing)
3. **Expect:** `<PlanGate>` overlay appears with upgrade prompt
4. **Expect:** Feature is locked, not just hidden

### 10.6 Stripe Webhook
**Steps:**
1. Use Stripe CLI to trigger test webhook: `stripe trigger customer.subscription.updated`
2. **Expect:** User's plan updates in the app
3. **Expect:** No crash in billing server
4. Check billing server logs → **Expect:** Webhook received and processed

---

## SECTION 11 — ANALYTICS

### 11.1 Analytics Dashboard Loads
**Where:** Dashboard → Analytics
**Steps:**
1. Navigate to Analytics
2. **Expect:** Charts/graphs render (not blank)
3. **If no real platform tokens:** **Expect:** Stub data shown with clear label "Demo data"
4. **Expect:** No frozen loading spinner

### 11.2 Platform Filter
**Steps:**
1. Filter analytics by platform (Instagram only)
2. **Expect:** Charts update to show Instagram-specific data
3. Switch to LinkedIn → **Expect:** Different data shown

### 11.3 Date Range
**Steps:**
1. Change date range selector (last 7 days, 30 days, 90 days)
2. **Expect:** Charts update, date labels correct
3. **Expect:** No crash on date change

---

## SECTION 12 — SERP RESEARCH

### 12.1 Keyword Research — Happy Path
**Where:** Dashboard → SERP Research
**Steps:**
1. Enter keyword: "social media marketing tools"
2. Click Research
3. **Expect:** Results appear with search volume, difficulty, related keywords
4. **If no SERPAPI_KEY:** **Expect:** Stub results returned with clear label — NOT a crash

### 12.2 SERP Brief Generation
**Steps:**
1. Select a keyword from results
2. Click "Generate SERP Brief"
3. **Expect:** Structured content brief appears with H1, H2 suggestions, word count target

---

## SECTION 13 — SENTIMENT ANALYSIS

### 13.1 Sentiment Scan
**Where:** Dashboard → Sentiment
**Steps:**
1. Enter brand name or social handle to monitor
2. Click Analyze
3. **Expect:** Sentiment score returned (positive/neutral/negative)
4. **If no API key:** **Expect:** Stub neutral score — NOT a crash
5. **Expect:** Results shown in UI, not raw JSON

---

## SECTION 14 — PREDICTIVE SCHEDULING

### 14.1 Best Time Suggestions
**Where:** Dashboard → Predictive Scheduling
**Steps:**
1. Select platform: Instagram
2. Select audience timezone
3. Click "Find Best Times"
4. **Expect:** Day/hour recommendations appear
5. **Expect:** Slot scores shown
6. Click a recommended slot → **Expect:** Pre-fills schedule time in Calendar

---

## SECTION 15 — TEAM COLLABORATION

### 15.1 Invite Team Member
**Where:** Dashboard → Team
**Steps:**
1. Enter email: `teammate@test.com`
2. Select role: Editor
3. Click Invite
4. **Expect:** Invitation confirmation shown
5. **KNOWN ISSUE:** No SMTP — email not actually sent. Document.

### 15.2 Role Permissions
**Steps:**
1. Log in as Editor role (if you can create one)
2. **Expect:** Cannot access billing settings
3. **Expect:** Can create/edit posts
4. **Expect:** Cannot delete workspace

---

## SECTION 16 — SAFETY & COMPLIANCE

### 16.1 Content Safety Check
**Where:** Any studio panel → Safety review option
**Steps:**
1. Enter post content with a borderline phrase
2. Click safety check
3. **Expect:** Flags returned if content violates policy
4. **Expect:** Sanitized version suggested if flagged

### 16.2 Autonomous Run — Compliance
**Steps:**
1. Start autonomous run
2. Verify compliance-reviewer agent runs (check autonomous server logs)
3. **Expect:** Compliance step logged: `agent_start: compliance_reviewer`
4. **Expect:** Flagged content sanitized before scheduling

---

## SECTION 17 — MOBILE & PWA

### 17.1 Responsive Layout — Mobile Browser
**Steps:**
1. Open http://localhost:5173 on iPhone or Android browser
2. **Expect:** Layout adapts — no horizontal scroll on main content
3. **Expect:** Navigation accessible via hamburger or bottom bar
4. **Expect:** Touch targets ≥ 44×44px (buttons tappable without zooming)

### 17.2 PWA Install Prompt
**Steps:**
1. Open in Chrome on Android
2. **Expect:** "Add to Home Screen" prompt appears (or browser install icon in address bar)
3. Install the app
4. Open from home screen → **Expect:** Launches in standalone mode (no browser chrome)
5. **Expect:** Theme color `#0f0f13` shown in status bar

### 17.3 PWA Offline
**Steps:**
1. Install PWA, load the app
2. Turn off network
3. Reload
4. **Expect:** App shell loads (service worker cache)
5. **Expect:** "You're offline" message, not a Chrome error page
6. Re-enable network → **Expect:** App reconnects and functions

### 17.4 Capacitor — iOS (requires Mac + Xcode)
**Steps:**
1. From `apps/marketer-pro-mobile`: `npx cap add ios`
2. `npm run build:ios`
3. `npx cap open ios`
4. In Xcode: select iPhone 15 Pro simulator, Run
5. **Expect:** App launches in simulator
6. **Expect:** No white screen (content loads)
7. **Expect:** Native back gesture works
8. **Expect:** Status bar not overlapping content

### 17.5 Capacitor — Android (requires Android Studio)
**Steps:**
1. `npx cap add android`
2. `npm run build:android`
3. `npx cap open android`
4. Run on Pixel 7 emulator (API 34)
5. **Expect:** App launches
6. **Expect:** Back button / gesture works
7. **Expect:** No ANR (app not responding) on cold start

---

## SECTION 18 — ERROR STATES & EDGE CASES

### 18.1 Network Offline — Full App
**Steps:**
1. Log in, load dashboard
2. Disconnect network
3. Try to: create a post, generate content, load calendar
4. **Expect:** Each action shows a meaningful error, NOT a blank freeze
5. **Expect:** No unhandled promise rejections in console

### 18.2 API Server Down
**Steps:**
1. Close the campaign server PowerShell window
2. Try to load Calendar
3. **Expect:** Error state in Calendar, not blank
4. Restart campaign server → reload → **Expect:** Works again

### 18.3 Empty States — Fresh Account
**Steps:**
1. Log in as brand new user (no data)
2. Visit: Calendar, Analytics, Campaigns, Autonomous, Brand Profile
3. **Expect:** Each shows a meaningful empty state, NOT blank white panels
4. **Expect:** Call-to-action to add first item in each section

### 18.4 Very Long Content
**Steps:**
1. In any studio panel, paste 5,000 characters into the post body field
2. **Expect:** Character limit enforced OR clearly shown over-limit warning
3. **Expect:** App does NOT crash or freeze

### 18.5 Special Characters & Emoji
**Steps:**
1. Enter post with emoji: "🎉 Summer Sale is HERE! 🔥"
2. Enter post with special chars: `<script>alert('xss')</script>`
3. **Expect:** Emoji renders correctly in UI
4. **Expect:** Script tag is escaped/sanitized — NOT executed

### 18.6 Concurrent Edits (Two Browser Tabs)
**Steps:**
1. Open app in two tabs, both logged in as same user
2. Edit same post in Tab 1, save
3. Edit same post in Tab 2 with different content, save
4. **Expect:** Last write wins (no crash) — document actual behavior

### 18.7 Large Calendar (200+ Posts)
**Steps:**
1. Create 200+ schedule entries via API or script
2. Load Calendar
3. **Expect:** Loads within 3 seconds
4. **Expect:** Month view does not freeze when rendering many post chips
5. **Note:** API currently has limit=200 in the query — verify this cap works

---

## SECTION 19 — STORE SUBMISSION BLOCKERS (Final Check)

Run these last. These are the exact things that cause **automatic store rejection**.

### 19.1 Zero Browser Alerts
**Steps:**
1. Open browser DevTools console
2. Perform every action in this test plan
3. **Expect:** Zero `[Violation] 'alert'` or `[Violation] 'confirm'` warnings
4. Specifically test: Delete post, Reset calendar, Billing portal fail, Checkout fail, Enterprise contact button

### 19.2 Privacy Policy Accessible
**Steps:**
1. Navigate to http://localhost:5173/#/privacy
2. **Expect:** Privacy Policy page loads, readable, not blank
3. Check it covers: data collection, AI usage, social OAuth, user rights

### 19.3 Terms of Service Accessible
**Steps:**
1. Navigate to http://localhost:5173/#/terms
2. **Expect:** Terms of Service page loads

### 19.4 PWA Manifest Valid
**Steps:**
1. Open DevTools → Application → Manifest
2. **Expect:** All fields green, no warnings
3. **Expect:** Icons listed (192, 512, 1024) — note if actual PNG files are missing

### 19.5 Service Worker Registered
**Steps:**
1. DevTools → Application → Service Workers
2. **Expect:** `sw.js` registered and activated
3. **Expect:** Status: "Activated and is running"

### 19.6 No `window.confirm` / `window.alert` in Source
```bash
grep -rn "window.confirm\|window.alert\|^alert(" apps/web/src
# Expected output: ZERO results
```

### 19.7 HTTPS Ready
**Steps:**
1. Verify all API calls use HTTPS in production config (check `.env.example`)
2. **Expect:** No hardcoded `http://` API URLs in production build
3. `VITE_*_API_ORIGIN` vars should be `https://` in prod

---

## SECTION 20 — PERFORMANCE BASELINES

Record these numbers during testing. We'll use them as benchmarks.

| Metric | Target | Actual (record tomorrow) |
|--------|--------|--------------------------|
| Cold start (first load) | < 3 seconds | |
| Calendar load (with 50 posts) | < 2 seconds | |
| Content generation (AI) | < 8 seconds | |
| Login → dashboard | < 1 second | |
| PWA install size | < 5 MB | |
| Lighthouse Performance score | > 75 | |
| Lighthouse PWA score | > 90 | |

Run Lighthouse: DevTools → Lighthouse → check Performance + PWA → Analyze

---

## TEST SESSION SCHEDULE — TOMORROW

| Time | Section | Focus |
|------|---------|-------|
| 9:00 AM | Setup | Environment up, all servers green, test accounts created |
| 9:30 AM | Sections 1–2 | Auth + Onboarding — gate everything else on this working |
| 10:30 AM | Section 3 | Calendar — most complex UI, most known issues |
| 11:30 AM | Sections 4–5 | Content Brief Generator + Studio Panels |
| 1:00 PM | Lunch break | |
| 1:30 PM | Sections 6–8 | Social Connections + Campaign + Autonomous Agent |
| 3:00 PM | Sections 9–14 | Brand, Billing, Analytics, SERP, Sentiment, Predictive |
| 4:00 PM | Sections 15–18 | Team, Safety, Mobile/PWA, Error States |
| 5:00 PM | Section 19 | Store submission blocker check — must all pass |
| 5:30 PM | Section 20 | Performance baselines |
| 6:00 PM | Debrief | Document all failures, prioritize fixes |

---

## BUG REPORT FORMAT

When you find a failure, document it like this:

```
BUG: [short title]
Section: [e.g. 3.7]
Steps to reproduce: [exact steps]
Expected: [what should happen]
Actual: [what happened]
Severity: BLOCKS STORE / DEGRADES UX / MINOR
Screenshot: [attach]
Console errors: [paste]
```

---

## KNOWN ISSUES GOING IN (do NOT mark these as new bugs)

| # | Issue | Where |
|---|-------|-------|
| K1 | No touch drag-and-drop in calendar | Section 3.9 |
| K2 | No loading state on calendar mount | Section 3.2 |
| K3 | Silent API failures in calendar (.catch(()=>{})) | Section 3.12 |
| K4 | Password reset sends no email (no SMTP) | Section 1.8 |
| K5 | Social OAuth fails without real credentials | Section 6.1 |
| K6 | AI agents return stubs without OpenAI key | Sections 7.4, 8.1 |
| K7 | 9 API servers have no JWT auth | All API sections |
| K8 | tenantId trusted from client | Sections 7, 8 |
| K9 | App icon PNGs not generated yet | Section 19.4 |
| K10 | Rate limiting resets on server restart | Section 1.5 |
