# QA Checklist — Marketer Pro Office v1.0.0

## How to use
Mark each item `[x]` when passing. Escalate any `[ ]` before release.
Checklist must be 100% complete before App Store / Google Play submission.

---

## 1. Cinematic Flows

### 1.1 Vault Door Scene
- [ ] Scene renders on first tap of "Generate" button
- [ ] Biometric scanner animates on tap
- [ ] Lock bolts rotate on scan
- [ ] Scene transitions to Reactor after ~0.6s
- [ ] Abort path returns to Desk without errors
- [ ] No layout overflow on iPhone SE (375px width)
- [ ] No layout overflow on iPhone 15 Pro Max (430px width)
- [ ] No layout overflow on Android small (360px width)

### 1.2 Reactor Scene
- [ ] All 3 switches (Brand Intel, Audience, AI Core) toggle independently
- [ ] Lever is locked (visually and functionally) until all 3 switches are on
- [ ] Lever animates down on pull
- [ ] Reactor fires and transitions to Chamber after ~0.9s
- [ ] Abort button visible and functional when lever not yet pulled
- [ ] Abort button hidden after lever pull

### 1.3 Presentation Chamber Scene
- [ ] Phase transitions: fade → briefcase → reveal → ready at correct timings (200/600/1100ms)
- [ ] Artifact cards render for copy, captions, hashtags, variations
- [ ] Loading state shows while API is still processing
- [ ] Error state renders "REACTOR FAILURE" with Return to Desk button
- [ ] Selecting an artifact calls onDone and returns to Desk
- [ ] Generation result persists in Artifact Vault after completion

---

## 2. VR Scenes

### 2.1 Brand Identity Chamber
- [ ] Logo upload works (PNG, JPG, SVG)
- [ ] Color orbs selectable and deselectable
- [ ] All 6 tone options selectable
- [ ] Save calls PATCH /api/brands/:id and POST /api/rewards/xp/add (50 XP)
- [ ] onComplete fires after successful save
- [ ] Scene is accessible from ToolsPanel → Brand Kit

### 2.2 Audience Arena
- [ ] All 12 traits available and toggleable
- [ ] Collected traits appear in the top chip row
- [ ] Removing a trait from chip row works
- [ ] Save disabled when no traits selected
- [ ] Save calls POST /api/brands/:id/audiences and awards 50 XP
- [ ] onComplete fires after successful save

### 2.3 Content Forge Scene
- [ ] Lootbox animation plays for full duration
- [ ] POST /api/rewards/lootbox/open fires with correct generationId
- [ ] onComplete fires after lootbox resolves
- [ ] Progress bars animate sequentially

### 2.4 Artifact Vault Scene
- [ ] Fetches and renders all artifacts from /api/artifacts
- [ ] Filter chips (ALL / COPY / CAPTIONS / HASHTAGS / VARIANTS / IMAGES) work correctly
- [ ] Rare artifacts have reactor glow, legendary artifacts have classified glow + shimmer
- [ ] Tapping an artifact opens detail drawer from bottom
- [ ] Detail drawer shows full content and Use / Schedule buttons
- [ ] Return to Desk button closes the scene

### 2.5 Scheduler Tower Scene
- [ ] Auto-Schedule button calls POST /api/schedule/auto and sets scheduledAt
- [ ] All 4 quick-select options produce a valid date
- [ ] Confirm mode shows calendar hologram with correct date and time
- [ ] Confirm Schedule calls POST /api/schedule and fires onScheduled
- [ ] Back button returns to select mode
- [ ] Scene handles API errors without crashing

### 2.6 Observatory Scene
- [ ] Fetches /api/analytics/overview on mount
- [ ] 4 metric cards render (total posts, reach, engagement, growth)
- [ ] Weekly bar chart animates on load
- [ ] Platform breakdown bars animate sequentially
- [ ] Future Performance Telescope stub renders with correct lock message
- [ ] Return to Desk button works

### 2.7 Creator Hub Scene
- [ ] Fetches /api/creator/profile on mount
- [ ] Rank label and level badge render correctly
- [ ] Streak count, longest streak, generation count display
- [ ] Office evolution progress bar animates
- [ ] All 9 scene pills render with correct locked/unlocked state
- [ ] Achievement list renders with correct rarity colors
- [ ] Return to Desk button works

---

## 3. Reward Logic

- [ ] Generating content awards XP and increments generationsCount
- [ ] Level badge in WorkspaceHeader updates after XP award
- [ ] XP bar in WorkspaceHeader fills correctly for current level
- [ ] Streak increments on daily generation
- [ ] Streak resets after missed day
- [ ] Lootbox opens and returns reward array
- [ ] Office background updates visual tier when officeLevel increases
- [ ] Locked tools in ToolsPanel show correct required level

---

## 4. Desk Workspace

- [ ] WorkspaceHeader renders brand name and switcher
- [ ] Brand switcher dropdown lists all brands
- [ ] Switching brand reloads PlannerSurface tasks
- [ ] PlannerSurface tasks load from /api/planner/today
- [ ] Tapping task checkbox toggles status with optimistic update
- [ ] Adding a task via inline input creates row and syncs to backend
- [ ] CalendarDrawer calendar grid renders current month
- [ ] Navigating months loads correct posts for that month
- [ ] Selecting a day shows that day's posts in the list below
- [ ] ToolsPanel tool items navigate or open correct scene
- [ ] Locked tools are non-interactive and show lock icon
- [ ] QuickActionsBar Generate button opens GeneratorForm
- [ ] GeneratorForm Fire button calls startSequence with correct request
- [ ] Mobile: ToolsPanel slides in from left, calendar from right
- [ ] Mobile: overlay backdrop closes panels on tap

---

## 5. Authentication

- [ ] Login page submits credentials and navigates to Desk on success
- [ ] Invalid credentials show error message
- [ ] AuthGuard redirects unauthenticated users to /login
- [ ] Session persists across app restarts (cookie or token)
- [ ] Logout clears session and redirects to /login

---

## 6. Performance

- [ ] Initial bundle loads in < 3s on 4G connection
- [ ] Scene components lazy-load on first navigation (not in initial bundle)
- [ ] Cinematic animations run at 60fps on iPhone 12 and above
- [ ] Cinematic animations run at 60fps on Pixel 6 and above
- [ ] No jank during CalendarDrawer slide-in animation
- [ ] No memory leaks after repeated Vault Generator cycles (check Chrome DevTools)
- [ ] App handles offline state without crashing (API errors handled gracefully)

---

## 7. Legal and Compliance

- [ ] Privacy Policy page accessible from Settings → Legal → Privacy Policy
- [ ] Terms of Use page accessible from Settings → Legal → Terms of Use
- [ ] Privacy Policy and Terms of Use accessible before login (from login screen)
- [ ] Privacy Policy URL resolves at https://marketerprooffice.com/privacy
- [ ] All API calls use HTTPS in production
- [ ] No PII logged to console in production build

---

## 8. Store Submission Readiness

### iOS
- [ ] App icon set complete (all required sizes in AppIcon.appiconset)
- [ ] Launch screen configured and renders without flash of white
- [ ] Bundle ID matches: com.marketerprooffice.app
- [ ] Version and build number set in Xcode
- [ ] Privacy usage descriptions added to Info.plist (NSCameraUsageDescription, etc.)
- [ ] Tested on physical device (not just simulator)
- [ ] TestFlight build uploaded and tested by at least 3 testers
- [ ] App Store metadata complete (see docs/store-metadata.md)
- [ ] Privacy nutrition labels configured in App Store Connect

### Android
- [ ] App icon set complete (all mipmap densities)
- [ ] applicationId matches: com.marketerprooffice.app
- [ ] versionCode and versionName set in build.gradle
- [ ] Release APK signed with production keystore
- [ ] Permissions declared in AndroidManifest.xml match docs/store-metadata.md
- [ ] Tested on physical device
- [ ] Internal testing track upload successful
- [ ] Data safety section complete in Google Play Console

---

## 9. Closed Beta Sign-off

- [ ] 5+ external beta testers completed a full generation cycle
- [ ] No P0 (crash) bugs open
- [ ] No P1 (broken flow) bugs open
- [ ] "Serious vs gimmicky" feedback reviewed and addressed
- [ ] Real-world posting tested on at least 2 connected platforms
- [ ] Beta feedback incorporated into v1.0.0 release notes
